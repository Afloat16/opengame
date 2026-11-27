import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gameHttp, gameProjectsFor } from '../game-projects.ts';
import { startLocalGamePreview } from '../gateway/local-game-preview.ts';

function readUrl(url: URL, method = 'GET', headers: Record<string, string> = {}, hostname?: string) {
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>((resolve, reject) => {
    const req = request(url, { method, headers, ...(hostname ? { hostname } : {}) }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('game assets support bounded media ranges and body-free HEAD requests on both prefixes', async t => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'opengame-range-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const games = gameProjectsFor(workspace);
  games.templates = path.join(workspace, 'templates');
  games.kits = path.join(workspace, 'kits');
  const { game } = await games.create({ prompt: 'Range test', multiplayer: false });
  await writeFile(path.join(games.root, game.id, 'video.mp4'), '0123456789abcdef');
  const server = createServer(async (req, res) => {
    await gameHttp(req, res, new URL(req.url!, 'http://127.0.0.1'), workspace, async () => ({}));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const port = (server.address() as { port: number }).port;

  for (const prefix of ['/api/games', '/motion-api/games']) {
    const url = new URL(`http://127.0.0.1:${port}${prefix}/${game.id}/play/video.mp4`);
    const head = await readUrl(url, 'HEAD', { Range: 'bytes=2-5' });
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal(head.headers['content-length'], '16');
    assert.equal(head.headers['accept-ranges'], 'bytes');
    for (const [range, expected, bounds] of [
      ['bytes=2-5', '2345', '2-5'], ['bytes=10-', 'abcdef', '10-15'],
      ['bytes=-4', 'cdef', '12-15'], ['bytes=0-99', '0123456789abcdef', '0-15'],
      ['BYTES= 2-5', '2345', '2-5'],
    ]) {
      const result = await readUrl(url, 'GET', { Range: range });
      assert.equal(result.status, 206);
      assert.equal(result.body, expected);
      assert.equal(result.headers['content-range'], `bytes ${bounds}/16`);
      assert.equal(result.headers['content-length'], String(expected.length));
      assert.equal(result.headers['access-control-allow-origin'], '*');
    }
    for (const range of ['bytes=16-', 'bytes=5-2', 'bytes=-0', 'bytes=-']) {
      const result = await readUrl(url, 'GET', { Range: range });
      assert.equal(result.status, 416, range);
      assert.equal(result.headers['content-range'], 'bytes */16');
      assert.equal(result.body, '');
    }
    const ignoredRangeHeaders: Record<string, string>[] = [
      { Range: 'bytes=2-5', 'If-Range': '"unknown-validator"' },
      { Range: 'bytes=2-5', 'If-Range': '' },
      { Range: 'items=2-5' },
      { Range: 'bytes=0-1,4-5' },
    ];
    for (const headers of ignoredRangeHeaders) {
      const full = await readUrl(url, 'GET', headers);
      assert.equal(full.status, 200);
      assert.equal(full.body, '0123456789abcdef');
      assert.equal(full.headers['content-range'], undefined);
    }
  }
});

test('isolated template preview permits HEAD and range reads with its existing host boundary', async t => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'opengame-isolated-range-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const games = gameProjectsFor(workspace);
  games.templates = path.join(workspace, 'templates');
  const directory = path.join(games.templates, 'demo');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'game.json'), JSON.stringify({ id: 'demo', title: 'Demo', multiplayer: false }));
  await writeFile(path.join(directory, 'video.mp4'), '0123456789abcdef');
  const preview = await startLocalGamePreview(workspace);
  t.after(() => preview.close());
  const url = new URL(preview.url('demo').replace('index.html', 'video.mp4'));
  const headers = { Host: url.host };
  const head = await readUrl(url, 'HEAD', headers, '127.0.0.1');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], '16');
  const range = await readUrl(url, 'GET', { ...headers, Range: 'bytes=4-7' }, '127.0.0.1');
  assert.equal(range.status, 206);
  assert.equal(range.body, '4567');
  assert.equal(range.headers['origin-agent-cluster'], '?1');
  assert.equal((await readUrl(url, 'HEAD', { Host: 'wrong.localhost' }, '127.0.0.1')).status, 404);
});
