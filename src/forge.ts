import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { sleep, until, updateDotEnvString } from './lib.js';

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

type CommandPayload = {
  id: number;
  command: string;
  status: string;
  duration: string;
};

type WebhookPayload = {
  id: number;
  url: string;
};

export class ForgeError extends Error {
  axiosError: AxiosError;
  data?: unknown;
  detail?: string;

  constructor(e: AxiosError, detail?: string) {
    super(`Forge API request failed with status code ${e.response?.status}.`);
    this.name = 'ForgeError';
    this.axiosError = e;
    this.data = e.response?.data;
    this.detail = detail;
  }
}

export class Forge {
  static #token: string;
  static #debug: number = 0;
  static #client?: AxiosInstance;

  static async listServers() {
    return (await this.get<{ servers: ServerPayload[] }>('servers')).data.servers;
  }

  static async getServer(server: number) {
    return (await this.get<{ server: ServerPayload }>(`servers/${server}`)).data.server;
  }

  static async listSites(server: number) {
    return (await this.get<{ sites: SitePayload[] }>(`servers/${server}/sites`)).data.sites;
  }

  static async createSite(
    server: number,
    {
      name,
      database,
      aliases,
      isolated = false,
      username,
      php,
    }: {
      name: string;
      database: string;
      aliases?: string[];
      isolated?: boolean;
      username?: string;
      php?: string;
    },
  ) {
    return (
      await this.post<{ site: SitePayload }>(`servers/${server}/sites`, {
        domain: name,
        project_type: 'php',
        aliases,
        directory: '/public',
        isolated,
        username: username || undefined,
        database,
        php_version: php || undefined,
      })
    ).data.site;
  }

  static async getSite(server: number, site: number) {
    return (await this.get<{ site: SitePayload }>(`servers/${server}/sites/${site}`)).data.site;
  }

  static async deleteSite(server: number, site: number) {
    await this.delete(`servers/${server}/sites/${site}`);
  }

  static async listDatabases(server: number) {
    return (await this.get<{ databases: DatabasePayload[] }>(`servers/${server}/databases`)).data.databases;
  }

  static async deleteDatabase(server: number, database: number) {
    await this.delete(`servers/${server}/databases/${database}`);
  }

  static async createGitProject(server: number, site: number, repository: string, branch: string) {
    return (
      await this.post<{ site: SitePayload }>(`servers/${server}/sites/${site}/git`, {
        provider: 'github',
        composer: true,
        repository,
        branch,
      })
    ).data.site;
  }

  // TODO not positive this returns a SitePayload
  static async enableQuickDeploy(server: number, site: number) {
    return (await this.post<{ site: SitePayload }>(`servers/${server}/sites/${site}/deployment`)).data.site;
  }

  static async getDeployScript(server: number, site: number) {
    return (await this.get<string>(`servers/${server}/sites/${site}/deployment/script`)).data;
  }

  static async updateDeployScript(server: number, site: number, content: string) {
    await this.put(`servers/${server}/sites/${site}/deployment/script`, { content });
  }

  static async getEnvironmentFile(server: number, site: number) {
    return (await this.get<string>(`servers/${server}/sites/${site}/env`)).data;
  }

  // TODO not positive this returns a SitePayload
  static async updateEnvironmentFile(server: number, site: number, content: string) {
    return (await this.put<{ site: SitePayload }>(`servers/${server}/sites/${site}/env`, { content })).data.site;
  }

  static async createScheduledJob(
    server: number,
    command: string,
    frequency: string = 'minutely',
    user: string = 'forge',
  ) {
    return (
      await this.post<{ job: JobPayload }>(`servers/${server}/jobs`, {
        command,
        frequency,
        user,
      })
    ).data.job;
  }

  static async listScheduledJobs(server: number) {
    return (await this.get<{ jobs: JobPayload[] }>(`servers/${server}/jobs`)).data.jobs;
  }

  static async deleteScheduledJob(server: number, job: number) {
    await this.delete(`servers/${server}/jobs/${job}`);
  }

  static async deploy(server: number, site: number) {
    return (await this.post<{ site: SitePayload }>(`servers/${server}/sites/${site}/deployment/deploy`)).data.site;
  }

