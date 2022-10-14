import { HttpClient } from '@actions/http-client';
import { BearerCredentialHandler as Bearer } from '@actions/http-client/lib/auth';
import { TypedResponse as Response } from '@actions/http-client/lib/interfaces';
import { Server, Site, Tag } from './types';

let token = '';

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

  static async createSite(server: number | string, name: string, domain: string): Promise<Site> {
    const response: Response<{ site: Site }> = await this.client().postJson(this.url(`servers/${server}/sites`), {
      domain: `${name}.${domain}`,
      project_type: 'php',
      directory: name,
      // isolated: true,
      // username: 'laravel',
      // database: 'site-com-db',
      // php_version: 'php81',
    });
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
