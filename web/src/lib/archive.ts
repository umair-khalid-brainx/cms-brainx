// The address of a category or tag archive's pages (TAX-02): `/category/news` is the first,
// `/category/news/page/2` the second. In the path, not a query string, because a page that reads
// the query is rendered fresh every time and could not be cached per host (D-039).

/**
 * The page number the rest of an archive's address asks for, or `null` when there is no such page:
 * nothing after the slug is page 1; `page/N` is page N for a whole N of 2 or more (page 1 has only
 * one address); anything else is not an address.
 */
export function archivePage(rest: string[] | undefined): number | null {
  if (!rest || rest.length === 0) return 1;
  if (rest.length !== 2 || rest[0] !== 'page' || !/^[2-9]\d{0,5}$|^1\d{1,5}$/.test(rest[1])) return null;
  return Number(rest[1]);
}