  static async createCertificate(server: number, site: number, domain: string) {
    return (
      await this.post<{ certificate: CertificatePayload }>(`servers/${server}/sites/${site}/certificates/letsencrypt`, {
        domains: [domain],
      })
    ).data.certificate;
  }

  static async installCertificate(server: number, site: number, certificate: string, key: string) {
    return (
      await this.post<{ certificate: CertificatePayload }>(`servers/${server}/sites/${site}/certificates`, {
        type: 'existing',
        certificate,
        key,
      })
    ).data.certificate;
  }

  static async cloneCertificate(server: number, site: number, certificate: number) {
    return (
      await this.post<{ certificate: CertificatePayload }>(`servers/${server}/sites/${site}/certificates`, {
        type: 'clone',
        certificate_id: certificate,
      })
    ).data.certificate;
  }

  static async listCertificates(server: number, site: number) {
    return (await this.get<{ certificates: CertificatePayload[] }>(`servers/${server}/sites/${site}/certificates`)).data
      .certificates;
  }

  static async getCertificate(server: number, site: number, certificate: number) {
    return (
      await this.get<{ certificate: CertificatePayload }>(`servers/${server}/sites/${site}/certificates/${certificate}`)
    ).data.certificate;
  }

  static async activateCertificate(server: number, site: number, certificate: number) {
    await this.post(`servers/${server}/sites/${site}/certificates/${certificate}/activate`);
  }

  static async runCommand(server: number, site: number, command: string) {
    return (await this.post<{ command: CommandPayload }>(`servers/${server}/sites/${site}/commands`, { command })).data
      .command;
  }

  static async getCommand(server: number, site: number, command: number) {
    return (
      await this.get<{ command: CommandPayload; output: string }>(`servers/${server}/sites/${site}/commands/${command}`)
    ).data;
  }

  static async createWebhook(server: number, site: number, url: string) {
    return (await this.post<{ webhook: WebhookPayload }>(`servers/${server}/sites/${site}/webhooks`, { url })).data
      .webhook;
  }

  static async setDeploymentFailureEmails(server: number, site: number, emails: string[]) {
    await this.post(`servers/${server}/sites/${site}/deployment-failure-emails`, { emails });
  }

  static token(token: string) {
    this.#token = token;
  }

  static debug(debug: number = 1) {
    this.#debug = debug;
  }

