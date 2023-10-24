import axios, { AxiosError, AxiosInstance } from 'axios';
import { until } from './lib.js';

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

type CertificatePayload = {
  id: number;
  status: string;
  activation_status?: string | null;
  active: boolean;
};

type DatabasePayload = {
  id: number;
  name: string;
};

class ForgeError extends Error {
  axiosError: AxiosError;
  data?: unknown;

  constructor(e: AxiosError) {
    super(`Forge API request failed with status code ${e.response?.status}.`);
    this.name = 'ForgeError';
    this.axiosError = e;
    this.data = e.response?.data;
  }
}

export class Forge {
  static #token: string;
  static #client?: AxiosInstance;

  static async listServers(): Promise<ServerPayload[]> {
    return (await this.get('servers')).data.servers;
  }

  static async getServer(server: number): Promise<ServerPayload> {
    return (await this.get(`servers/${server}`)).data.server;
  }

  static async listSites(server: number): Promise<SitePayload[]> {
    return (await this.get(`servers/${server}/sites`)).data.sites;
  }

  static async createSite(server: number, name: string, database: string): Promise<SitePayload> {
    return (
      await this.post(`servers/${server}/sites`, {
        domain: name,
        project_type: 'php',
        directory: '/public',
        database,
      })
    ).data.site;
  }

  static async getSite(server: number, site: number): Promise<SitePayload> {
    return (await this.get(`servers/${server}/sites/${site}`)).data.site;
  }

  static async deleteSite(server: number, site: number): Promise<void> {
    await this.delete(`servers/${server}/sites/${site}`);
  }

  static async listDatabases(server: number): Promise<DatabasePayload[]> {
    return (await this.get(`servers/${server}/databases`)).data.databases;
  }

  static async deleteDatabase(server: number, database: number): Promise<void> {
    await this.delete(`servers/${server}/databases/${database}`);
  }

  static async createGitProject(
    server: number,
    site: number,
    repository: string,
    branch: string,
  ): Promise<SitePayload> {
    return (
      await this.post(`servers/${server}/sites/${site}/git`, {
        provider: 'github',
        composer: true,
        repository,
        branch,
      })
    ).data.site;
  }

  // Not positive this returns a SitePayload
  static async enableQuickDeploy(server: number, site: number): Promise<SitePayload> {
    return (await this.post(`servers/${server}/sites/${site}/deployment`)).data.site;
  }

  static async getDeployScript(server: number, site: number): Promise<string> {
    return (await this.get(`servers/${server}/sites/${site}/deployment/script`)).data;
  }

  static async updateDeployScript(server: number, site: number, content: string): Promise<void> {
    await this.put(`servers/${server}/sites/${site}/deployment/script`, { content });
  }

  static async getEnvironmentFile(server: number, site: number): Promise<string> {
    return (await this.get(`servers/${server}/sites/${site}/env`)).data;
  }

  // Not positive this returns a SitePayload
  static async updateEnvironmentFile(server: number, site: number, content: string): Promise<SitePayload> {
    return (await this.put(`servers/${server}/sites/${site}/env`, { content })).data.site;
  }

  static async createScheduledJob(
    server: number,
    command: string,
    frequency: string = 'minutely',
    user: string = 'forge',
  ): Promise<JobPayload> {
    return (
      await this.post(`servers/${server}/jobs`, {
        command,
        frequency,
        user,
      })
    ).data.job;
  }

  static async listScheduledJobs(server: number): Promise<JobPayload[]> {
    return (await this.get(`servers/${server}/jobs`)).data.jobs;
  }

  static async deleteScheduledJob(server: number, job: number): Promise<void> {
    await this.delete(`servers/${server}/jobs/${job}`);
  }

  static async deploy(server: number, site: number): Promise<SitePayload> {
    return (await this.post(`servers/${server}/sites/${site}/deployment/deploy`)).data.site;
  }

  static async installExistingCertificate(
    server: number,
    site: number,
    certificate: string,
    key: string,
  ): Promise<CertificatePayload> {
    return (
      await this.post(`servers/${server}/sites/${site}/certificates`, {
        type: 'existing',
        certificate,
        key,
      })
    ).data.certificate;
  }

  static async cloneExistingCertificate(
    server: number,
    site: number,
    certificate: number,
  ): Promise<CertificatePayload> {
    return (
      await this.post(`servers/${server}/sites/${site}/certificates`, {
        type: 'clone',
        certificate_id: certificate,
      })
    ).data.certificate;
  }

  static async obtainCertificate(server: number, site: number, domain: string): Promise<CertificatePayload> {
    return (await this.post(`servers/${server}/sites/${site}/certificates/letsencrypt`, { domains: [domain] })).data
      .certificate;
  }

