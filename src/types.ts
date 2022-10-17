export type InputServer = {
  id: number;
  domain: string;
};

export type ServerPayload = {
  id: number;
  name: string;
};

export type SitePayload = {
  id: number;
  server_id: number;
  name: string;
  status: string | null;
  repository_status: string | null;
  quick_deploy: boolean | null;
  deployment_status: string | null;
};
