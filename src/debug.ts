import * as dotenv from 'dotenv';
import { Forge } from './forge.js';
import { run } from './action.js';

dotenv.config();

Forge.setToken(process.env.FORGE_TOKEN);

await run(
  String(Date.now()),
  'bakerkretzmar/deploy-preview-app',
  [{ id: 600058, domain: 'bee.limo' }],
  'npm ci && npm run build'
);
