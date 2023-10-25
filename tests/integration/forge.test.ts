import * as crypto from 'node:crypto';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { Forge, ForgeError } from '../../src/forge';
import { sanitizeDatabaseName, until } from '../../src/lib';

Forge.setToken(import.meta.env.VITE_FORGE_TOKEN);
const server = Number(import.meta.env.VITE_FORGE_SERVER);

function id() {
  return crypto.randomBytes(4).toString('hex');
}

describe('sites', () => {
  afterAll(async () => {
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
  });

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

  test('duplicate site name', async () => {
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

  test('duplicate database name', async () => {
    const database = `test-${id()}`;
    const name = `${database}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, sanitizeDatabaseName(database));

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    const name2 = `test-${id()}.laravel-deploy-preview.com`;

    try {
      await Forge.createSite(server, name2, sanitizeDatabaseName(database));
    } catch (e) {
      expect(e).toBeInstanceOf(ForgeError);
      expect(e.message).toBe('Forge API request failed with status code 422.');
      expect(e.data).toMatchObject({ database: ['The database has already been taken.'] });
    }

    expect.assertions(3);
  });

  test('obtain SSL certificate', async () => {
    const name = `test-${id()}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, '');

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    let certificate = await Forge.obtainCertificate(server, site.id, name);

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

  test('use existing SSL certificate', async () => {
    const name = `test-${id()}.laravel-deploy-preview.com`;

    let site = await Forge.createSite(server, name, '');

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    let certificate = await Forge.installExistingCertificate(server, site.id, 'key', 'certificate');

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

    let certificate = await Forge.cloneExistingCertificate(server, site.id, cert);

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
});
