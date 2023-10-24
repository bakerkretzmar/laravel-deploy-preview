import { afterAll, describe, expect, test, vi } from 'vitest';
import { Forge } from '../../src/forge';
import { until } from '../../src/lib';

const server = Number(import.meta.env.VITE_FORGE_SERVER);

Forge.setToken(import.meta.env.VITE_FORGE_TOKEN);

describe('sites', () => {
  afterAll(async () => {
    const sites = await Forge.listSites(server);
    await Promise.all(
      sites.map(async (site) => {
        if (site.name.startsWith('test-')) {
          await Forge.deleteSite(server, site.id);
        }
      }),
    );
  });

  test.only('create site', async () => {
    let site = await Forge.createSite(server, 'test-1.laravel-deploy-preview.com', '');

    expect(site).toMatchObject({
      server_id: server,
      name: 'test-1.laravel-deploy-preview.com',
      status: 'installing',
    });

    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );

    expect(site).toMatchObject({
      server_id: server,
      name: 'test-1.laravel-deploy-preview.com',
      status: 'installed',
    });
  });

  test('error on duplicate site name', async () => {
    await expect(Forge.createSite(server, 'extant.laravel-deploy-preview.com', '')).rejects.toThrowError(
      'Forge API request failed with status code 422.',
    );
  });
});
