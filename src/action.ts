import { Forge } from './forge.js';
import { InputServer } from './types.js';
import { retryUntil } from './helpers.js';

export async function run(name: string, repository: string, servers: InputServer[]): Promise<boolean> {
  const server = servers[0];

  // const sites = (await Promise.all(servers.map(async (server) => await Forge.sites(server.id)))).flat();
  const sites = await Forge.sites(server.id);

  const extantSite = sites.find((site) => site.name === name);

  if (extantSite) {
    // re-use existing site
    console.log('Site exists');
  } else {
    console.log('Creating new site');

    const database = name.replace(/-/g, '_').replace(/[^\w_]/g, '');

    let site = await Forge.createSite(server.id, name, server.domain, database);

    const refreshSite = async () => {
      site = await Forge.site(server.id, site.id);
    };

    await retryUntil(() => site.status !== 'installing', refreshSite);
    console.log('Site installed!');

    console.log('Creating new Git project');
    await Forge.createProject(server.id, site.id, repository, name);
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

  return true;
}
