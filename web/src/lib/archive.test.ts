import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archivePage } from './archive.ts';
import { archiveMetadata } from './seo.ts';

test('no rest is the first page', () => {
  assert.equal(archivePage(undefined), 1);
  assert.equal(archivePage([]), 1);
});

test('page/N is page N from 2 up', () => {
  assert.equal(archivePage(['page', '2']), 2);
  assert.equal(archivePage(['page', '10']), 10);
  assert.equal(archivePage(['page', '123']), 123);
});

test('everything else is no page: page 1 has one address, and junk is a 404', () => {
  for (const rest of [
    ['page', '1'],
    ['page', '0'],
    ['page', '02'],
    ['page', '-2'],
    ['page', '2.5'],
    ['page', 'x'],
    ['page'],
    ['2'],
    ['page', '2', 'x'],
    ['pages', '2'],
  ]) {
    assert.equal(archivePage(rest), null, JSON.stringify(rest));
  }
});

test('an archive is noindex but followed, and its title names the term', () => {
  const meta = archiveMetadata({ kind: 'category', termName: 'News', siteName: 'Corrick', page: 1 });
  assert.deepEqual(meta.robots, { index: false, follow: true });
  assert.equal(meta.title, 'Category: News · Corrick');
  assert.equal(meta.alternates, undefined);
  assert.equal(
    archiveMetadata({ kind: 'tag', termName: 'Q4', siteName: 'Corrick', page: 3 }).title,
    'Tag: Q4 (page 3) · Corrick',
  );
});
