# TYP-02: Six field kinds, dynamic forms, JSONB, Zod
- Milestone: M3 (week 3)
- Depends on: TYP-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.60 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Content types have custom fields of six fixed kinds, validated with Zod.
## Definition of Done
_Confirmed with the user 2026-10-09 (the six kinds: text, formatted text, date, media, choice, link; D-049)._
- [ ] The six kinds can be added to a type in the Types screen, with a name, an optional "needed before publishing", and for a choice its options; fields can be reordered and removed
- [ ] The entry editor shows a fields panel generated from the type's fields, next to the block canvas
- [ ] Values are stored as JSONB on the entry and validated on the server by kind with Zod; invalid values are refused with every problem listed, formatted text is sanitised, media must be this site's own files
- [ ] A seventh kind is refused (root invariant 8)
- [ ] A needed field with no value stops publishing and is named; drafts save without it
- [ ] A saved field keeps its key and kind; removing a field hides it and its values are kept
- [ ] Built-in Posts has an excerpt and a featured image
- [ ] A value the API refuses is named in the editor and doesn't lose the blocks
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
The six kinds are in D-049. Rules in `api/src/content-types/field-definitions.ts` and `field-values.ts`; side panel in `admin/src/puck/entryFields.tsx`.
