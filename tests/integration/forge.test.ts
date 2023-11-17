import * as crypto from 'node:crypto';
import { afterAll, describe, expect, test } from 'vitest';
import { Forge, ForgeError } from '../../src/forge';
import { normalizeDatabaseName, until, updateDotEnvString } from '../../src/lib';

// @ts-expect-error import.meta not set up
Forge.token(import.meta.env.VITE_FORGE_TOKEN);
// @ts-expect-error import.meta not set up
Forge.debug(!!import.meta.env.VITE_FORGE_DEBUG);

// @ts-expect-error import.meta not set up
const server = Number(import.meta.env.VITE_FORGE_SERVER);

function id() {
  return crypto.randomBytes(4).toString('hex');
}

describe('sites', () => {
  afterAll(async () => {
    Forge.debug(false);
    const sites = await Forge.listSites(server);
    const databases = await Forge.listDatabases(server);
    await Promise.all([
      ...sites.map(async (site) => {
        if (site.name.startsWith('test-')) {
          await Forge.deleteSite(server, site.id);
        }
      }),
      ...databases.map(async (database) => {
        if (database.name.startsWith('test_')) {
          await Forge.deleteDatabase(server, database.id);
        }
      }),
    ]);
  }, 60_000);

  test('create site', async () => {
    const name = `test-${id()}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, '');

    expect(site).toMatchObject({
      server_id: server,
      name: name,
      status: 'installing',
    });

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    expect(site).toMatchObject({
      server_id: server,
      name: name,
      status: 'installed',
    });
  });

  test('delete site', async () => {
    const name = `test-${id()}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, '');

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    await Forge.deleteSite(server, site.id);

    let sites = await Forge.listSites(server);

    expect(sites).toContainEqual(
      expect.objectContaining({
        id: site.id,
        status: 'removing',
      }),
    );

    await until(
      () => !sites.find(({ id }) => id === site.id),
      async () => (sites = await Forge.listSites(server)),
    );
  });

  test('handle duplicate site name', async () => {
    const name = `test-${id()}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, '');

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    try {
      await Forge.createSite(server, name, '');
    } catch (e) {
      expect(e).toBeInstanceOf(ForgeError);
      expect(e.message).toBe('Forge API request failed with status code 422.');
      expect(e.data).toMatchObject({ domain: ['The domain has already been taken.'] });
    }

    expect.assertions(3);
  });

  test('handle duplicate database name', async () => {
    const database = `test-${id()}`;
    const name = `${database}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, normalizeDatabaseName(database));

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    const name2 = `test-${id()}.laravel-deploy-preview.com`;

    try {
      await Forge.createSite(server, name2, normalizeDatabaseName(database));
    } catch (e) {
      expect(e).toBeInstanceOf(ForgeError);
      expect(e.message).toBe('Forge API request failed with status code 422.');
      expect(e.data).toMatchObject({ database: ['The database has already been taken.'] });
    }

    expect.assertions(3);
  });

  test('create SSL certificate', async () => {
    const name = `test-${id()}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, '');

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    let certificate = await Forge.createCertificate(server, site.id, name);

    expect(certificate).toMatchObject({
      domain: name,
      type: 'letsencrypt',
      request_status: 'created',
      status: 'installing',
    });

    certificate = await Forge.getCertificate(server, site.id, certificate.id);

    expect(certificate).toMatchObject({
      domain: name,
      status: 'installing',
      activation_status: null,
      active: false,
    });

    await until(
      () => certificate.status === 'installed',
      async () => (certificate = await Forge.getCertificate(server, site.id, certificate.id)),
      5,
    );

    expect(certificate).toMatchObject({
      domain: name,
      status: 'installed',
      activation_status: 'activating',
    });

    await until(
      () => certificate.activation_status === 'activated',
      async () => (certificate = await Forge.getCertificate(server, site.id, certificate.id)),
    );

    expect(certificate).toMatchObject({
      domain: name,
      activation_status: 'activated',
      active: true,
    });
  });

  test('handle failing to create SSL certificate', async () => {
    // Domain doesn't exist / isn't pointed to the server
    const name = `test-${id()}-laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, '');

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    let certificate = await Forge.createCertificate(server, site.id, name);

    expect(certificate).toMatchObject({
      domain: name,
      type: 'letsencrypt',
      request_status: 'created',
      status: 'installing',
    });

    try {
      // Certificate installation will fail and the 'installing' cert above will disappear from the list
      await until(
        () => false,
        async () => (certificate = await Forge.getCertificate(server, site.id, certificate.id)),
        5,
      );
    } catch (e) {
      expect(e).toBeInstanceOf(ForgeError);
      expect(e.message).toBe('Forge API request failed with status code 404.');
      expect(e.detail).toBe(
        `A previously requested SSL certificate was not found. This may mean that automatically obtaining and installing a Let’s Encrypt certificate failed. Please review any error output in your Forge dashboard and then try again: https://forge.laravel.com/servers/${server}/sites/${site.id}.`,
      );
      expect(e.data).toBe('Resource not found.');
    }

    expect.assertions(5);
  });

  test('install SSL certificate', async () => {
    const name = `test-${id()}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, '');

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    let certificate = await Forge.installCertificate(server, site.id, 'key', 'certificate');

    expect(certificate).toMatchObject({
      domain: name,
      request_status: 'created',
      status: 'installing',
    });

    certificate = await Forge.getCertificate(server, site.id, certificate.id);

    expect(certificate).toMatchObject({
      domain: name,
      type: null,
      status: 'installing',
      activation_status: null,
    });

    await until(
      () => certificate.status === 'installed',
      async () => (certificate = await Forge.getCertificate(server, site.id, certificate.id)),
    );

    expect(certificate).toMatchObject({
      domain: name,
      status: 'installed',
      activation_status: null,
      active: false,
    });

    await Forge.activateCertificate(server, site.id, certificate.id);

    certificate = await Forge.getCertificate(server, site.id, certificate.id);

    expect(certificate).toMatchObject({
      domain: name,
      activation_status: 'activating',
    });

    await until(
      () => certificate.activation_status === 'activated',
      async () => (certificate = await Forge.getCertificate(server, site.id, certificate.id)),
    );

    expect(certificate).toMatchObject({
      domain: name,
      activation_status: 'activated',
      active: true,
    });
  });

  test('clone SSL certificate', async () => {
    // Existing third-party cert for foobar.laravel-deploy-preview.com
    const cert = 1953017;

    const name = `test-${id()}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, '');

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    let certificate = await Forge.cloneCertificate(server, site.id, cert);

    expect(certificate).toMatchObject({
      domain: name,
      request_status: 'created',
      status: 'installing',
    });

    certificate = await Forge.getCertificate(server, site.id, certificate.id);

    expect(certificate).toMatchObject({
      domain: name,
      type: null,
      status: 'installing',
      activation_status: null,
    });

    await until(
      () => certificate.status === 'installed',
      async () => (certificate = await Forge.getCertificate(server, site.id, certificate.id)),
    );

    expect(certificate).toMatchObject({
      domain: name,
      status: 'installed',
      activation_status: null,
      active: false,
    });

    await Forge.activateCertificate(server, site.id, certificate.id);

    certificate = await Forge.getCertificate(server, site.id, certificate.id);

    expect(certificate).toMatchObject({
      domain: name,
      activation_status: 'activating',
    });

    await until(
      () => certificate.activation_status === 'activated',
      async () => (certificate = await Forge.getCertificate(server, site.id, certificate.id)),
    );

    expect(certificate).toMatchObject({
      domain: name,
      activation_status: 'activated',
      active: true,
    });
  });

  test.todo('install repository');

  test.todo('enable quick deploy');
  // site = await Forge.enableQuickDeploy(server, site.id);
  // expect(site).toMatchObject({
  //   server_id: server,
  //   name: name,
  //   quick_deploy: 'true',
  // });

  test('handle failing to enable quick deploy', async () => {
    const name = `test-${id()}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, '');

    expect(site).toMatchObject({
      server_id: server,
      name: name,
      status: 'installing',
    });

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    expect(site).toMatchObject({
      server_id: server,
      name: name,
      status: 'installed',
    });

    try {
      await Forge.enableQuickDeploy(server, site.id);
    } catch (e) {
      expect(e).toBeInstanceOf(ForgeError);
      expect(e.message).toBe('Forge API request failed with status code 400.');
      expect(e.data).toMatchObject({
        message: 'The site does not yet have an application installed. Please install an application and try again.',
      });
    }

    expect.assertions(5);
  });

  test.todo('update environment file');

  test.todo('deploy site');

  test.todo('run command');

  test.todo('handle failed command');
  // status will be 'failed'

  test('use sqlite', async () => {
    const name = `test-${id()}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, '');

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    await Forge.createGitProject(server, site.id, 'bakerkretzmar/laravel-deploy-preview-app', 'main');

    await until(
      () => site.repository_status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
      3,
    );

    const env = await Forge.getEnvironmentFile(server, site.id);

    await Forge.updateEnvironmentFile(
      server,
      site.id,
      updateDotEnvString(env, {
        DB_CONNECTION: 'sqlite',
        DB_DATABASE: undefined,
      }),
    );

    let command1 = await Forge.runCommand(server, site.id, 'ls database');
    let output1 = '';

    await until(
      () => command1.status === 'finished',
      async () => ({ command: command1, output: output1 } = await Forge.getCommand(server, site.id, command1.id)),
    );

    expect(output1).not.toContain('database.sqlite');

    await Forge.deploy(server, site.id);

    await until(
      () => site.deployment_status === null,
      async () => (site = await Forge.getSite(server, site.id)),
    );

    let command2 = await Forge.runCommand(server, site.id, 'ls database');
    let output2 = '';

    await until(
      () => command2.status === 'finished',
      async () => ({ command: command2, output: output2 } = await Forge.getCommand(server, site.id, command2.id)),
    );

    expect(output2).toContain('database.sqlite');

    let command3 = await Forge.runCommand(server, site.id, 'php artisan db:monitor --databases=sqlite');
    let output3 = '';

    await until(
      () => command3.status === 'finished',
      async () => ({ command: command3, output: output3 } = await Forge.getCommand(server, site.id, command3.id)),
    );

    expect(output3).toMatch(/sqlite \.+ \[\] OK/);
  });
});
