import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import https from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { setImmediate } from 'node:timers/promises';
import test, { type TestContext } from 'node:test';
import { transcribeAudio } from '../gateway/transcription-provider.ts';

const LIMIT = 4_000_000;
const CHUNK = 1_000_000;

async function inputFor(t: TestContext) {
  const dir = await mkdtemp(path.join(tmpdir(), 'asr-response-budget-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'audio.wav');
  await writeFile(file, 'fixture audio');
  return { file, modelId: 'whisper-1', baseUrl: 'https://93.184.216.34', key: 'fixture-key',
    parameters: {}, offset: 0, duration: 600, signal: new AbortController().signal };
}

function largeStream(headers: HeadersInit = {}) {
  let produced = 0, cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (produced === 8 * CHUNK) { controller.close(); return; }
      produced += CHUNK;
      controller.enqueue(new Uint8Array(CHUNK).fill(32));
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 }), { headers });
  return { response, produced: () => produced, cancelled: () => cancelled };
}

for (const headers of [{}, { 'content-length': '10' }]) {
  test(`transcription stops streaming bytes over its budget (${Object.keys(headers).length ? 'underreported length' : 'no length'})`, async t => {
    const input = await inputFor(t), stream = largeStream(headers);
    let calls = 0;
    await assert.rejects(transcribeAudio(input, async () => { calls++; return stream.response; }), /response exceeds/);
    assert.equal(calls, 1, 'a failed paid submission is never repeated');
    assert.ok(stream.produced() <= LIMIT + CHUNK, `consumed ${stream.produced()} bytes`);
    assert.equal(stream.cancelled(), true);
  });
}

test('an oversized declared transcription body is cancelled before pulling it', async t => {
  const input = await inputFor(t), stream = largeStream({ 'content-length': String(8 * CHUNK) });
  await assert.rejects(transcribeAudio(input, async () => stream.response), /response exceeds/);
  assert.equal(stream.produced(), 0);
  assert.equal(stream.cancelled(), true);
});

test('transcription limits UTF-8 bytes even when the JSON character count fits', async t => {
  const input = await inputFor(t);
  const json = JSON.stringify({ text: 'Hello', padding: '界'.repeat(1_400_000) });
  assert.ok(json.length < LIMIT && Buffer.byteLength(json) > LIMIT);
  await assert.rejects(transcribeAudio(input, async () => new Response(json)), /response exceeds/);
});

test('a valid response exactly at the byte budget still returns its transcript', async t => {
  const input = await inputFor(t);
  const envelope = JSON.stringify({ text: 'Hello 世界', padding: '' });
  const json = JSON.stringify({ text: 'Hello 世界', padding: ' '.repeat(LIMIT - Buffer.byteLength(envelope)) });
  assert.equal(Buffer.byteLength(json), LIMIT);
  assert.deepEqual(await transcribeAudio(input, async () => new Response(json)), [{ id: 'segment-1', text: 'Hello 世界' }]);
});

test('a malformed bounded response still reports invalid JSON', async t => {
  const input = await inputFor(t);
  await assert.rejects(transcribeAudio(input, async () => new Response('{')), /Transcription provider returned invalid JSON/);
});

test('the default HTTPS transport enforces the transcription budget while receiving bytes', async t => {
  const input = await inputFor(t);
  let produced = 0, calls = 0;
  const response = Object.assign(new PassThrough(), { statusCode: 200, headers: {} });
  t.mock.method(https, 'request', (_url: URL, _options: unknown, respond: (body: typeof response) => void) => {
    calls++;
    const request = new EventEmitter() as EventEmitter & { setTimeout: () => void; write: () => void; end: () => void };
    request.setTimeout = () => {};
    request.write = () => {};
    request.end = () => {
      void (async () => {
        respond(response);
        while (!response.destroyed && produced < 8 * CHUNK) {
          produced += CHUNK;
          response.write(Buffer.alloc(CHUNK, 32));
          await setImmediate();
        }
        response.end();
      })();
    };
    return request;
  });
  await assert.rejects(transcribeAudio(input), /response exceeds/);
  assert.equal(calls, 1);
  assert.ok(produced <= LIMIT + CHUNK, `the transport buffered ${produced} bytes`);
  assert.equal(response.destroyed, true);
});
