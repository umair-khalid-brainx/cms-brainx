// Small helpers for the content type screens. The API enforces every rule (its
// message is shown to the person); these only suggest sensible starting values
// so most people never have to type an address by hand.

/** "Case Studies!" becomes "case-studies". A suggestion, shown and editable, never applied silently. */
export function suggestPrefix(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

/** "Case studies" becomes "Case study", "Events" becomes "Event". A guess the person can overwrite. */
export function singularize(plural: string): string {
  const trimmed = plural.trim();
  const lower = trimmed.toLowerCase();
  if (/(ss|us|is)$/.test(lower)) return trimmed; // "Business", "Status", "Analysis"
  if (/ies$/.test(lower) && lower.length > 4) return `${trimmed.slice(0, -3)}y`;
  if (/(sses|xes|ches|shes)$/.test(lower)) return trimmed.slice(0, -2);
  if (/s$/.test(lower)) return trimmed.slice(0, -1);
  return trimmed;
}
