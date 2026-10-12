import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isOwnHost, subdomainFromHost } from './tenant.ts';

describe('isOwnHost (SEO-02)', () => {
  it('is true only on the tenant’s own host, with or without a port', () => {
    assert.equal(isOwnHost('corrick.lvh.me:3000', 'lvh.me', 'corrick'), true);
    assert.equal(isOwnHost('CORRICK.lvh.me', 'lvh.me', 'corrick'), true);
  });

  it('is false on another tenant’s host, the bare root, an address or no host at all', () => {
    for (const host of ['kestrel.lvh.me:3000', 'lvh.me', '127.0.0.1:3000', 'localhost', 'a.corrick.lvh.me', null]) {
      assert.equal(isOwnHost(host, 'lvh.me', 'corrick'), false, String(host));
    }
  });
});

describe('subdomainFromHost', () => {
  it('takes exactly one label under the root domain', () => {
    assert.equal(subdomainFromHost('corrick.lvh.me:3000', 'lvh.me'), 'corrick');
    assert.equal(subdomainFromHost('a.b.lvh.me', 'lvh.me'), null);
  });
});
