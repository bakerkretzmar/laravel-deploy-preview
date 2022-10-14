import * as core from '@actions/core';
import * as github from '@actions/github';
import { map } from 'lodash';
import { Forge } from './src/forge';
import { Server, Site } from './src/types';

// inputs:
// - forge api token
// - server tag
// - base domain (to put subdomains under)

const tag = 'personal';
const domain = 'example.com';

const name = 'foo'; // generate from github refs

const servers = await Forge.servers();
// console.log(servers);

const sites = (await Promise.all(servers.map(async (server) => await Forge.sites(server.id)))).flat();
// console.log(sites);

const extantSite = sites.find((site) => site.name === name);

if (extantSite) {
  // re-use existing site
} else {
  console.log('Creating new site');

  // const server = serverWithFewestSites(servers, sites);

  let site = await Forge.createSite(server.id, name, domain);

  const refreshSite = async () => {
    site = await Forge.site(server.id, site.id);
  };

  await retryUntil(() => site.status !== 'installing', refreshSite);
  console.log('Site installed!');

  console.log('Creating new Git project');
  await retryUntil(() => site.repository_status !== 'installing', refreshSite);
  console.log('Repository installed!');

  console.log('Updating .env file');
  const env = await Forge.dotEnv(server.id, site.id);
  await Forge.setDotEnv(server.id, site.id, env.replace(/DB_DATABASE=.*?\n/, `DB_DATABASE=${name}\n`));
  console.log('Updated .env file!');

  // Tweak deployment script?

  console.log('Enabling Quick Deploy');
  await Forge.autoDeploy(server.id, site.id);
  await retryUntil(() => site.quick_deploy !== false, refreshSite);
  console.log('Quick Deploy enabled!');

  console.log('Deploying site');
  await Forge.deploy(server.id, site.id);
  await retryUntil(() => site.deployment_status === null, refreshSite);
  console.log('Site deployed!');

  console.log({ site });
}

async function retryUntil(condition: () => boolean, attempt: () => void, pause: number = 2) {
  await attempt();
  while (!condition()) {
    await sleep(pause);
    await attempt();
  }
}

function serverWithFewestSites(servers: Server[], sites: Site[]): Server {
  const serverSites = sites.reduce((carry: { [_: string]: number }, site: Site) => {
    carry[site.server_id] ??= 0;
    carry[site.server_id]++;
    return carry;
  }, {});

  let count = 0;
  const server = Object.entries(serverSites).reduce((carry: string, server: [string, number]): string => {
    try {
      return server[1] < count ? server[0] : carry;
    } finally {
      count = server[1];
    }
  }, Object.keys(serverSites)[0]);

  return servers.find(({ id }) => id === Number(server));
}

function sleep(s: number): Promise<void> {
  return new Promise((r) => setTimeout(r, s * 1000));
}
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
