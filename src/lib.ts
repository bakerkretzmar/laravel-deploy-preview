export async function sleep(s: number) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

export async function until<T>(
  condition: () => boolean | Promise<boolean>,
  attempt: () => T | Promise<T>,
  pause: number = 1,
): Promise<T> {
  let result = await attempt();
  while (!condition()) {
    await sleep(pause);
    result = await attempt();
  }
  return result;
}

export function tap<T>(value: any, interceptor: (v: any) => T) {
  return interceptor(value);
}

export function normalizeDatabaseName(input: string) {
  return input
    .replace(/[\W_]+/g, '_')
    .substring(0, 64)
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

export function normalizeDomainName(input: string) {
  return input.replace(/\W+/g, '-').substring(0, 63).replace(/^-|-$/g, '').toLowerCase();
}

export function updateDotEnvString(env: string, variables: Record<string, string | undefined>) {
  Object.entries(variables).map(([key, value]) => {
    if (new RegExp(`${key}=`).test(env)) {
      env = env.replace(new RegExp(`${key}=.*\n?`), value === undefined ? '' : `${key}=${value}\n`);
    } else {
      env += `\n${key}=${value}\n`;
    }
  });
  return env;
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
