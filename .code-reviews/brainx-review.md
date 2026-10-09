---
diff_hash: 3e131ba80515ac4a00173f5d8e869b4e99343d636be1aa675881c0610e525237
reviewed_at: 2026-10-09T15:28:56Z
---

## Summary

Docs-only change: week 4 planning. Adds `docs/WEEK4_PLAN.md` (12-step build order, decisions from the ticket
review, estimates), decision D-052 in `docs/DECISIONS.md`, takes "related posts" off the out-of-scope list in
`docs/EXECUTION_PLAN.md`, rewrites the Definition of Done in 12 ticket files (Draft markers dropped, now
"confirmed with the user"), and notes in `tickets/STATUS.md` that CNT-04/05/06 are built first in week 4.

Stack: no root `package.json` (three independent projects); no code changed, so this is a generic review for
correctness and internal consistency of the plan against itself, the ticket headers and the code it describes.
Verified against the code: the editor's autosave delay really is 500 ms (`admin/src/pages/EditorPage.tsx:24`,
`AUTOSAVE_DELAY_MS`), and `uniqueSlug` already exists in `api/src/content/content.service.ts`. No invariant is
contradicted: diffing by sequence keeps `content.blocks` unchanged (invariant 7), the subtree recompute matches
invariant 9, and TAX-02 restates invariant 2. Single repo, no API contract touched.

The findings are all plan-consistency issues: one sequencing contradiction (SEO-01's DoD needs GOV-04's logo but is
built first), a redirect rule that the plan and the ticket state differently in a way that matters for loops, an
understated estimate in D-052, and ticket header metadata (depends-on, estimates, a technical note) left stale by
the rewritten DoD.

## Findings

### Critical (0)

### High (0)

### Medium (3)
- **tickets/SEO-01.md:13** — The DoD's social-image fallback ends at "site logo", but the logo only exists after GOV-04, which `docs/WEEK4_PLAN.md:67` builds two steps *after* SEO-01 (`… SEO-01 → SEO-02 → GOV-04 …`). *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: As written, SEO-01 can't meet its own DoD when it is built, so the verifier would have to fail it or the step would quietly reach into GOV-04. Either move GOV-04 before SEO-01 in the build order, or make the logo fallback part of GOV-04's DoD ("GOV-04 adds the logo as SEO-01's last-resort social image") and drop it from SEO-01's. The plan's own line 36 ("also the last-resort social image") shows the intent; only the ownership is wrong.
- **tickets/GOV-05.md:13** — The "page beats redirect" rule differs between the ticket and the plan: the DoD removes a redirect whose source is "a page's path", while `docs/WEEK4_PLAN.md:131` says "a live page's path". The difference decides whether a rename-back creates a loop. *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Scenario: a published page at `/a` is renamed to `/b` (auto `/a → /b`), then unpublished and renamed back to `/a`. The auto redirect `/b → /a` is created and chain flattening rewrites `/a → /b` into `/a → /a`. Under the plan's "live page" wording the draft at `/a` doesn't remove it, so a self-loop is stored (or, if the loop guard refuses it, the slug change itself fails). Pick one rule and write it the same in both places. The safe one: when a page takes a path (any status), delete any redirect whose `fromPath` equals it, before flattening. Also add "rename back to the old slug" to Step 4's test list.
- **docs/DECISIONS.md:35** — D-052 says week 4 "grows by about 0.7 days", but that is the cost of CNT-04/05/06 alone (0.15 + 0.25 + 0.3 in the plan). The plan's total is ~4.4 d against the 3.1 d the existing week 4 tickets were estimated at in `EXECUTION_PLAN.md`, so the real growth is about 1.3 d. *(consistency)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Most of the extra comes from silently bumped estimates (SEO-01, TAX-01, TAX-02, GOV-04 each 0.2 → 0.3, GOV-01 0.3 → 0.4) plus related posts, not only the pulled-in tickets. Since the project rule is that scope changes are re-estimated, not absorbed, the decision record should state the real number (and the cut order). Fix the figure in D-052; the per-ticket numbers are covered by the next finding.

### Low (2)
- **tickets/GOV-05.md:3** — Ticket header metadata no longer matches the rewritten DoDs: GOV-05 says "Depends on: CNT-04" but consumes CNT-06's path moves; GOV-01 says "Depends on: CNT-01" but snapshots SEO and terms (SEO-01, TAX-01); SEO-01 now needs GOV-04 (logo). The headers' estimates (and `EXECUTION_PLAN.md`'s table) also still show the old numbers (e.g. SEO-01 0.20 vs 0.3 in the plan, CNT-05 0.20 vs 0.25, CNT-06 0.35 vs 0.3). *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: `/build` and the status tooling read these headers, so stale dependencies and estimates will mislead them. Update the "Depends on" and "Estimate" lines in the affected ticket files and the matching rows in `docs/EXECUTION_PLAN.md`'s estimate table, or state in the plan that `WEEK4_PLAN.md`'s numbers supersede them.
- **tickets/CNT-05.md:18** — The technical note still says "Depth limit value to confirm.", but the DoD now fixes it at 3 levels. *(consistency)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Drop the sentence or replace it with "Depth limit: 3 (D-052)". Similarly, Step 0 of `WEEK4_PLAN.md` says STATUS.md would get "an M4 note … fix totals", while STATUS.md keeps the rows under M1 with a Notes entry; harmless, but the plan's Step 0 could say what was actually done.

## Reviewed files
- docs/DECISIONS.md
- docs/EXECUTION_PLAN.md
- docs/WEEK4_PLAN.md
- tickets/CNT-04.md
- tickets/CNT-05.md
- tickets/CNT-06.md
- tickets/GOV-01.md
- tickets/GOV-02.md
- tickets/GOV-03.md
- tickets/GOV-04.md
- tickets/GOV-05.md
- tickets/SEO-01.md
- tickets/SEO-02.md
- tickets/STATUS.md
- tickets/TAX-01.md
- tickets/TAX-02.md
