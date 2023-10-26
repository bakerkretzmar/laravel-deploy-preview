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
}: {
  branch: string;
  repository: string;
  servers: { id: number; domain: string }[];
  afterDeploy?: string;
  environment?: Record<string, string>;
  certificate?: { type: 'clone'; certificate: number } | { type: 'existing'; certificate: string; key: string };
}) {
  core.info(`Creating preview site for branch: ${branch}.`);

  const siteName = `${normalizeDomainName(branch)}.${servers[0].domain}`;

  let site = tap(
    (await Forge.listSites(servers[0].id)).find((site) => site.name === siteName),
    (site) => (site ? new Site(site) : undefined),
  );

  if (site) {
    core.info(`Site exists: ${site.name}`);
    return;
  }

  core.info(`Creating site: ${siteName}.`);
  site = await Site.create(servers[0].id, siteName, normalizeDatabaseName(branch));

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

  core.info(`Installing repository: ${repository}.`);
  await site.installRepository(repository, branch);

  core.info('Updating `.env` file.');
  await site.setEnvironmentVariables({
    DB_DATABASE: normalizeDatabaseName(branch),
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

  core.info('Deploying site.');
  await site.deploy();

  core.info('Waiting for SSL certificate to be activated.');
  await site.ensureCertificateActivated();

  return { url: `https://${site.name}` };
}

export async function destroyPreview({
  branch,
  servers,
}: {
  branch: string;
  servers: { id: number; domain: string }[];
}) {
  core.info(`Removing preview site: ${branch}.`);

  const siteName = `${normalizeDomainName(branch)}.${servers[0].domain}`;

  const site = tap(
    (await Forge.listSites(servers[0].id)).find((site) => site.name === `${siteName}`),
    (site) => (site ? new Site(site) : undefined),
  );

  if (!site) {
    core.warning(`Site not found: ${siteName}.`);
    return;
  }

  core.info(`Found site: ${site.name}.`);

  core.info('Uninstalling scheduler.');
  await site.uninstallScheduler();

  core.info('Deleting site.');
  await site.delete();

  core.info('Deleting database.');
  await site.deleteDatabase(normalizeDatabaseName(branch));
}
