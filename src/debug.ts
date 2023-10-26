import { config } from 'dotenv';
import { Forge } from './forge.js';

config();
Forge.token(process.env.FORGE_TOKEN!);
Forge.debug();

//
