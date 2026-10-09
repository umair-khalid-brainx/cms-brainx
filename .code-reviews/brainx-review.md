---
diff_hash: 53feddd8239e43946c8dee5185605e20ecbdc1b1df42e3aa00ef819bc47ed496
reviewed_at: 2026-10-09T14:59:37Z
---

## Summary

`admin`: the content-type entry editor's two custom fields, `DateField` and `MediaField`, now print their own
name. Each renders a `<label class="entry-field-label">` bound to its input by a `useId()` id, and
`ImageUploadField.css` gains the `.entry-field-label` style (12px / 600 / `#1e1e1e`). The staged diff also deletes
the previous commit's `.code-reviews/brainx-review.md`, which is the normal reset before this fresh review.

Stack: no root `package.json` (three independent projects). Only `admin/` changed, reviewed as React. Single repo,
no API contract touched. Verified the premise in Puck 0.23's source (`AutoFieldInternal`, `dist/index.js` ~8199):
a `type: 'custom'` field gets only its `render`, with no `FieldLabelInternal` wrapper, so without this change the
date and media fields really had no visible name. `entryFields.tsx` always passes `label` (with "(required)"
appended), so `field.label` is never empty here. The label is a real `<label htmlFor>`, so clicking it focuses the
input and screen readers announce it. `admin` typecheck is clean, and oxlint on the two changed files reports nothing.
The hardcoded hex in the CSS matches the file's stated choice to blend into Puck's fixed light chrome, and the
colour-agnostic rule (invariant 2) covers blocks and theme only, not admin chrome, so it isn't raised.

Note, outside this diff: `ImageUploadField` (used for the block "Image" and logo `src` fields in `puck/config.tsx`)
has the same missing label for the same reason. It isn't raised as a finding because those lines weren't touched.

## Findings

### Critical (0)

### High (0)

### Medium (0)

### Low (1)
- **admin/src/components/DateField.tsx:12** — The label copies Puck's field-label styling by hand
  (`.entry-field-label`: 12px / 600 / `#1e1e1e`) when `@puckeditor/core` exports `FieldLabel` for exactly this, the
  component Puck itself wraps built-in fields in. The copy can drift from Puck's styling on an upgrade, and it
  leaves out the lock icon Puck shows on a read-only field's label (both components receive `readOnly` but only
  disable the input). The same applies to `MediaField.tsx:36`. *(consistency)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Wrap the input in `<FieldLabel label={field.label ?? ''} readOnly={readOnly}>…</FieldLabel>` (it
    renders a `<label>` by default, so `useId`/`htmlFor` become unnecessary for the single input) and drop
    `.entry-field-label`. In `MediaField`, wrap only the text input, or pass `el="div"` and keep the `htmlFor` link,
    so the Upload/Browse/Clear buttons aren't inside the label. No functional bug today, so Low.

## Reviewed files
- .code-reviews/brainx-review.md (deletion of the previous review; not code)
- admin/src/components/DateField.tsx
- admin/src/components/ImageUploadField.css
- admin/src/components/MediaField.tsx

Context used: `admin/src/puck/entryFields.tsx` (where both fields are wired and labelled),
`admin/src/puck/config.tsx` (`ImageUploadField` usages), `admin/src/components/ImageUploadField.tsx`,
`@puckeditor/core@0.23` `dist/index.js` (`FieldLabel`, `AutoFieldInternal`) and `dist/index.d.ts` (`FieldLabel` export).