  static async listCertificates(server: number, site: number): Promise<CertificatePayload[]> {
    return (await this.get(`servers/${server}/sites/${site}/certificates`)).data.certificates;
  }

  static async getCertificate(server: number, site: number, certificate: number): Promise<CertificatePayload> {
    return (await this.get(`servers/${server}/sites/${site}/certificates/${certificate}`)).data.certificate;
  }

  static async activateCertificate(server: number, site: number, certificate: number): Promise<void> {
    await this.post(`servers/${server}/sites/${site}/certificates/${certificate}/activate`);
  }

  static setToken(token: string): void {
    this.#token = token;
  }

  private static client(): AxiosInstance {
    if (this.#client === undefined) {
      this.#client = axios.create({
        baseURL: 'https://forge.laravel.com/api/v1/',
        headers: {
          'User-Agent': 'bakerkretzmar/laravel-deploy-preview@v2',
          'Authorization': `Bearer ${this.#token}`,
        },
      });
      this.#client.interceptors.response.use(
        (response) => response,
        (error) => Promise.reject(new ForgeError(error)),
      );
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
    return this.client().put(path, data);
  }

  private static delete(path: string) {
    return this.client().delete(path);
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
      async () => await site.refetch(),
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

  certificate_id?: number;

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
    // TODO error handling here could throw if this goes back to `null` after 'installing',
    // because that probably means it failed
    await until(
      () => this.repository_status !== 'installing',
      async () => this.refetch(),
      3,
    );
  }

  async setEnvironmentVariables(variables: Record<string, string>): Promise<void> {
    let env = await Forge.getEnvironmentFile(this.server_id, this.id);
    Object.entries(variables).map(([key, value]) => {
      if (new RegExp(`${key}=`).test(env)) {
        env = env.replace(new RegExp(`${key}=.*`), `${key}=${value}`);
      } else {
        env += `\n${key}=${value}\n`;
      }
    });
    await Forge.updateEnvironmentFile(this.server_id, this.id, env);
  }

  async installScheduler(): Promise<void> {
    await Forge.createScheduledJob(this.server_id, `php /home/forge/${this.name}/artisan schedule:run`);
  }

  async uninstallScheduler(): Promise<void> {
    const jobs = await Forge.listScheduledJobs(this.server_id);
    await Promise.all(
      jobs
        .filter((job) => new RegExp(`/home/forge/${this.name}/artisan`).test(job.command))
        .map(async (job) => await Forge.deleteScheduledJob(this.server_id, job.id)),
    );
  }

  async appendToDeployScript(append: string): Promise<void> {
    const script = await Forge.getDeployScript(this.server_id, this.id);
    // TODO does this take time to 'install'? If so what do we wait for?
    await Forge.updateDeployScript(this.server_id, this.id, `${script}\n${append}`);
  }

  async obtainCertificate(): Promise<void> {
    this.certificate_id = (await Forge.obtainCertificate(this.server_id, this.id, this.name)).id;
  }

  async installExistingCertificate(certificate: string, key: string): Promise<void> {
    this.certificate_id = (await Forge.installExistingCertificate(this.server_id, this.id, certificate, key)).id;
  }

  async cloneExistingCertificate(certificate: number): Promise<void> {
    this.certificate_id = (await Forge.cloneExistingCertificate(this.server_id, this.id, certificate)).id;
  }

  async ensureCertificateActivated(): Promise<void> {
    if (this.certificate_id) {
      const cert_id = this.certificate_id;
      let certificate = await Forge.getCertificate(this.server_id, this.id, cert_id);
      await until(
        () => certificate.active,
        async () => {
          if (!certificate.activation_status) {
            await Forge.activateCertificate(this.server_id, this.id, cert_id);
          }
          certificate = await Forge.getCertificate(this.server_id, this.id, cert_id);
        },
      );
    }
  }

  async enableQuickDeploy(): Promise<void> {
    await Forge.enableQuickDeploy(this.server_id, this.id);
  }

  async deploy(): Promise<void> {
    await Forge.deploy(this.server_id, this.id);
    await until(
      () => this.deployment_status === null,
      async () => await this.refetch(),
    );
  }

  // TODO figure out a way to safely+reliably figure the name out internally so it doesn't need to be passed in
  // Environment file??
  async deleteDatabase(name: string): Promise<void> {
    const database = (await Forge.listDatabases(this.server_id)).find((db) => db.name === name);
    if (database) {
      await Forge.deleteDatabase(this.server_id, database.id);
    }
  }

  async delete(): Promise<void> {
    await Forge.deleteSite(this.server_id, this.id);
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
