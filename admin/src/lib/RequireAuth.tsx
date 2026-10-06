import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { apiGet, ApiError } from './api';
import { getSession, refreshSession, type Session } from './auth';

type Status = 'checking' | 'valid' | 'invalid';

// Previously this only checked "does localStorage have *something*" — a
// stale or invalid token would still look logged-in until some other call
// happened to 401. This actively confirms the token against GET /auth/me on
// every entry into a protected route. apiGet already clears the session and
// redirects on a real 401 (see lib/api.ts); a network/API failure doesn't —
// deliberately fails open rather than logging someone out because the API
// blipped (matches api/CLAUDE.md invariant 3 — this is UI affordance, the API
// still enforces for real once there's something behind it worth enforcing).
function RequireAuth() {
  const session = getSession();
  const [status, setStatus] = useState<Status>(session ? 'checking' : 'invalid');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    // Also refreshes the stored memberships, so a session saved before a
    // field was added (siteSubdomain, D-030) or before a rename picks it up.
    apiGet<Pick<Session, 'user' | 'memberships'>>('/auth/me', session.accessToken)
      .then((fresh) => {
        if (cancelled) return;
        refreshSession(fresh);
        setStatus('valid');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(error instanceof ApiError && error.status === 401 ? 'invalid' : 'valid');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check if the token itself changes
  }, [session?.accessToken]);

  if (status === 'invalid') return <Navigate to="/login" replace />;
  if (status === 'checking') return null;
  return <Outlet />;
}

export default RequireAuth;