  private static client() {
    if (this.#client === undefined) {
      this.#client = axios.create({
        baseURL: 'https://forge.laravel.com/api/v1/',
        headers: {
          'User-Agent': 'bakerkretzmar/laravel-deploy-preview@v2',
          'Authorization': `Bearer ${this.#token}`,
        },
      });
      this.#client.interceptors.request.use((config) => {
        if (this.#debug > 0) {
          console.log(`> ${config.method?.toUpperCase()} /${config.url}`);
          if (this.#debug > 1 && config.data) {
            console.log(config.data);
          }
        }
        return config;
      });
      this.#client.interceptors.response.use(
        (response) => {
          if (this.#debug > 0) {
            console.log(
              `< ${response.config.method?.toUpperCase()} /${response.config.url} ${response.status} ${
                response.statusText
              }`,
            );
            if (this.#debug > 1 && response.data) {
              console.log(response.data);
            }
          }
          return response;
        },
        async (error) => {
          if (error.response?.status === 429) {
            if (this.#debug > 0) {
              console.warn('Rate-limited by Forge API, retrying in one second...');
            }
            await sleep(1);
            return this.#client!.request(error.config);
          }
          let detail = undefined;
          if (
            error.response?.status === 404 &&
            /servers\/\d+\/sites\/\d+\/certificates\/\d+/.test(error.response?.config?.url)
          ) {
            const [, server, site] = error.response.config.url.match(/servers\/(\d+)\/sites\/(\d+)/);
            detail = `A previously requested SSL certificate was not found. This may mean that automatically obtaining and installing a Let’s Encrypt certificate failed. Please review any error output in your Forge dashboard and then try again: https://forge.laravel.com/servers/${server}/sites/${site}.`;
          }
          if (this.#debug > 0) {
            console.log(
              `< ${error.response?.config.method.toUpperCase()} /${error.response?.config.url} ${error.response?.status} ${
                error.response?.statusText
              }`,
            );
            if ((this.#debug > 1 || error.response?.status === 422) && error.response?.data) {
              console.log(error.response.data);
            }
          }
          return Promise.reject(new ForgeError(error, detail));
        },
      );
    }
    return this.#client;
  }

  private static get<T = any>(path: string, params: object = {}) {
    return this.client().get<any, AxiosResponse<T, any>, any>(path, { params });
  }

  private static post<T = any>(path: string, data: object = {}) {
    return this.client().post<any, AxiosResponse<T, any>, object>(path, data);
  }

  private static put<T = any>(path: string, data: object) {
    return this.client().put<any, AxiosResponse<T, any>, object>(path, data);
  }

  private static delete<T = any>(path: string) {
    return this.client().delete<any, AxiosResponse<T, any>, any>(path);
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

  static async create(
    server: number,
    {
      name,
      database,
      aliases,
      isolated = false,
      username,
      php,
    }: {
      name: string;
      database: string;
      aliases?: string[];
      isolated?: boolean;
      username?: string;
      php?: string;
    },
  ) {
    let site = await Forge.createSite(server, { name, database, aliases, isolated, username, php });
    await until(
      () => site.status === 'installed',
      async () => (site = await Forge.getSite(server, site.id)),
    );
    return new Site(site);
  }

  async installRepository(repository: string, branch: string) {
    await Forge.createGitProject(this.server_id, this.id, repository, branch);
    // TODO error handling here could throw if this goes back to `null` after 'installing',
    // because that probably means it failed
    await until(
      () => this.repository_status !== 'installing',
      async () => this.refetch(),
      3,
    );
  }

  async setEnvironmentVariables(variables: Record<string, string | undefined>) {
    const env = await Forge.getEnvironmentFile(this.server_id, this.id);
    await Forge.updateEnvironmentFile(this.server_id, this.id, updateDotEnvString(env, variables));
  }

  async installScheduler() {
    await Forge.createScheduledJob(this.server_id, `php /home/forge/${this.name}/artisan schedule:run`);
  }

  async uninstallScheduler() {
    await Promise.all(
      (await Forge.listScheduledJobs(this.server_id))
        .filter((job) => new RegExp(`/home/forge/${this.name}/artisan`).test(job.command))
        .map(async (job) => await Forge.deleteScheduledJob(this.server_id, job.id)),
    );
  }

  async appendToDeployScript(append: string) {
    const script = await Forge.getDeployScript(this.server_id, this.id);
    // TODO does this take time to 'install'? If so what do we wait for?
    await Forge.updateDeployScript(this.server_id, this.id, `${script}\n${append}`);
  }

  async createCertificate() {
    this.certificate_id = (await Forge.createCertificate(this.server_id, this.id, this.name)).id;
  }

  async installCertificate(certificate: string, key: string) {
    this.certificate_id = (await Forge.installCertificate(this.server_id, this.id, certificate, key)).id;
  }

  async cloneCertificate(certificate: number) {
    this.certificate_id = (await Forge.cloneCertificate(this.server_id, this.id, certificate)).id;
  }

  async ensureCertificateActivated() {
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

  async enableQuickDeploy() {
    await Forge.enableQuickDeploy(this.server_id, this.id);
  }

  async deploy() {
    await Forge.deploy(this.server_id, this.id);
    await until(
      () => this.deployment_status === null,
      async () => await this.refetch(),
    );
  }

  async createWebhook(url: string) {
    await Forge.createWebhook(this.server_id, this.id, url);
  }

  async setDeploymentFailureEmails(emails: string[]) {
    await Forge.setDeploymentFailureEmails(this.server_id, this.id, emails);
  }

  // TODO figure out a way to safely+reliably figure the name out internally so it doesn't need to be passed in
  // Environment file??
  async deleteDatabase(name: string) {
    const database = (await Forge.listDatabases(this.server_id)).find((db) => db.name === name);
    if (database) {
      await Forge.deleteDatabase(this.server_id, database.id);
    }
  }

  async delete() {
    await Forge.deleteSite(this.server_id, this.id);
  }

  async refetch() {
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
