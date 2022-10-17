import { config } from 'dotenv';
import { Forge, Site } from './forge.js';
import { createPreview, destroyPreview } from './action.js';

config();

Forge.setToken(process.env.FORGE_TOKEN);

// console.log(await Forge.getCertificate(600058, 1780408, 1568289));
// console.log(await Forge.getCertificate(600058, 1780408, 1568292));

await destroyPreview({ name: '1666028021290.bee.limo', servers: [{ id: 600058, domain: 'bee.limo' }] });

// await createPreview({
//   name: String(Date.now()),
//   repository: 'bakerkretzmar/deploy-preview-app',
//   servers: [{ id: 600058, domain: 'bee.limo' }],
//   afterDeploy: 'npm ci && npm run build',
//   local: true,
// });
