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
  tags: Tag[];
};

export type Tag = {
  id: number;
  name: string;
};
