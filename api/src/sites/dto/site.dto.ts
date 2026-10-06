import { z } from 'zod';

// Hosts the platform itself answers on (`admin.<root>`, `api.<root>`) plus
// names a visitor would reasonably expect to belong to the platform rather
// than to one tenant. A site can never take one of these. See D-031.
export const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'www',
  'app',
  'mail',
  'cdn',
  'static',
  'assets',
  'status',
  'help',
  'support',
  'docs',
]);

// One DNS label: lowercase letters, digits and hyphens, 3–63 characters,
// starting and ending with a letter or digit. Input is trimmed and lowercased
// first, so `Corrick ` is accepted as `corrick`.
const SUBDOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export const subdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(SUBDOMAIN_PATTERN, {
    message: 'Use 3–63 lowercase letters, numbers or hyphens, starting and ending with a letter or number',
  })
  .refine((value) => !RESERVED_SUBDOMAINS.has(value), { message: 'That address is reserved' });

export const updateSubdomainSchema = z.object({ subdomain: subdomainSchema });

export type UpdateSubdomainDto = z.infer<typeof updateSubdomainSchema>;
