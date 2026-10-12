import type { TermRepository, TermRow } from './term.repository.js';
import type { TermLinks } from './terms.service.js';
import type { TermInput, TermKind } from './term-rules.js';

type Stored = TermRow & { siteId: string };

/**
 * An in-memory stand-in for the `terms` and `content_terms` tables, scoped by site like the real
 * repository, for the specs of TermsService and ContentService (TAX-01). Deleting a term unlinks it,
 * as the foreign key's cascade does.
 */
export function fakeTermRepository(seed: Stored[] = []) {
  const terms: Stored[] = [...seed];
  const links: { contentId: string; termId: string }[] = [];
  let next = terms.length + 1;
  const plain = ({ id, kind, name, slug }: Stored): TermRow => ({ id, kind, name, slug });

  const repo = {
    findAllWithCounts: vi.fn(async (siteId: string) =>
      terms
        .filter((t) => t.siteId === siteId)
        .map((t) => ({ ...plain(t), entryCount: links.filter((l) => l.termId === t.id).length })),
    ),
    findById: vi.fn(async (siteId: string, id: string) => {
      const found = terms.find((t) => t.siteId === siteId && t.id === id);
      return found ? plain(found) : null;
    }),
    findByIds: vi.fn(async (siteId: string, ids: readonly string[]) => terms.filter((t) => t.siteId === siteId && ids.includes(t.id)).map(plain)),
    findBySlug: vi.fn(async (siteId: string, kind: TermKind, slug: string) => {
      const found = terms.find((t) => t.siteId === siteId && t.kind === kind && t.slug === slug);
      return found ? plain(found) : null;
    }),
    create: vi.fn(async (siteId: string, kind: TermKind, term: TermInput) => {
      const row = { id: `term-${next++}`, siteId, kind, ...term };
      terms.push(row);
      return plain(row);
    }),
    update: vi.fn(async (siteId: string, id: string, term: TermInput) => {
      const row = terms.find((t) => t.siteId === siteId && t.id === id);
      if (row) Object.assign(row, term);
      return { count: row ? 1 : 0 };
    }),
    delete: vi.fn(async (siteId: string, id: string) => {
      const index = terms.findIndex((t) => t.siteId === siteId && t.id === id);
      if (index < 0) return { count: 0 };
      terms.splice(index, 1);
      for (let i = links.length - 1; i >= 0; i--) if (links[i].termId === id) links.splice(i, 1);
      return { count: 1 };
    }),
    findOrCreateTags: vi.fn(async (siteId: string, tags: readonly TermInput[]) =>
      tags.map((tag) => {
        const found = terms.find((t) => t.siteId === siteId && t.kind === 'tag' && t.slug === tag.slug);
        if (found) return plain(found);
        const row = { id: `term-${next++}`, siteId, kind: 'tag' as const, ...tag };
        terms.push(row);
        return plain(row);
      }),
    ),
    findForContent: vi.fn(async (siteId: string, contentId: string) =>
      terms.filter((t) => t.siteId === siteId && links.some((l) => l.contentId === contentId && l.termId === t.id)).map(plain),
    ),
  };

  /** What the real content repository does inside its transaction: replace each asked kind's links. */
  const setLinks = (siteId: string, contentId: string, replace: TermLinks) => {
    for (const { kind, termIds } of replace) {
      for (let i = links.length - 1; i >= 0; i--) {
        const term = terms.find((t) => t.id === links[i].termId);
        if (links[i].contentId === contentId && term?.siteId === siteId && term.kind === kind) links.splice(i, 1);
      }
      for (const termId of termIds) links.push({ contentId, termId });
    }
  };

  return { repo: repo as unknown as TermRepository & typeof repo, terms, links, setLinks };
}
