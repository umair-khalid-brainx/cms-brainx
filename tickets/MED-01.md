# MED-01: Upload, thumbnails, local disk
- Milestone: M3 (week 3)
- Depends on: FND-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Upload media to local disk with thumbnails.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [x] `POST /media` stores a file on site-scoped local disk and serves it at `/uploads/:siteId/:file`
- [x] Image fields in the editor can upload directly
- [x] Images get thumbnails generated with `sharp`, and the library uses them
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`api/src/media/`. Local disk only, no S3 (plan section intro).
## History
`POST /media` uploads a file to site-scoped local disk, served back at `/uploads/:siteId/:file`; wired directly into every image field in the block editor (`ImageUploadField.tsx`), not just a standalone endpoint. No thumbnails (`sharp`) yet — the original upload is what gets stored and served; see `WORKLOG.md` 2026-09-28

2026-10-07: thumbnails shipped (D-036). PNG/JPEG/WebP uploads get a 400px WebP (`thumbnailUrl`); SVG, GIF, video and older uploads fall back to the original. Undecodable or >50 MP images → 400. The `/media` grid and the editor picker show the thumbnail; the picker still inserts the original URL. See `WORKLOG.md` 2026-10-07.
