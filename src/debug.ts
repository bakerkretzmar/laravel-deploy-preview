import { config } from 'dotenv';
import { Forge } from './forge.js';
import { run } from './action.js';

config();

Forge.setToken(process.env.FORGE_TOKEN);

await run({
  name: String(Date.now()),
  repository: 'bakerkretzmar/deploy-preview-app',
  servers: [{ id: 600058, domain: 'bee.limo' }],
  afterDeploy: 'npm ci && npm run build',
  local: true,
});
