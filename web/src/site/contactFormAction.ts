'use server';

import { headers } from 'next/headers';
import type { ContactFormResult, ContactFormSubmission } from 'cms-blocks';
import { createRateLimiter } from '@/lib/rateLimit';
import { subdomainFromHost } from '@/lib/tenant';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';
const ROOT_DOMAIN = process.env.PUBLIC_ROOT_DOMAIN ?? 'lvh.me';

// 5 submissions per minute per visitor IP, across every site (D-034).
const allow = createRateLimiter({ limit: 5, windowMs: 60_000 });

const GENERIC_ERROR = 'Your message could not be sent. Please try again later.';

/**
 * Where every public contact form submits (BLK-06, D-034). The site comes from
 * the request's own host, never from the browser. Spam checks run here,
 * because this is the only place that sees the visitor's IP; the API accepts
 * submissions only from this action, via the shared secret.
 *
 * Server actions are reachable by a direct POST, so `input` is untrusted.
 */
export async function submitContactForm(input: ContactFormSubmission): Promise<ContactFormResult> {
  if (!isSubmission(input)) return { ok: false, error: GENERIC_ERROR };

  const requestHeaders = await headers();
  const subdomain = subdomainFromHost(requestHeaders.get('host'), ROOT_DOMAIN);
  if (!subdomain) return { ok: false, error: GENERIC_ERROR };

  if (!allow(clientIp(requestHeaders))) {
    return { ok: false, error: 'Too many messages. Please wait a minute and try again.' };
  }

  // A filled honeypot is a bot. Look successful so it has nothing to adjust.
  if (input.honeypot) return { ok: true };

  const secret = process.env.FORM_SUBMIT_SECRET;
  if (!secret) {
    console.error('FORM_SUBMIT_SECRET is not set; contact form submissions are disabled');
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const response = await fetch(`${API_URL}/public/sites/${encodeURIComponent(subdomain)}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-form-secret': secret },
      body: JSON.stringify({ path: input.path, blockIndex: input.blockIndex, values: input.values }),
      cache: 'no-store',
    });
    if (response.ok) return { ok: true };
    // 400s are the visitor's to fix (a required field, a bad email, a form
    // that changed under them) and are written for them; anything else isn't.
    if (response.status === 400) return { ok: false, error: await apiMessage(response) };
    console.error(`Contact form submit failed: API ${response.status}`);
    return { ok: false, error: GENERIC_ERROR };
  } catch (error) {
    console.error('Contact form submit failed', error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * The visitor's IP, from the last X-Forwarded-For entry: the one added by the
 * proxy directly in front of us. Earlier entries are whatever the client
 * claimed. Only as trustworthy as that proxy: `next dev` passes a
 * client-sent header through unchanged (verified 2026-10-06), so locally the
 * limit can be dodged by faking it. Production depends on nginx overwriting
 * the header with `$remote_addr` and on `web` not being reachable around
 * nginx — see DEP-01a and D-034.
 */
function clientIp(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get('x-forwarded-for');
  const last = forwarded?.split(',').at(-1)?.trim();
  return last || requestHeaders.get('x-real-ip') || 'unknown';
}

async function apiMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('. ');
  return message || GENERIC_ERROR;
}

function isSubmission(input: unknown): input is ContactFormSubmission {
  if (!input || typeof input !== 'object') return false;
  const { path, blockIndex, values, honeypot } = input as Record<string, unknown>;
  return (
    typeof path === 'string' &&
    Number.isInteger(blockIndex) &&
    typeof honeypot === 'string' &&
    !!values &&
    typeof values === 'object' &&
    Object.values(values).every((value) => typeof value === 'string')
  );
}
