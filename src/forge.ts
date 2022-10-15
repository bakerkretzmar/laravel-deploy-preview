import * as core from '@actions/core';
import { HttpClient, HttpClientResponse } from '@actions/http-client';
import { BearerCredentialHandler as Bearer } from '@actions/http-client/lib/auth.js';
import { TypedResponse as Response } from '@actions/http-client/lib/interfaces.js';
import { Server, Site, Tag } from './types.js';

const token = core.getInput('forge-token');

export class Forge {
  static #client?: HttpClient;

  static async servers(): Promise<Server[]> {
    const response: Response<{ servers: Server[] }> = await this.client().getJson(this.url('servers'));
    return response.result.servers;
  }

  static async sites(server: number | string): Promise<Site[]> {
    const response: Response<{ sites: Site[] }> = await this.client().getJson(this.url(`servers/${server}/sites`));
    return response.result.sites;
  }

  static async serversWithTag(tag: string): Promise<Server[]> {
    const servers = await this.servers();
    return servers.filter((s: Server) => s.tags.some((t: Tag) => t.name === tag));
  }

  static async createSite(server: number | string, name: string, domain: string, database: string): Promise<Site> {
    const response: Response<{ site: Site }> = await this.client().postJson(this.url(`servers/${server}/sites`), {
      domain: `${name}.${domain}`,
      project_type: 'php',
      directory: '/public',
      database,
    });
    return response.result.site;
  }

  static async site(server: number | string, site: number | string): Promise<Site> {
    const response: Response<{ site: Site }> = await this.client().getJson(this.url(`servers/${server}/sites/${site}`));
    return response.result.site;
  }

  static async createProject(
    server: number | string,
    site: number | string,
    repository: string,
    branch: string
  ): Promise<Site> {
    const response: Response<{ site: Site }> = await this.client().postJson(
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

  static async deploy(server: number | string, site: number | string): Promise<Site> {
    const response: Response<{ site: Site }> = await this.client().postJson(
      this.url(`servers/${server}/sites/${site}/deployment/deploy`),
      {}
    );
    return response.result.site;
  }

  private static url(path: string): string {
    return `https://forge.laravel.com/api/v1/${path}`;
  }

  private static client(): HttpClient {
    if (this.#client === undefined) {
      this.#client = new HttpClient('@tighten/laravel-deploy-preview', [new Bearer(token)]);
    }
    return this.#client;
  }
}
