# BLK-02: Remaining render blocks: gallery, embed, FAQ
- Milestone: M2 (week 2)
- Depends on: BLK-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.40 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
The remaining render blocks: gallery, embed and FAQ.
## Definition of Done
- [x] Gallery block
- [x] FAQ block
- [x] Extra blocks beyond scope: logoCloud, stats, spacer, pricingTable, teamGrid
- [x] Embed block as `videoEmbed`: YouTube/Vimeo by pasted link, iframe built from a parsed ID (D-040)
## Technical notes
`cms-blocks/src/` (`VideoEmbed.tsx`, `video.ts`). D-040.
## History
gallery + FAQ done, plus 5 blocks beyond original scope (logoCloud, stats, spacer, pricingTable, teamGrid); embed intentionally not built, see `WORKLOG.md` 2026-09-25
2026-10-06: `videoEmbed` added (YouTube/Vimeo by URL only), registry now has 15 blocks; unknown block types are skipped instead of failing the page. See `WORKLOG.md` 2026-10-06.
