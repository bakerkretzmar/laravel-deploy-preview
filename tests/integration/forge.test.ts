import { describe, expect, test, vi } from 'vitest';
import { Forge } from '../../src/forge';

const server = import.meta.env.VITE_FORGE_SERVER;

Forge.setToken(import.meta.env.VITE_FORGE_TOKEN);

describe('sites', () => {
  test('handle error on duplicate site name', async () => {
    await expect(Forge.createSite(server, 'extant.laravel-deploy-preview.com', '')).rejects.toThrowError(
      'Forge API request failed with status code 422.',
    );
  });
});
