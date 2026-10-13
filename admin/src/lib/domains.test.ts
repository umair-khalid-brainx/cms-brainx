import { describe, expect, it } from 'vitest';
import { dnsRecords, hostOf, isApexDomain } from './domains';

describe('the DNS record a custom domain needs (DEP-02)', () => {
  it('reads the free address’s host name from its URL', () => {
    expect(hostOf('http://corrick.lvh.me:3000')).toBe('corrick.lvh.me');
    expect(hostOf('https://corrick.yourcms.com')).toBe('corrick.yourcms.com');
  });

  it('points a name under a domain at the free address with a CNAME', () => {
    expect(dnsRecords('www.corrickoysters.com', 'corrick.yourcms.com')).toEqual([
      { type: 'CNAME', name: 'www.corrickoysters.com', value: 'corrick.yourcms.com' },
    ]);
    // A two-part ending: the full name is still right, where a cut-down `www.corrick` would not be.
    expect(dnsRecords('www.corrick.co.uk', 'corrick.yourcms.com')[0]).toMatchObject({ type: 'CNAME', name: 'www.corrick.co.uk' });
  });

  it('gives a bare domain an ALIAS record at @', () => {
    expect(isApexDomain('corrickoysters.com')).toBe(true);
    expect(dnsRecords('corrickoysters.com', 'corrick.yourcms.com')).toEqual([
      { type: 'ALIAS', name: 'corrickoysters.com', value: 'corrick.yourcms.com' },
    ]);
  });
});
