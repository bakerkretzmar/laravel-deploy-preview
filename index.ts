import core from '@actions/core';
import github from '@actions/github';
import { map } from 'lodash';
import { Forge } from './src/forge';

const servers = await Forge.serversWithTag('personal');
console.log(servers);

const sites = servers.map(async (s) => console.log(await Forge.sites(s.id)));
console.log(sites);

// try {
//   // `who-to-greet` input defined in action metadata file
//   const nameToGreet = core.getInput('who-to-greet');
//   console.log(`Hello ${nameToGreet}!`);
//   const time = new Date().toTimeString();
//   core.setOutput('time', time);
//   // Get the JSON webhook payload for the event that triggered the workflow
//   const payload = JSON.stringify(github.context.payload, undefined, 2);
//   console.log(`The event payload: ${payload}`);
// } catch (error) {
//   core.setFailed(error.message);
// }
