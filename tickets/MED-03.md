# MED-03: Media picker in block settings
- Milestone: M3 (week 3)
- Depends on: MED-02, BLK-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Pick an existing image from the library inside block settings.
## Definition of Done
- [x] "Browse" on image fields opens a modal over the site's images
- [x] Picking one fills the field and updates the canvas
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`admin/src/components/ImageUploadField.tsx`, `MediaLibraryModal.tsx`. D-027.
## History
`ImageUploadField` gained a "Browse" button opening `MediaLibraryModal.tsx`, a grid over the site's images-only media; picking one fills the field. No new API surface, reads the same `GET /media` list; see `DECISIONS.md` D-027, `WORKLOG.md` 2026-09-28
