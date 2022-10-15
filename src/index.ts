import * as core from '@actions/core';
import * as github from '@actions/github';
import { PullRequestEvent } from '@octokit/webhooks-definitions/schema.js';
import { Forge } from './forge.js';
import { Server, Site } from './types.js';

const payload = github.context.payload as PullRequestEvent;
core.info(`The PR branch is is: ${payload.pull_request.head.ref}`);

const serverId = core.getInput('server', { required: true }); // 600058
const domain = core.getInput('domain', { required: true }); // bee.limo

const name = payload.pull_request.head.ref;

const server = { id: serverId };

// const sites = (await Promise.all(servers.map(async (server) => await Forge.sites(server.id)))).flat();
const sites = await Forge.sites(server.id);

const extantSite = sites.find((site) => site.name === name);

if (extantSite) {
  // re-use existing site
  console.log('Site exists');
} else {
  console.log('Creating new site');

  const database = name.replace(/-/g, '_').replace(/[^\w_]/g, '');

  let site = await Forge.createSite(server.id, name, domain, database);

  const refreshSite = async () => {
    site = await Forge.site(server.id, site.id);
  };

  await retryUntil(() => site.status !== 'installing', refreshSite);
  console.log('Site installed!');

  console.log('Creating new Git project');
  await Forge.createProject(server.id, site.id, payload.repository.full_name, name);
  await retryUntil(() => site.repository_status !== 'installing', refreshSite);
  console.log('Repository installed!');

  console.log('Updating .env file');
  const env = await Forge.dotEnv(server.id, site.id);
  await Forge.setDotEnv(server.id, site.id, env.replace(/DB_DATABASE=.*?\n/, `DB_DATABASE=${database}\n`));
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

// function serverWithFewestSites(servers: Server[], sites: Site[]): Server {
//   const serverSites = sites.reduce((carry: { [_: string]: number }, site: Site) => {
//     carry[site.server_id] ??= 0;
//     carry[site.server_id]++;
//     return carry;
//   }, {});

//   let count = 0;
//   const server = Object.entries(serverSites).reduce((carry: string, server: [string, number]): string => {
//     try {
//       return server[1] < count ? server[0] : carry;
//     } finally {
//       count = server[1];
//     }
//   }, Object.keys(serverSites)[0]);

//   return servers.find(({ id }) => id === Number(server));
// }

function sleep(s: number): Promise<void> {
  return new Promise((r) => setTimeout(r, s * 1000));
}
