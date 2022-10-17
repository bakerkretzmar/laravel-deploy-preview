import { Forge, Server } from './forge.js';
import { InputServer } from './types.js';
import { retryUntil } from './helpers.js';

export async function run(name: string, repository: string, servers: InputServer[]): Promise<boolean> {
  const server = await Server.create(servers[0].id, servers[0].domain);
  // const sites = (await Promise.all(servers.map(async (server) => await Forge.sites(server.id)))).flat();
  await server.loadSites();

  const extantSite = server.sites.find((site) => site.name === name);

  if (extantSite) {
    // re-use existing site
    console.log('Site exists');
  } else {
    console.log('Creating new site');

    const database = name.replace(/-/g, '_').replace(/[^\w_]/g, '');

    const site = await server.createSite(name, database);
    console.log(site);

    // TODO site.waitUntilInstalled()
    // no, actually just do this inside createSite
    await retryUntil(
      () => site.status !== 'installing',
      async () => await site.refetch()
    );
    console.log('Site installed!');

    console.log('Creating new Git project');
    // TODO name, not 'main'
    await site.createProject('main', repository);
    await retryUntil(
      () => site.repository_status !== 'installing',
      async () => await site.refetch()
    );
    console.log('Repository installed!');

    console.log('Updating .env file');
    await site.updateEnvironmentVariable('DB_DATABASE', database);
    console.log('Updated .env file!');

    // Tweak deployment script?

    console.log('Enabling Quick Deploy');
    await site.enableQuickDeploy();
    await retryUntil(
      () => site.quick_deploy !== false,
      async () => await site.refetch()
    );
    console.log('Quick Deploy enabled!');

    console.log('Deploying site');
    await site.deploy();
    await retryUntil(
      () => site.deployment_status === null,
      async () => await site.refetch()
    );
    console.log('Site deployed!');

    console.log({ site });
  }

  return true;
}
