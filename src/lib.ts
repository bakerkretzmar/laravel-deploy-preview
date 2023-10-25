export async function until<T>(
  condition: () => boolean | Promise<boolean>,
  attempt: () => T | Promise<T>,
  pause: number = 1,
): Promise<T> {
  let result = await attempt();
  while (!condition()) {
    await new Promise((resolve) => setTimeout(resolve, pause * 1000));
    result = await attempt();
  }
  return result;
}

export function sanitizeDatabaseName(input: string) {
  return input.replace(/[-\s]+/g, '_').replace(/[^\w_]/g, '');
}

export function sanitizeDomainName(input: string) {
  return input.replace(/[^\w]+/g, '-');
}

// function serverWithFewestSites(servers: Server[], sites: Site[]): Server {
//   const serverSites = sites.reduce((carry: { [_: string]: number }, site: Site) => {
//     carry[site.server_id] ??= 0;
//     carry[site.server_id]++;
//     return carry;
//   }, {});

//   let count = 0;
//   const server = Object.entries(serverSites).reduce((carry: string, server: [string, number]): string => {
//     try {
//       return server[1] < count ? server[0] : carry;
//     } finally {
//       count = server[1];
//     }
//   }, Object.keys(serverSites)[0]);

//   return servers.find(({ id }) => id === Number(server));
// }
