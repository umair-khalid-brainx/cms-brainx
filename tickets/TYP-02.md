# TYP-02: Six field kinds, dynamic forms, JSONB, Zod
- Milestone: M3 (week 3)
- Depends on: TYP-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.60 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Content types have custom fields of six fixed kinds, validated with Zod.
## Definition of Done
_Confirmed with the user 2026-10-09 (the six kinds: text, formatted text, date, media, choice, link; D-049)._
- [x] The six kinds can be added to a type in the Types screen, with a name, an optional "needed before publishing", and for a choice its options; fields can be reordered and removed
- [x] The entry editor shows a fields panel generated from the type's fields, next to the block canvas
- [x] Values are stored as JSONB on the entry and validated on the server by kind with Zod; invalid values are refused with every problem listed, formatted text is sanitised, media must be this site's own files
- [x] A seventh kind is refused (root invariant 8)
- [x] A needed field with no value stops publishing and is named; drafts save without it
- [x] A saved field keeps its key and kind; removing a field hides it and its values are kept; a different kind never inherits a removed field's key
- [x] Built-in Posts has an excerpt and a featured image
- [x] A value the API refuses is named in the editor and doesn't lose the blocks
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
The six kinds are in D-049. Rules in `api/src/content-types/field-definitions.ts` and `field-values.ts`; side panel in `admin/src/puck/entryFields.tsx`.
## History
2026-10-09: done (D-049). Field builder, per-kind server validation, the entry's side panel, required-before-publish, hidden fields. The verifier and the review both found that media accepted any address containing the site's upload path (including `javascript:` ones), a NUL character gave a 500, and re-adding a removed field's name as a different kind inherited its old values; all fixed with tests. Also fixed: a stale field list overwriting another admin's change, the address changing after other fields were saved, a live entry having a needed field emptied, empty paragraphs and empty links counting as filled. Left: B-27.
