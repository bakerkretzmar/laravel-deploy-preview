import { config } from 'dotenv';
import { Forge } from './forge.js';
import { createPreview, destroyPreview } from './action.js';
import { until } from './lib.js';

config();
Forge.setToken(process.env.FORGE_TOKEN!);

// await site.setEnvironmentVariables({
//   FOO: 'bar',
//   BAZ: '2',
// });

// await destroyPreview({ name: '1666045449551', servers: [{ id: 600058, domain: 'bee.limo' }] });

// await createPreview({
//   name: String(Date.now()),
//   repository: 'bakerkretzmar/deploy-preview-app',
//   servers: [{ id: 600058, domain: 'bee.limo' }],
//   afterDeploy: 'npm ci && npm run build',
//   local: true,
// });
