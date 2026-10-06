# FND-05: Auth: JWT, login, guards, role decorators
- Milestone: M1 (week 1)
- Depends on: FND-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.35 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Users log in with email and password and every protected route checks their token and role.
## Definition of Done
- [x] `POST /auth/login` returns a JWT and session; `GET /auth/me` returns the current user
- [x] `JwtAuthGuard` rejects missing or invalid tokens with 401
- [x] `admin` login page, stored session, route guard, forced re-login on an expired token
- [x] Role checks via `PermissionsGuard` + `@RequirePermission(...)` (landed with `GOV-06`)
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`api/src/auth/`, `admin/src/lib/auth.ts`, `admin/src/lib/RequireAuth.tsx`. D-023.
## History
`POST /auth/login`, `GET /auth/me`, `JwtAuthGuard` wired to the real `admin` login page (bcrypt hash, JWT, localStorage session, route guard, forced re-login on an expired/invalid token). Role decorators landed with `GOV-06`: `PermissionsGuard` + `@RequirePermission(...)`, checked in the API against a hardcoded per-role permission map, not just hidden UI — see `DECISIONS.md` D-023. This row previously said role enforcement didn't exist yet; stale as of `GOV-06` landing the same day, corrected 2026-09-28
