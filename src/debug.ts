import { config } from 'dotenv';
import { Forge, Site } from './forge.js';
import { createPreview, destroyPreview } from './action.js';

config();

Forge.setToken(process.env.FORGE_TOKEN);

const site = new Site(await Forge.getSite(469678, 1351999));
await site.setEnvironmentVariables({
  FOO: 'bar',
  BAZ: '2',
});

// await destroyPreview({ name: '1666045449551', servers: [{ id: 600058, domain: 'bee.limo' }] });

// await createPreview({
//   name: String(Date.now()),
//   repository: 'bakerkretzmar/deploy-preview-app',
//   servers: [{ id: 600058, domain: 'bee.limo' }],
//   afterDeploy: 'npm ci && npm run build',
//   local: true,
// });
