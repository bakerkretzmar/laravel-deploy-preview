export type InputServer = {
  id: number;
  domain: string;
};

export type Server = {
  id: number;
  name: string;
  tags: Tag[];
  sites?: Site[];
};

export type Site = {
  id: number;
  server_id: number;
  name: string;
  status: string | null;
  repository_status: string | null;
  quick_deploy: boolean | null;
  deployment_status: string | null;
  tags: Tag[];
};

export type Tag = {
  id: number;
  name: string;
};
