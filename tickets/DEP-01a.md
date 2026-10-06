# DEP-01a: Skeleton deploy: EC2, nginx, wildcard TLS, pm2
- Milestone: M1 (week 1)
- Depends on: DEC-2 (open decision, see EXECUTION_PLAN.md)
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.40 days, band E (see EXECUTION_PLAN.md "Bands")
## Goal
A skeleton deploy on the real server and domain.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: EC2 box with nginx routing `*.<domain>` → web, `admin.<domain>` → admin, `api.<domain>` → api
- [ ] Draft: wildcard TLS certificate
- [ ] Draft: apps run under pm2 and restart on reboot
- [ ] Draft: blocked until the domain is chosen (DEC-2)
## Technical notes
Production `PUBLIC_ROOT_DOMAIN` and `VITE_SITE_URL_TEMPLATE` come from DEC-2.
