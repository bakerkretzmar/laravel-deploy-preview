import { HttpClient } from '@actions/http-client';
import { BearerCredentialHandler as Bearer } from '@actions/http-client/lib/auth';
import { TypedResponse as Res } from '@actions/http-client/lib/interfaces';

let token = '';

type Tag = {
  id: number;
  name: string;
};

type Server = {
  id: number;
  tags: Tag[];
};

type Site = {
  id: number;
  tags: Tag[];
};

export class Forge {
  static #client?: HttpClient;

  static async servers(): Promise<Server[]> {
    const response: Res<{ servers: Server[] }> = await this.client().getJson(this.url('servers'));
    return response.result.servers;
  }

  static async sites(server: number | string): Promise<Site[]> {
    const response: Res<{ sites: Site[] }> = await this.client().getJson(this.url(`servers/${server}/sites`));
    return response.result.sites;
  }

  static async serversWithTag(tag: string): Promise<Server[]> {
    const servers = await this.servers();
    return servers.filter((s: Server) => s.tags.some((t: Tag) => t.name === tag));
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
