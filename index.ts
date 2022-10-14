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
  // create new site
  const server = serverWithFewestSites(servers, sites);

  const site = await Forge.createSite(server.id, name, domain);
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

console.log(serverWithFewestSites(servers, sites));

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
