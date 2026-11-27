import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { applySourceUpdate, type ExecRunner } from '../shared/source-update.ts';

const previous = '1'.repeat(40), target = '2'.repeat(40);

async function fixture(t: { after: (fn: () => Promise<void>) => void }, fetchHook: () => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), 'opengame-update-lock-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repoRoot = path.join(root, 'checkout');
  await mkdir(path.join(repoRoot, '.git'), { recursive: true });
  await mkdir(path.join(repoRoot, 'studio/build'), { recursive: true });
  await writeFile(path.join(repoRoot, 'studio/build/index.html'), '<html>existing build</html>');
  let head = previous, tracking = previous;
  const exec: ExecRunner = async (file, rawArgs) => {
    assert.equal(file, 'git');
    const args = rawArgs.filter((arg, index) => arg !== '-c' && rawArgs[index - 1] !== '-c');
    let stdout = '';
    switch (args[0]) {
      case 'symbolic-ref': stdout = 'main'; break;
      case 'status': break;
      case 'rev-parse':
        if (args[1] === 'HEAD') stdout = head;
        else if (args[1] === '--verify') stdout = tracking;
        else if (args[1] === '--is-shallow-repository') stdout = 'false';
        else if (args[1] === 'FETCH_HEAD') stdout = target;
        else assert.fail(`Unexpected rev-parse: ${args.join(' ')}`);
        break;
      case 'fetch': await fetchHook(); break;
      case 'merge-base': break;
      case 'diff': stdout = 'game-projects.ts\n'; break;
      case 'reset': head = args[2]; break;
      case 'update-ref': tracking = args[2]; break;
      default: assert.fail(`Unexpected command: ${args.join(' ')}`);
    }
    return { stdout, stderr: '' };
  };
  return {
    update: (workspace: string) => applySourceUpdate({
      repoRoot, dataDirectory: path.join(root, workspace), homeDirectory: path.join(root, 'home'),
      exec, restartBackend: false,
    }),
  };
}

test('different workspaces serialize updates of the same checkout', { timeout: 5000 }, async (t) => {
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let fetches = 0;
  const app = await fixture(t, async () => {
    if (++fetches === 1) { entered.resolve(); await release.promise; }
  });
  const first = app.update('workspace-a');
  await entered.promise;
  const second = app.update('workspace-b');
  let completedBeforeRelease: boolean;
  try {
    completedBeforeRelease = await Promise.race([second.then(() => true), delay(200, false)]);
  } finally {
    release.resolve();
  }
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(completedBeforeRelease, false, 'the second workspace updated while the first held the checkout');
  assert.equal(firstResult.status, 'updated');
  assert.equal(secondResult.status, 'up_to_date');
});

test('separate checkouts can update at the same time', { timeout: 5000 }, async (t) => {
  const bothEntered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let fetches = 0;
  const onFetch = async () => {
    if (++fetches === 2) bothEntered.resolve();
    await release.promise;
  };
  const firstApp = await fixture(t, onFetch), secondApp = await fixture(t, onFetch);
  const pending = [firstApp.update('workspace'), secondApp.update('workspace')];
  let simultaneous: boolean;
  try {
    simultaneous = await Promise.race([bothEntered.promise.then(() => true), delay(1000, false)]);
  } finally {
    release.resolve();
  }
  const results = await Promise.all(pending);
  assert.equal(simultaneous, true, 'independent checkouts should not share an update lock');
  assert.ok(results.every(result => result.status === 'updated'));
});
