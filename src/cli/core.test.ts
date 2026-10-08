import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assembleBundle,
  coreApiUrl,
  fetchCoreBundle,
  installCore,
  projectPathFor,
  readLocalCoreBundle,
  writeCoreBundle,
  type CoreBundle,
} from './core';

const tmp: string[] = [];
function mkTmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-core-'));
  tmp.push(d);
  return d;
}
function put(root: string, rel: string, content: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
afterEach(() => {
  while (tmp.length) fs.rmSync(tmp.pop()!, { recursive: true, force: true });
});

/** A tiny library: two core components, one paid, one hidden core. */
function fakeLibrary(): string {
  const lib = mkTmp();
  const meta = (o: object) => JSON.stringify(o);
  put(lib, 'Components/Mesh/meta.json', meta({ builtin: true, isFree: true }));
  put(lib, 'Components/Mesh/Mesh.ts', "import { K } from '../../inputEvents';\nexport const Mesh = 1;");
  put(lib, 'Components/Mesh/Mesh.test.ts', 'test');
  put(lib, 'Components/Mesh/Mesh.panel.tsx', 'panel');
  put(lib, 'Components/Mesh/adapter/register.ts', "import { X } from '../Mesh.defs';");
  put(lib, 'Components/Mesh/Mesh.defs.ts', 'export const X = 1;');
  put(lib, 'Components/Jump/meta.json', meta({ builtin: true, isFree: true }));
  put(lib, 'Components/Jump/Jump.ts', "import { B } from '../Bullet/Bullet.events';\nimport { P } from '../Paid/Paid';");
  put(lib, 'Components/Paid/meta.json', meta({ isFree: false }));
  put(lib, 'Components/Paid/Paid.ts', 'secret');
  put(lib, 'Components/Bullet/meta.json', meta({ isFree: false }));
  put(lib, 'Components/Bullet/Bullet.ts', 'secret too');
  put(lib, 'Components/Bullet/Bullet.events.ts', 'export const B = {};');
  put(lib, 'Components/Old/meta.json', meta({ builtin: true, isFree: true, hidden: true }));
  put(lib, 'Components/Old/Old.ts', 'old');
  put(lib, 'inputEvents.ts', 'export const K = {};');
  return lib;
}

describe('readLocalCoreBundle', () => {
  it('takes builtin + free + visible components, runtime files only, plus shared helpers', () => {
    const b = readLocalCoreBundle(fakeLibrary());
    expect(b.components.map((c) => c.name)).toEqual(['Jump', 'Mesh']);
    expect(b.components.find((c) => c.name === 'Mesh')!.files).toEqual([
      'Mesh.defs.ts',
      'Mesh.ts',
      'adapter/register.ts',
    ]);
    expect(b.files.map((f) => f.path).sort()).toEqual([
      'Components/Bullet/Bullet.events.ts',
      'Components/Jump/Jump.ts',
      'Components/Mesh/Mesh.defs.ts',
      'Components/Mesh/Mesh.ts',
      'Components/Mesh/adapter/register.ts',
      'inputEvents.ts',
    ]);
    expect(b.files.some((f) => f.content.startsWith('secret'))).toBe(false);
    expect(b.missing).toEqual(['Components/Paid/Paid']);
  });

  it('throws on a folder with no Components/', () => {
    expect(() => readLocalCoreBundle(mkTmp())).toThrow(/no Components/);
  });
});

describe('writeCoreBundle', () => {
  it('maps library paths into src/, never overwrites, and refuses escapes', () => {
    const root = mkTmp();
    put(root, 'src/components/Mesh/Mesh.ts', '// mine');
    const bundle: CoreBundle = {
      components: [],
      missing: [],
      files: [
        { path: 'Components/Mesh/Mesh.ts', content: 'theirs' },
        { path: 'Components/Mesh/adapter/register.ts', content: 'reg' },
        { path: 'inputEvents.ts', content: 'k' },
        { path: '../evil.ts', content: 'x' },
        { path: 'Components/../../evil.ts', content: 'x' },
      ],
    };
    const written = writeCoreBundle(root, bundle);
    expect(written.sort()).toEqual(['src/components/Mesh/adapter/register.ts', 'src/inputEvents.ts']);
    expect(fs.readFileSync(path.join(root, 'src/components/Mesh/Mesh.ts'), 'utf8')).toBe('// mine');
    expect(fs.existsSync(path.join(root, '..', 'evil.ts'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'evil.ts'))).toBe(false);
  });

  it('marks each core folder builtin in a meta.json, keeping one already there', () => {
    const root = mkTmp();
    put(root, 'src/components/Fog/meta.json', '{"name":"Fog","mine":true}');
    const bundle: CoreBundle = {
      components: [
        { name: 'Mesh', path: 'Components/Mesh', version: '1.0.0', files: ['Mesh.ts'], dependencies: ['MeshPrimitive'] },
        { name: 'Fog', path: 'Components/Fog', version: '1.0.0', files: ['Fog.ts'], dependencies: [] },
      ],
      missing: [],
      files: [
        { path: 'Components/Mesh/Mesh.ts', content: 'm' },
        { path: 'Components/Fog/Fog.ts', content: 'f' },
      ],
    };
    const written = writeCoreBundle(root, bundle);
    expect(written).toContain('src/components/Mesh/meta.json');
    expect(written).not.toContain('src/components/Fog/meta.json');
    const meta = JSON.parse(fs.readFileSync(path.join(root, 'src/components/Mesh/meta.json'), 'utf8'));
    expect(meta).toMatchObject({ name: 'Mesh', builtin: true, dependencies: ['MeshPrimitive'] });
    expect(fs.readFileSync(path.join(root, 'src/components/Fog/meta.json'), 'utf8')).toContain('"mine"');
  });

  it('projectPathFor matches where bjs download writes', () => {
    expect(projectPathFor('Components/X/X.ts')).toBe('src/components/X/X.ts');
    expect(projectPathFor('math/quat.ts')).toBe('src/math/quat.ts');
  });
});

describe('fetchCoreBundle / installCore', () => {
  const okBundle = assembleBundle(
    [{ name: 'Mesh', path: 'Components/Mesh', version: 'v1', files: ['Mesh.ts'], dependencies: [] }],
    () => 'export const Mesh = 1;',
  );
  const fakeFetch = (status: number, body: unknown) =>
    (async (url: string) => {
      expect(url).toBe('https://example.test/api/library/core');
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch;

  it('reads the public endpoint and installs it', async () => {
    const root = mkTmp();
    const r = await installCore(root, { apiUrl: 'https://example.test', fetchImpl: fakeFetch(200, okBundle) });
    expect(r.ok).toBe(true);
    expect(r.components).toEqual(['Mesh']);
    expect(fs.existsSync(path.join(root, 'src/components/Mesh/Mesh.ts'))).toBe(true);
  });

  it('reports a non-200 without throwing', async () => {
    const r = await installCore(mkTmp(), { apiUrl: 'https://example.test', fetchImpl: fakeFetch(500, {}) });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('500');
  });

  it('rejects a body that is not a bundle', async () => {
    await expect(fetchCoreBundle('https://example.test', fakeFetch(200, { files: 'no' }))).rejects.toThrow(
      /did not return a core bundle/,
    );
  });

  it('reports an empty core set as a failure', async () => {
    const r = await installCore(mkTmp(), {
      apiUrl: 'https://example.test',
      fetchImpl: fakeFetch(200, { components: [], files: [], missing: [] }),
    });
    expect(r.ok).toBe(false);
  });

  it('defaults to production and honours BJS_API_URL', () => {
    expect(coreApiUrl({})).toBe('https://babylonjsmarket.com');
    expect(coreApiUrl({ BJS_API_URL: 'http://localhost:5173/' })).toBe('http://localhost:5173');
  });
});
