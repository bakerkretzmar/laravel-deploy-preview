import * as core from '@actions/core';
import { Forge, Site } from './forge.js';
import { normalizeDatabaseName, normalizeDomainName, tap } from './lib.js';

export async function createPreview({
  branch,
  repository,
  servers,
  afterDeploy = '',
  environment = {},
  certificate,
  name,
  webhooks,
  aliases,
  isolated,
  username,
  php,
}: {
  branch: string;
  repository: string;
  servers: { id: number; domain: string }[];
  afterDeploy?: string;
  environment?: Record<string, string>;
  certificate?: { type: 'clone'; certificate: number } | { type: 'existing'; certificate: string; key: string } | false;
  name?: string;
  webhooks: string[];
  failureEmail?: string;
  aliases: string[];
  isolated: boolean;
  username?: string;
  php?: string;
}) {
  core.info(`Creating preview site for branch: ${branch}.`);

  const siteName = `${name ?? normalizeDomainName(branch)}.${servers[0].domain}`;

  let site = tap(
    (await Forge.listSites(servers[0].id)).find((site) => site.name === siteName),
    (site) => (site ? new Site(site) : undefined),
  );

  if (site) {
    core.info(`Site exists: ${site.name}`);
    return;
  }

  aliases = aliases.map((alias) =>
    alias.startsWith('.')
      ? `${normalizeDomainName(branch)}${alias}`
      : alias.endsWith('.')
        ? `${alias}${servers[0].domain}`
        : alias,
  );

  if (isolated && !username) {
    username = siteName;
  }

  if (php) {
    php = `php${php.replace('.', '')}`;
  }

  core.info(`Creating site: ${siteName}.`);
  site = await Site.create(servers[0].id, {
    name: siteName,
    database: environment.DB_CONNECTION === 'sqlite' ? '' : normalizeDatabaseName(branch),
    aliases,
    isolated,
    username,
    php,
  });

  if (certificate !== false) {
    if (certificate?.type === 'existing') {
      core.info('Installing existing SSL certificate.');
      await site.installCertificate(certificate.certificate, certificate.key);
    } else if (certificate?.type === 'clone') {
      core.info('Cloning existing SSL certificate.');
      await site.cloneCertificate(certificate.certificate);
    } else {
      core.info('Requesting new SSL certificate.');
      await site.createCertificate();
    }
  }

  core.info(`Installing repository: ${repository}.`);
  await site.installRepository(repository, branch);

  const sqliteEnvironment =
    environment.DB_CONNECTION === 'sqlite'
      ? {
          DB_HOST: undefined,
          DB_PORT: undefined,
          DB_DATABASE: undefined,
          DB_USERNAME: undefined,
          DB_PASSWORD: undefined,
        }
      : {};

  core.info('Updating `.env` file.');
  await site.setEnvironmentVariables({
    DB_DATABASE: normalizeDatabaseName(branch),
    ...sqliteEnvironment,
    ...environment,
  });

  core.info('Installing scheduler.');
  await site.installScheduler();

  if (afterDeploy) {
    core.info('Updating deploy script.');
    await site.appendToDeployScript(afterDeploy);
  }

  core.info('Enabling Quick Deploy.');
  await site.enableQuickDeploy();

  core.info('Setting up webhooks.');
  await Promise.all(webhooks.map((url) => site.createWebhook(url)));

  core.info('Setting up failure email.');
  await Promise.all(failureEmail.map((email) => site.createFailureEmail(email)));

  core.info('Deploying site.');
  await site.deploy();

  if (certificate !== false) {
    core.info('Waiting for SSL certificate to be activated.');
    await site.ensureCertificateActivated();
  }

  return { url: `http${certificate === false ? '' : 's'}://${site.name}`, id: site.id };
}

export async function destroyPreview({
  branch,
  servers,
  environment = {},
  name,
}: {
  branch: string;
  servers: { id: number; domain: string }[];
  environment?: Record<string, string>;
  name?: string;
}) {
  core.info(`Removing preview site: ${branch}.`);

  const siteName = `${name ?? normalizeDomainName(branch)}.${servers[0].domain}`;

  const site = tap(
    (await Forge.listSites(servers[0].id)).find((site) => site.name === `${siteName}`),
    (site) => (site ? new Site(site) : undefined),
  );

  if (!site) {
    core.warning(`Site not found: ${siteName}.`);
    return;
  }

  core.info(`Found site: ${site.name}.`);

  // There is an unresolved issue with Forge where if we attempt to uninstall the scheduler like this and then
  // immediately delete the site, it gets stuck in a 'removing' state indefinitely and is not fully deleted.
  // Forge uninstalls the default scheduler automatically when deleting sites though, so for now we can skip this.
  // core.info('Uninstalling scheduler.');
  // await site.uninstallScheduler();

  core.info('Deleting site.');
  await site.delete();

  if (environment.DB_CONNECTION !== 'sqlite') {
    core.info('Deleting database.');
    await site.deleteDatabase(normalizeDatabaseName(branch));
  }

  return { id: site.id };
}
