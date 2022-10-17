import { HttpClient, HttpClientResponse } from '@actions/http-client';
import { BearerCredentialHandler as Bearer } from '@actions/http-client/lib/auth.js';
import { TypedResponse as Response } from '@actions/http-client/lib/interfaces.js';
import { ServerPayload, SitePayload } from './types.js';

export class Forge {
  static #token?: string;
  static #client?: HttpClient;

  static setToken(token: string): void {
    this.#token = token;
  }

  static async servers(): Promise<ServerPayload[]> {
    const response: Response<{ servers: ServerPayload[] }> = await this.client().getJson(this.url('servers'));
    return response.result.servers;
  }

  static async server(server: number | string): Promise<ServerPayload> {
    const response: Response<{ server: ServerPayload }> = await this.client().getJson(this.url(`servers/${server}`));
    return response.result.server;
  }

  static async sites(server: number | string): Promise<SitePayload[]> {
    const response: Response<{ sites: SitePayload[] }> = await this.client().getJson(
      this.url(`servers/${server}/sites`)
    );
    return response.result.sites;
  }

  static async createSite(
    server: number | string,
    name: string,
    domain: string,
    database: string
  ): Promise<SitePayload> {
    const response: Response<{ site: SitePayload }> = await this.client().postJson(
      this.url(`servers/${server}/sites`),
      {
        domain: `${name}.${domain}`,
        project_type: 'php',
        directory: '/public',
        database,
      }
    );
    return response.result.site;
  }

  static async site(server: number | string, site: number | string): Promise<SitePayload> {
    const response: Response<{ site: SitePayload }> = await this.client().getJson(
      this.url(`servers/${server}/sites/${site}`)
    );
    return response.result.site;
  }

  static async createProject(
    server: number | string,
    site: number | string,
    repository: string,
    branch: string
  ): Promise<SitePayload> {
    const response: Response<{ site: SitePayload }> = await this.client().postJson(
      this.url(`servers/${server}/sites/${site}/git`),
      {
        provider: 'github',
        repository,
        branch,
        composer: true,
      }
    );
    return response.result.site;
  }

  static async deployScript(server: number, site: number): Promise<string> {
    const response: HttpClientResponse = await this.client().get(
      this.url(`servers/${server}/sites/${site}/deployment/script`)
    );
    return response.readBody();
  }

  static async setDeployScript(server: number, site: number, content: string): Promise<void> {
    const response: Response<any> = await this.client().putJson(
      this.url(`servers/${server}/sites/${site}/deployment/script`),
      {
        content,
      }
    );
  }

  static async autoDeploy(server: number | string, site: number | string): Promise<void> {
    await this.client().postJson(this.url(`servers/${server}/sites/${site}/deployment`), {});
  }

  static async dotEnv(server: number | string, site: number | string): Promise<string> {
    const response: HttpClientResponse = await this.client().get(this.url(`servers/${server}/sites/${site}/env`));
    return response.readBody();
  }

  static async setDotEnv(server: number | string, site: number | string, content: string): Promise<void> {
    const response: Response<any> = await this.client().putJson(this.url(`servers/${server}/sites/${site}/env`), {
      content,
    });
  }

  static async deploy(server: number | string, site: number | string): Promise<SitePayload> {
    const response: Response<{ site: SitePayload }> = await this.client().postJson(
      this.url(`servers/${server}/sites/${site}/deployment/deploy`),
      {}
    );
    return response.result.site;
  }

  static async createJob(
    server: number,
    command: string,
    frequency: string = 'minutely',
    user: string = 'forge'
  ): Promise<any> {
    const response: Response<any> = await this.client().postJson(this.url(`servers/${server}/jobs`), {
      command,
      frequency,
      user,
    });
    return response.result;
  }

  private static url(path: string): string {
    return `https://forge.laravel.com/api/v1/${path}`;
  }

  private static client(): HttpClient {
    if (this.#client === undefined) {
      this.#client = new HttpClient('@tighten/laravel-deploy-preview', [new Bearer(this.#token)]);
    }
    return this.#client;
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

  static async create(id: number, domain: string): Promise<Server> {
    const data = await Forge.server(id);
    return new Server(domain, data);
  }

  async loadSites(): Promise<void> {
    const sites = await Forge.sites(this.id);
    this.sites = sites.map((data) => new Site(data));
  }

  async createSite(name: string, database: string): Promise<Site> {
    const data = await Forge.createSite(this.id, name, this.domain, database);
    return new Site(data);
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

  async createProject(name: string, repository: string): Promise<void> {
    const data = await Forge.createProject(this.server_id, this.id, repository, name);
    this.id = data.id;
    this.server_id = data.server_id;
    this.name = data.name;
    this.status = data.status;
    this.repository_status = data.repository_status;
    this.quick_deploy = data.quick_deploy;
    this.deployment_status = data.deployment_status;
  }

  async updateEnvironmentVariable(name: string, value: string): Promise<void> {
    const env = await Forge.dotEnv(this.server_id, this.id);
    await Forge.setDotEnv(this.server_id, this.id, env.replace(new RegExp(`/${name}=.*?\n/`), `${name}=${value}\n`));
  }

  async appendToDeployScript(append: string): Promise<void> {
    const script = await Forge.deployScript(this.server_id, this.id);
    await Forge.setDeployScript(this.server_id, this.id, `${script}\n${append}`);
  }

  async enableQuickDeploy(): Promise<void> {
    await Forge.autoDeploy(this.server_id, this.id);
  }

  async deploy(): Promise<void> {
    await Forge.deploy(this.server_id, this.id);
  }

  async enableScheduler(): Promise<void> {
    console.log(await Forge.createJob(this.server_id, `php /home/forge/${this.name}/artisan schedule:run`));
  }

  async refetch(): Promise<void> {
    const data = await Forge.site(this.server_id, this.id);
    this.id = data.id;
    this.server_id = data.server_id;
    this.name = data.name;
    this.status = data.status;
    this.repository_status = data.repository_status;
    this.quick_deploy = data.quick_deploy;
    this.deployment_status = data.deployment_status;
  }
}
