import axios, { AxiosInstance } from 'axios';
import { until } from './helpers.js';

type ServerPayload = {
  id: number;
  name: string;
};

type SitePayload = {
  id: number;
  server_id: number;
  name: string;
  status: string | null;
  repository_status: string | null;
  quick_deploy: boolean | null;
  deployment_status: string | null;
};

type JobPayload = {
  id: number;
  command: string;
  status: string;
};

export class Forge {
  static #token: string;
  static #client?: AxiosInstance;

  static async listServers(): Promise<ServerPayload[]> {
    return (await this.get('servers')).data;
  }

  static async getServer(server: number): Promise<ServerPayload> {
    return (await this.get(`servers/${server}`)).data;
  }

  static async listSites(server: number): Promise<SitePayload[]> {
    return (await this.get(`servers/${server}/sites`)).data;
  }

  static async createSite(server: number, name: string, database: string): Promise<SitePayload> {
    return (
      await this.post(`servers/${server}/sites`, {
        domain: name,
        project_type: 'php',
        directory: '/public',
        database,
      })
    ).data;
  }

  static async getSite(server: number, site: number): Promise<SitePayload> {
    return (await this.get(`servers/${server}/sites/${site}`)).data;
  }

  static async createGitProject(
    server: number,
    site: number,
    repository: string,
    branch: string
  ): Promise<SitePayload> {
    return (
      await this.post(`servers/${server}/sites/${site}/git`, {
        provider: 'github',
        composer: true,
        repository,
        branch,
      })
    ).data;
  }

  // Not positive this returns a SitePayload
  static async enableQuickDeploy(server: number, site: number): Promise<SitePayload> {
    return (await this.post(`servers/${server}/sites/${site}/deployment`)).data;
  }

  static async getDeployScript(server: number, site: number): Promise<string> {
    return (await this.get(`servers/${server}/sites/${site}/deployment/script`)).data;
  }

  // Not positive this returns a SitePayload
  static async updateDeploymentScript(server: number, site: number, content: string): Promise<SitePayload> {
    return (await this.put(`servers/${server}/sites/${site}/deployment/script`, { content })).data;
  }

  static async getEnvironmentFile(server: number, site: number): Promise<string> {
    return (await this.get(`servers/${server}/sites/${site}/env`)).data;
  }

  // Not positive this returns a SitePayload
  static async updateEnvironmentFile(server: number, site: number, content: string): Promise<SitePayload> {
    return (await this.put(`servers/${server}/sites/${site}/env`, { content })).data;
  }

  static async createScheduledJob(
    server: number,
    command: string,
    frequency: string = 'minutely',
    user: string = 'forge'
  ): Promise<JobPayload> {
    return (
      await this.post(`servers/${server}/jobs`, {
        command,
        frequency,
        user,
      })
    ).data;
  }

  static async deploy(server: number, site: number): Promise<SitePayload> {
    return (await this.post(`servers/${server}/sites/${site}/deployment/deploy`)).data;
  }

  static setToken(token: string): void {
    this.#token = token;
  }

  private static client(): AxiosInstance {
    if (this.#client === undefined) {
      this.#client = axios.create({
        baseURL: 'https://forge.laravel.com/api/v1/',
        headers: {
          'User-Agent': '@tighten/laravel-deploy-preview',
          'Authorization': `Bearer ${this.#token}`,
        },
      });
    }
    return this.#client;
  }

  private static get(path: string) {
    return this.client().get(path);
  }

  private static post(path: string, data: object = {}) {
    return this.client().post(path, data);
  }

  private static put(path: string, data: object) {
    return this.client().get(path, data);
  }
}

export class Server {
  id: number;
  name: string;
  domain: string;

  sites?: Site[];

  constructor(domain: string, data: ServerPayload) {
    this.id = data.id;
    this.name = data.name;
    this.domain = domain;
  }

  static async fetch(id: number, domain: string): Promise<Server> {
    return new Server(domain, await Forge.getServer(id));
  }

  async loadSites(): Promise<void> {
    this.sites = (await Forge.listSites(this.id)).map((data) => new Site(data));
  }

  async createSite(name: string, database: string): Promise<Site> {
    const site = new Site(await Forge.createSite(this.id, `${name}.${this.domain}`, database));
    await until(
      () => site.status === 'installed',
      async () => await site.refetch()
    );
    return site;
  }
}

export class Site {
  id: number;
  server_id: number;
  name: string;
  status: string | null;
  repository_status: string | null;
  quick_deploy: boolean | null;
  deployment_status: string | null;

  constructor(data: SitePayload) {
    this.id = data.id;
    this.server_id = data.server_id;
    this.name = data.name;
    this.status = data.status;
    this.repository_status = data.repository_status;
    this.quick_deploy = data.quick_deploy;
    this.deployment_status = data.deployment_status;
  }

  async installRepository(repository: string, branch: string): Promise<void> {
    await Forge.createGitProject(this.server_id, this.id, repository, branch);
    await until(
      () => this.repository_status === 'installed',
      async () => this.refetch(),
      3
    );
  }

  async setEnvironmentVariable(name: string, value: string): Promise<void> {
    const env = await Forge.getEnvironmentFile(this.server_id, this.id);
    await Forge.updateEnvironmentFile(
      this.server_id,
      this.id,
      env.replace(new RegExp(`/${name}=.*?\n/`), `${name}=${value}\n`)
    );
  }

  async enableScheduler(): Promise<void> {
    await Forge.createScheduledJob(this.server_id, `php /home/forge/${this.name}/artisan schedule:run`);
  }

  async appendToDeployScript(append: string): Promise<void> {
    const script = await Forge.getDeployScript(this.server_id, this.id);
    // TODO does this take time to 'install'? If so what do we wait for?
    console.log(await Forge.updateDeploymentScript(this.server_id, this.id, `${script}\n${append}`));
  }

  async enableQuickDeploy(): Promise<void> {
    await Forge.enableQuickDeploy(this.server_id, this.id);
  }

  async deploy(): Promise<void> {
    await Forge.deploy(this.server_id, this.id);
    await until(
      () => this.deployment_status === null,
      async () => await this.refetch()
    );
  }

  async refetch(): Promise<void> {
    const data = await Forge.getSite(this.server_id, this.id);
    this.id = data.id;
    this.server_id = data.server_id;
    this.name = data.name;
    this.status = data.status;
    this.repository_status = data.repository_status;
    this.quick_deploy = data.quick_deploy;
    this.deployment_status = data.deployment_status;
  }
}
