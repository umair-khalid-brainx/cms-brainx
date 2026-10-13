// A site's custom domain (DEP-02, D-066): what an owner types, cleaned up, and whether it can be used. Pure: the
// caller passes the platform's own root domain. Nothing here checks DNS; that is a person's job for now.

import { domainToASCII } from 'node:url';

/** The longest name DNS allows. */
const DOMAIN_MAX = 253;
// One label: letters, digits and hyphens, 1–63 long, not starting or ending with a hyphen.
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
// The last label: letters, or an internationalised ending in its `xn--` form (`.рф` is `xn--p1ai`).
const ENDING = /^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
// Endings that never name a real public site (RFC 2606, 6761, 6762).
const RESERVED_ENDINGS = new Set(['localhost', 'test', 'local', 'example', 'invalid', 'internal']);

/**
 * What an owner typed, as a bare host name: `https://WWW.Corrick-Oysters.com/menu` becomes
 * `www.corrick-oysters.com`. Scheme (or a bare `//`), path, port and a trailing dot go; letters are lower-cased;
 * an internationalised name is stored in the `xn--` form DNS uses (`münchen.de` is `xn--mnchen-3ya.de`).
 */
export function normaliseDomain(value: string): string {
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d*$/, '')
    .replace(/\.$/, '');
  // Only names with non-ASCII letters need converting; '' back means it can't be one (the checks then say so).
  // A name that can't be converted is kept as typed, so the checks call it "not a domain" rather than empty.
  return [...host].some((character) => character.charCodeAt(0) > 127) ? domainToASCII(host) || host : host;
}

/** Why a (normalised) domain can't be used, in words for the owner; null when it is fine. */
export function domainProblem(domain: string, rootDomain: string): string | null {
  if (!domain) return 'Enter a domain, like www.example.com.';
  if (domain.length > DOMAIN_MAX) return 'That domain is too long.';
  const labels = domain.split('.');
  const ending = labels[labels.length - 1];
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label)) || !ENDING.test(ending)) {
    return 'That doesn’t look like a domain. Enter one like www.example.com.';
  }
  if (RESERVED_ENDINGS.has(ending)) return `.${ending} addresses never work on the public internet. Enter a domain your company owns.`;
  const root = rootDomain.toLowerCase();
  if (domain === root || domain.endsWith(`.${root}`)) {
    return `Addresses on ${root} are the free ones. Enter a domain your company owns.`;
  }
  return null;
}
