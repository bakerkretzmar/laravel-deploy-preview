import { Forge, Server } from './forge.js';
import { until } from './helpers.js';

type ActionConfig = {
  name: string;
  repository: string;
  servers: Array<{ id: number; domain: string }>;
  afterDeploy?: string;
  info?: Function;
  debug?: Function;
  local?: boolean;
};

type DeployPreview = {
  url: string;
};

export async function run({
  name,
  repository,
  servers,
  afterDeploy = '',
  info = console.log,
  debug = console.log,
  local = false,
}: ActionConfig): Promise<DeployPreview> {
  debug(`Loading server with ID ${servers[0].id}`);
  const server = await Server.fetch(servers[0].id, servers[0].domain);
  // const sites = (await Promise.all(servers.map(async (server) => await Forge.sites(server.id)))).flat();
  debug(`Loading sites for server ${server.id}`);
  await server.loadSites();

  debug(`Checking for site named '${name}'`);
  const extantSite = server.sites.find((site) => site.name === name);

  if (extantSite) {
    // re-use existing site
    info('Site exists');
  } else {
    const database = name.replace(/-/g, '_').replace(/[^\w_]/g, '');
    debug(`Sanitized database name: '${database}'`);

    info(`Creating new deploy preview site named '${name}'`);
    const site = await server.createSite(name, database);
    info('Site created!');

    info(`Installing '${repository}' Git repository in site`);
    await site.installRepository(repository, local ? 'main' : name);
    info('Repository installed!');

    info('Updating .env file');
    await site.setEnvironmentVariable('DB_DATABASE', database);
    info('Updated .env file!');

    info('Setting up scheduler');
    await site.enableScheduler();
    info('Scheduled job command set up!');

    if (afterDeploy) {
      info('Updating deploy script');
      await site.appendToDeployScript(afterDeploy);
      info('Updated deploy script!');
    }

    info('Enabling Quick Deploy');
    await site.enableQuickDeploy();
    info('Quick Deploy enabled!');

    info('Deploying site');
    await site.deploy();
    info('Site deployed!');

    return { url: `http://${site.name}` };
  }
}