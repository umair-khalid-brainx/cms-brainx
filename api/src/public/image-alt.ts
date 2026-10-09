// The live site's fallback for image alternative text (MED-04, D-047): an image
// whose own alt is empty uses the alt text of its library file. Text typed on
// the page always wins, and the stored page is never changed: this runs on the
// copy handed to the public site. It adds information, it does not clean
// anything, so it is not the "sanitise on read" the root invariant forbids.

type Json = unknown;

const isObject = (value: Json): value is Record<string, Json> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The file name when `src` is one of this site's own uploads, else null. */
export function uploadFilename(src: string, siteId: string): string | null {
  const marker = `/uploads/${siteId}/`;
  const at = src.indexOf(marker);
  if (at === -1) return null;
  const name = src.slice(at + marker.length).split(/[?#]/)[0];
  return /^[A-Za-z0-9-]+\.[A-Za-z0-9]+$/.test(name) ? name : null;
}

const needsAlt = (node: Record<string, Json>): node is Record<string, Json> & { src: string } =>
  typeof node.src === 'string' && (typeof node.alt !== 'string' || node.alt.trim() === '');

/** Every library file the page's images that lack alt text point at. */
export function filenamesNeedingAlt(blocks: Json, siteId: string): string[] {
  const found = new Set<string>();
  const walk = (node: Json): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!isObject(node)) return;
    if (needsAlt(node)) {
      const name = uploadFilename(node.src, siteId);
      if (name) found.add(name);
    }
    Object.values(node).forEach(walk);
  };
  walk(blocks);
  return [...found];
}

/** A copy of the blocks with library alt text filled in where an image has none. */
export function withLibraryAlt(blocks: Json, siteId: string, alts: ReadonlyMap<string, string>): Json {
  const walk = (node: Json): Json => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isObject(node)) return node;
    const copy: Record<string, Json> = {};
    for (const [key, value] of Object.entries(node)) copy[key] = walk(value);
    if (needsAlt(node)) {
      const name = uploadFilename(node.src, siteId);
      const alt = name ? alts.get(name) : undefined;
      if (alt) copy.alt = alt;
    }
    return copy;
  };
  return walk(blocks);
}
