import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

// FND-03 / root invariant 1, checked on the source text so it runs in `npm test` with no database:
// nothing outside a repository touches `PrismaService`, and every public method of a tenant-content
// repository takes `siteId` as its first parameter. An unscoped method must not exist to be called.

const SRC = join(import.meta.dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [full] : [];
  });
}

const rel = (file: string) => relative(SRC, file).split('\\').join('/');
const FILES = sourceFiles(SRC).filter((file) => !rel(file).startsWith('prisma/'));

/**
 * Files outside a repository that import PrismaService today. Each one is a known breach of invariant 1, kept
 * here only so the check can land green while the fix is scheduled; the test below also fails if an entry here
 * stops importing it, so the list can only shrink.
 */
// Empty since GOV-08b moved the health check's ping into HealthRepository. A file listed here must still exist.
const KNOWN_OUTSIDE_REPOSITORY: Record<string, string> = {};

describe('PrismaService is only imported by repositories (invariant 1, FND-03)', () => {
  const importers = FILES.filter((file) => /\bPrismaService\b/.test(readFileSync(file, 'utf8'))).map(rel);

  it('finds the repositories at all (the scan is looking in the right place)', () => {
    expect(importers.filter((file) => file.endsWith('.repository.ts')).length).toBeGreaterThan(5);
  });

  it('no file other than a *.repository.ts uses PrismaService', () => {
    const outside = importers.filter((file) => !file.endsWith('.repository.ts') && !(file in KNOWN_OUTSIDE_REPOSITORY));
    expect(outside).toEqual([]);
  });

  it('every known exception still exists (remove it from the list once fixed)', () => {
    for (const file of Object.keys(KNOWN_OUTSIDE_REPOSITORY)) expect(importers).toContain(file);
  });

  // A second way round the rule: a client of its own. `Prisma` (error classes, input types) stays allowed.
  it('no file outside a repository makes a database client of its own', () => {
    const clients = FILES.filter((file) => /\bPrismaClient\b|\bPrismaPg\b/.test(readFileSync(file, 'utf8')))
      .map(rel)
      .filter((file) => !file.endsWith('.repository.ts'));
    expect(clients).toEqual([]);
  });
});

// The tenant-content repositories (the ones holding a site's own rows).
const SCOPED_DIRS = ['content', 'media', 'menus', 'redirects', 'taxonomy', 'revisions', 'submissions', 'content-types'];

/**
 * Public methods that deliberately don't take `siteId` first, each with why it is still scoped. Keyed
 * `<file>#<method>`. Anything not listed here must start with `siteId`.
 */
// Empty since GOV-08b made MediaRepository.create take `siteId` first like the rest.
const NOT_SITE_FIRST: Record<string, string> = {};

/**
 * Every member of each class in the file that code outside the class can call, read with the TypeScript parser
 * rather than a pattern, so `public`, `static`, getters and arrow-function properties are all found (GOV-08b
 * review). `first` is the first parameter's name, with `?` when it is optional: an optional `siteId` is an
 * unscoped method in disguise.
 */
function publicMethods(source: string): { name: string; first: string }[] {
  const file = ts.createSourceFile('repository.ts', source, ts.ScriptTarget.Latest, true);
  const methods: { name: string; first: string }[] = [];
  const firstOf = (parameters: ts.NodeArray<ts.ParameterDeclaration>) => {
    const parameter = parameters[0];
    if (!parameter) return '';
    return `${parameter.name.getText(file)}${parameter.questionToken || parameter.initializer ? '?' : ''}`;
  };
  file.forEachChild(function visit(node: ts.Node): void {
    if (!ts.isClassDeclaration(node)) {
      node.forEachChild(visit);
      return;
    }
    for (const member of node.members) {
      const modifiers = ts.canHaveModifiers(member) ? (ts.getModifiers(member) ?? []) : [];
      if (modifiers.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) continue;
      if (member.name && ts.isPrivateIdentifier(member.name)) continue;
      const name = member.name?.getText(file) ?? '';
      if (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member)) {
        methods.push({ name, first: firstOf(member.parameters) });
      } else if (ts.isPropertyDeclaration(member) && member.initializer && (ts.isArrowFunction(member.initializer) || ts.isFunctionExpression(member.initializer))) {
        methods.push({ name, first: firstOf(member.initializer.parameters) });
      }
    }
  });
  return methods;
}

describe('the method finder can’t be walked around (GOV-08b review)', () => {
  it('sees public, static, getter and arrow-property members, and an optional siteId', () => {
    const found = publicMethods(`export class R {
      constructor(private readonly prisma: unknown) {}
      public findAll() {}
      static wipe() {}
      get everything() { return 1; }
      list = (id: string) => id;
      get2(siteId?: string) {}
      private hidden(x: string) {}
      ok(siteId: string) {}
    }`);
    expect(found).toEqual([
      { name: 'findAll', first: '' },
      { name: 'wipe', first: '' },
      { name: 'everything', first: '' },
      { name: 'list', first: 'id' },
      { name: 'get2', first: 'siteId?' },
      { name: 'ok', first: 'siteId' },
    ]);
  });
});

describe('every public tenant repository method takes siteId first (invariant 1, FND-03)', () => {
  const repositories = FILES.filter((file) => SCOPED_DIRS.includes(rel(file).split('/')[0]) && file.endsWith('.repository.ts'));

  it('finds a repository in each scoped folder', () => {
    expect(new Set(repositories.map((file) => rel(file).split('/')[0]))).toEqual(new Set(SCOPED_DIRS));
  });

  it.each(repositories.map((file) => [rel(file), file]))('%s', (name, file) => {
    const methods = publicMethods(readFileSync(file, 'utf8'));
    expect(methods.length).toBeGreaterThan(0);
    const offenders = methods.filter((m) => m.first !== 'siteId' && !(`${name}#${m.name}` in NOT_SITE_FIRST)).map((m) => `${m.name}(${m.first}…)`);
    expect(offenders).toEqual([]);
  });

  it('every listed exception is still a real method that still needs it', () => {
    for (const key of Object.keys(NOT_SITE_FIRST)) {
      const [file, method] = key.split('#');
      const found = publicMethods(readFileSync(join(SRC, file), 'utf8')).find((m) => m.name === method);
      expect(found, key).toBeDefined();
      expect(found?.first, key).not.toBe('siteId');
    }
  });
});
