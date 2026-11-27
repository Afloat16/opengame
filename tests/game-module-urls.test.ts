import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { GameProjects, gameHttp } from '../game-projects.ts';

const entry = '<canvas></canvas><script type="module" src="./src/main.js"></script>';

async function fixture(t: TestContext, files: { path: string; content: string }[]) {
  const workspace = await mkdtemp(path.join(tmpdir(), 'game-module-urls-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const service = new GameProjects(workspace, path.join(workspace, 'templates'), path.join(workspace, 'kits'));
  // HTML parsing is not under test: this exact fixture always has one external
  // module. Exercise the real module parser, file resolution and public service.
  service.runtimeRoot = path.join(workspace, 'runtime');
  const packages = path.join(service.runtimeRoot, 'node_modules');
  await mkdir(path.join(packages, '@hyperframes/parsers'), { recursive: true });
  await mkdir(path.join(packages, 'linkedom'), { recursive: true });
  await writeFile(path.join(packages, '@hyperframes/parsers/package.json'), '{"name":"@hyperframes/parsers"}');
  await writeFile(path.join(packages, 'linkedom/package.json'), '{"name":"linkedom","main":"index.cjs"}');
  await writeFile(path.join(packages, 'linkedom/index.cjs'), `
    exports.parseHTML = source => {
      if (source !== ${JSON.stringify(entry)}) throw Error('Unexpected HTML fixture');
      const script = { localName: 'script', closest: () => null,
        getAttribute: name => ({ type: 'module', src: './src/main.js' })[name] ?? null };
      return { document: { querySelector: () => null,
        querySelectorAll: selector => selector === 'script[src], link[href]' ? [script] : [] } };
    };
  `);
  const { game } = await service.create({ prompt: 'Module URLs', multiplayer: false, genre: 'racing', style: null, setting: null });
  await service.write(game.id, [{ path: 'index.html', content: entry }, ...files]);
  return { workspace, service, id: game.id };
}

test('validation accepts the same encoded module path served by the game endpoint', async t => {
  const source = 'export const name = "First level";';
  const { workspace, service, id } = await fixture(t, [
    { path: 'src/main.js', content: 'import "./first%20level.js?version=1#start";' },
    { path: 'src/first level.js', content: source },
  ]);
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void gameHttp(req, res, new URL(req.url!, 'http://localhost'), workspace, async () => ({}), service.runtimeRoot);
  });
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/games/${id}/play/src/first%20level.js?version=1`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), source);
  assert.deepEqual((await service.validate(id)).diagnostics, []);
  assert.equal((await service.publish(id)).game.status, 'published');
});

test('encoded imports retain their real parent path and are decoded exactly once', async t => {
  const { service, id } = await fixture(t, [
    { path: 'src/main.js', content: 'import "./level%23%3F/%E9%9B%AA.js";' },
    { path: 'src/level#?/雪.js', content: 'export { value } from "../value%2520literal.js";' },
    { path: 'src/value%20literal.js', content: 'export const value = 1;' },
  ]);
  assert.deepEqual((await service.validate(id)).diagnostics, []);
});

test('validation inspects syntax in transitively imported encoded module files', async t => {
  const { service, id } = await fixture(t, [
    { path: 'src/main.js', content: 'export * from "./first%20level.js";' },
    { path: 'src/first level.js', content: 'import("./broken%23module.js");' },
    { path: 'src/broken#module.js', content: 'export const = ;' },
  ]);
  const result = await service.validate(id);
  assert.equal(result.passed, false);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].path, 'src/broken#module.js');
  assert.match(result.diagnostics[0].message, /JavaScript syntax error/);
});

test('module URL resolution keeps unsafe and malformed paths inside validation diagnostics', async t => {
  const { service, id } = await fixture(t, [
    { path: 'src/main.js', content: [
      'import "../../outside.js";',
      'import "./bad%ZZ.js";',
      'import "./nested%2f..%2fexisting.js";',
      'import "./%2e%2e/%2e%2e/outside.js";',
    ].join('\n') },
    { path: 'src/existing.js', content: 'export const value = 1;' },
  ]);
  const result = await service.validate(id);
  assert.equal(result.passed, false);
  assert.equal(result.diagnostics.length, 4);
  assert.ok(result.diagnostics.every(row => row.path === 'src/main.js' && /Imported module/.test(row.message)));
});

test('ordinary relative module imports still resolve parent directories', async t => {
  const { service, id } = await fixture(t, [
    { path: 'src/main.js', content: 'import "./nested/module.js";' },
    { path: 'src/nested/module.js', content: 'export * from "../value.js?cache=1";' },
    { path: 'src/value.js', content: 'export const value = 1;' },
  ]);
  assert.deepEqual((await service.validate(id)).diagnostics, []);
});
