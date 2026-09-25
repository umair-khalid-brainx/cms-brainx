#!/usr/bin/env node
// Guardrail for D-017's accepted cost: web/src/fixtures/corrick.ts and
// admin/src/data/corrickPages.ts are independently-authored duplicates of
// the same demo tenant (admin can't import from web — CLAUDE.md, no
// cross-repo imports except the published cms-blocks package). Nothing
// previously caught the two drifting apart; this does, without violating
// that boundary itself.
//
// It only imports each file from its own directory, in its own process
// invocation semantics — no bundler, no path aliases, no shared module
// graph between the two repos. Both files happen to have only *type-only*
// imports (verify this holds before trusting a "no cross-import" claim: if
// either file ever gains a runtime import, this script needs the same
// per-project execution boundary a real build already has).
//
// Checks structural parity only — same set of page paths, same block-type
// sequence per page — never full prose equality. The written copy is
// deliberately independently authored, not meant to be byte-identical.
//
// Run: node --experimental-strip-types scripts/check-content-parity.mjs

import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);

const webModule = await import(pathToFileURL(new URL('web/src/fixtures/corrick.ts', ROOT).pathname).href);
const adminModule = await import(pathToFileURL(new URL('admin/src/data/corrickPages.ts', ROOT).pathname).href);

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const webPages = webModule.corrick.pages
  .map((page) => [page.path, { title: page.title, blockTypes: page.blocks.map((block) => capitalize(block.type)) }]);
const webByPath = new Map(webPages);

const adminPages = adminModule.corrickPages
  .map((page) => [page.path, { title: page.title, blockTypes: page.data.content.map((block) => block.type) }]);
const adminByPath = new Map(adminPages);

const allPaths = new Set([...webByPath.keys(), ...adminByPath.keys()]);
const problems = [];

for (const path of allPaths) {
  const web = webByPath.get(path);
  const admin = adminByPath.get(path);

  if (!web) {
    problems.push(`"${path}" exists in admin/src/data/corrickPages.ts but not in web/src/fixtures/corrick.ts`);
    continue;
  }
  if (!admin) {
    problems.push(`"${path}" exists in web/src/fixtures/corrick.ts but not in admin/src/data/corrickPages.ts`);
    continue;
  }

  const webTypes = web.blockTypes.join(',');
  const adminTypes = admin.blockTypes.join(',');
  if (webTypes !== adminTypes) {
    problems.push(
      `"${path}" block sequence differs:\n    web:   [${webTypes}]\n    admin: [${adminTypes}]`,
    );
  }
}

if (problems.length > 0) {
  console.error(`Content parity check FAILED (${problems.length} issue(s)):\n`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Content parity OK — ${allPaths.size} pages match between web and admin.`);
}
