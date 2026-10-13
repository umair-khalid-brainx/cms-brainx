# DEP-01b: Deploy script, three-app topology, rollback
- Milestone: M5 (week 5)
- Depends on: DEP-01a (its server-side files are written here; running on a real box waits for DEC-2)
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 1.00 days, band E (re-estimated in docs/WEEK5_PLAN.md, D-064)
## Goal
A repeatable deploy script for all three apps, with rollback.
## Definition of Done
_Confirmed with the user on 2026-10-12 (docs/WEEK5_PLAN.md)._
- [ ] `deploy/deploy.sh` builds cms-blocks, api, web and admin into a timestamped release, runs `prisma migrate deploy`, switches the `current` link, reloads pm2 and checks health
- [ ] A failed health check rolls back to the previous release by itself; `deploy/rollback.sh` returns to the previous release on demand; the last 5 releases are kept
- [ ] nginx config for `*.<domain>` → web, `admin.<domain>` → admin build, `api.<domain>` → api on 4000 (DEC-5), with `X-Forwarded-For` set from `$remote_addr`; pm2 file; production env example
- [ ] Tested locally end to end, including a broken release rolling back; `npm audit` revisited (B-08)
- [ ] All tests pass. Reviewer approved. Verifier passed.

## Technical notes
Depends on `DEP-01a`. Revisit `npm audit` findings before this (`BACKLOG.md` B-08).
