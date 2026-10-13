// What the Domains card tells an owner to add at their DNS provider (DEP-02, D-066). Pure, so the specs pass
// their own values. Nothing here talks to DNS: the record is shown, a person adds it, a person confirms it.

export type DnsRecord = { type: string; name: string; value: string };

/** The host name of the site's free address: `corrick.lvh.me` for `http://corrick.lvh.me:3000`. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * A bare domain (`corrickoysters.com`) rather than a name under one (`www.corrickoysters.com`). Two labels is a
 * guess that misses `example.co.uk`, so the card only says such a domain "looks like" a bare one, and the record's
 * name is always the full host name, which is right either way.
 */
export function isApexDomain(domain: string): boolean {
  return domain.split('.').length === 2;
}

/**
 * The record to add. A name under a domain points at the free address with a CNAME; a bare domain can't take
 * a CNAME at most providers, so it gets ALIAS (also called ANAME or flattening) where the provider has one. The
 * name is the full host name: every provider accepts it, and cutting it short guesses where the domain begins.
 */
export function dnsRecords(domain: string, target: string): DnsRecord[] {
  return [{ type: isApexDomain(domain) ? 'ALIAS' : 'CNAME', name: domain, value: target }];
}
