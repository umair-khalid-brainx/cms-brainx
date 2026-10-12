// The paging of a category or tag archive, and which entries are "related" to one (TAX-02, D-061).
// Pure, so each rule is tested without a database.

/** An archive shows this many entries a page. */
export const ARCHIVE_PAGE_SIZE = 20;
/** Under an entry: at most this many related entries. */
export const RELATED_LIMIT = 3;

/**
 * The page number a request asks for: none is the first. Anything that isn't a whole number from 1 up
 * (`0`, `-1`, `2.5`, `abc`, `1e3`) is not a page, so the caller answers 404 rather than guess.
 */
export function parsePage(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return 1;
  if (!/^[1-9]\d{0,6}$/.test(raw)) return null;
  return Number(raw);
}

export const pageCount = (total: number, size = ARCHIVE_PAGE_SIZE): number => Math.max(1, Math.ceil(total / size));

/**
 * The related entries, in order: those sharing a category come first, those sharing only a tag fill
 * what is left, nobody twice, never more than `limit`. `byCategory` and `byTag` are each newest first.
 */
export function mergeRelated<T extends { id: string }>(byCategory: readonly T[], byTag: readonly T[], limit = RELATED_LIMIT): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const row of [...byCategory, ...byTag]) {
    if (out.length >= limit) break;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}
