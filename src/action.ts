import { Server } from './forge.js';

type CreateConfig = {
  name: string;
  repository: string;
  servers: Array<{ id: number; domain: string }>;
  afterDeploy?: string;
  environment?: Record<string, string>;
  info?: Function;
  debug?: Function;
  local?: boolean;
};

type DestroyConfig = {
  name: string;
  servers: Array<{ id: number; domain: string }>;
  info?: Function;
  debug?: Function;
  local?: boolean;
};

type DeployPreview = {
  url: string;
};

export async function createPreview({
  name,
  repository,
  servers,
  afterDeploy = '',
  environment = {},
  info = console.log,
  debug = console.log,
  local = false,
}: CreateConfig): Promise<DeployPreview> {
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

    info('Obtaining SSL certificate');
    await site.installCertificate();
    info('SSL certificate obtained!');

    info(`Installing '${repository}' Git repository in site`);
    await site.installRepository(repository, local ? 'main' : name);
    info('Repository installed!');

    info('Updating .env file');
    await site.setEnvironmentVariables({
      DB_DATABASE: database,
      ...environment,
    });
    info('Updated .env file!');

    info('Setting up scheduler');
    await site.installScheduler();
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

    info('Cleaning up...');

    debug('Ensuring SSL certificate activated');
    await site.ensureCertificateActivated();

    return { url: `https://${site.name}` };
  }
}

export async function destroyPreview({
  name,
  servers,
  info = console.log,
  debug = console.log,
}: DestroyConfig): Promise<void> {
  debug(`Loading server with ID ${servers[0].id}`);
  const server = await Server.fetch(servers[0].id, servers[0].domain);

  debug(`Loading sites for server ${server.id}`);
  await server.loadSites();

  debug(`Checking for site named '${name}'`);
  const site = server.sites.find((site) => site.name === `${name}.${server.domain}`);

  if (site) {
    info('Site exists');

    info('Cleaning up scheduler');
    await site.uninstallScheduler();
    info('Scheduled job command uninstalled!');

    info('Deleting site');
    await site.delete();
    info('Site deleted!');

    info('Deleting database');
    await site.deleteDatabase(name.replace(/-/g, '_').replace(/[^\w_]/g, ''));
    info('Database deleted!');
  }
}
