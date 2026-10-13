// Invariant 6, checked against a running production build (GOV-08b): refreshing a page on one tenant's host
// clears that page only, and the other tenant's cached pages stay HITs. `next dev` has no cache, so this needs
// `next build && next start`.
//
//   node scripts/check-isr-two-hosts.mjs [origin-port] [hostA:/path,/path] [hostB:/path,/path]
//   node scripts/check-isr-two-hosts.mjs 3052 kestrel:/about,/ corrick:/winter-menu,/
//
// The last path in each list is the one refreshed, and it should be one both hosts have (`/`): a cache keyed on
// the path alone, the bug this guards against, only shows when the same path is refreshed on one host and still
// served from the cache on the other.
//
// Reads REVALIDATE_SECRET from the environment, or from .env.local beside package.json. Exits 1 on a failure.

import { readFileSync } from 'node:fs';

const [port = '3000', a = 'kestrel:/about,/', b = 'corrick:/winter-menu,/'] = process.argv.slice(2);
const root = process.env.PUBLIC_ROOT_DOMAIN ?? 'lvh.me';
function secretFromEnvFile() {
  try {
    return readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/^REVALIDATE_SECRET="?([^"\n]+)"?$/m)?.[1];
  } catch {
    return undefined;
  }
}
const secret = process.env.REVALIDATE_SECRET ?? secretFromEnvFile();
if (!secret) {
  console.error('REVALIDATE_SECRET is not set (environment or web/.env.local)');
  process.exit(1);
}

const parse = (spec) => {
  const [subdomain, paths] = spec.split(':');
  return { subdomain, paths: paths.split(',') };
};
const sites = [parse(a), parse(b)];
const url = (subdomain, path) => `http://${subdomain}.${root}:${port}${path}`;

async function cacheState(subdomain, path) {
  const response = await fetch(url(subdomain, path), { redirect: 'manual' });
  await response.arrayBuffer();
  return response.headers.get('x-nextjs-cache') ?? `none (${response.status})`;
}

async function warm() {
  // Three rounds: the first fill may be a MISS and the next a STALE while it refreshes in the background; by the
  // third every page is a HIT.
  for (let round = 0; round < 3; round += 1) {
    for (const { subdomain, paths } of sites) for (const path of paths) await cacheState(subdomain, path);
  }
}

let failed = false;
for (const [target, other] of [sites, [...sites].reverse()]) {
  await warm();
  const path = target.paths[target.paths.length - 1];
  const refreshed = await fetch(`http://127.0.0.1:${port}/__revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ subdomain: target.subdomain, path }),
  });
  if (!refreshed.ok) {
    console.error(`refresh of ${target.subdomain}${path} answered ${refreshed.status}`);
    process.exit(1);
  }
  const own = await cacheState(target.subdomain, path);
  const others = await Promise.all(other.paths.map(async (p) => [p, await cacheState(other.subdomain, p)]));
  const ok = own === 'MISS' && others.every(([, state]) => state === 'HIT');
  failed ||= !ok;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} refreshed ${target.subdomain}${path}: it is ${own}; ` +
      others.map(([p, state]) => `${other.subdomain}${p} ${state}`).join(', '),
  );
}
process.exit(failed ? 1 : 0);
