import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
function api() {
  const context = { window: {} };
  vm.runInNewContext(read('task-regeneration.js'), context);
  return context.window.TaskRegeneration;
}
const plain = value => JSON.parse(JSON.stringify(value));
const request = () => ({ mode: 'creation', operation: 'image', model: 'original-image-model', prompt: '@图2站在@图1旁边，@图2保持原服装', input: { images: ['media://first', 'media://second'], size: '1536x1024', n: 2 }, count: 2 });
const refs = () => [
  { tag: '@图1', type: 'image', reference: 'media://first', url: 'blob:first', fileName: 'first.png', id: 'one' },
  { tag: '@图2', type: 'image', reference: 'media://second', url: 'blob:second', fileName: 'second.png', id: 'two' }
];
test('regeneration freezes exact prompt, model, parameters and tag-to-media order', () => {
  const r = request(), media = refs(), snapshot = api().capture(r, media);
  r.prompt = 'changed'; r.input.images.reverse(); media[0].tag = '@图2'; media[1].url = 'blob:other';
  assert.deepEqual(plain(snapshot.request), request());
  assert.deepEqual(plain(snapshot.refMediaList), refs());
  api().validate(snapshot);
});
test('each replay gets independent input with no old request id or signal', () => {
  const a = api(), r = request(); r.requestId = 'old-task'; r.signal = { aborted: false }; r.apiKey = 'not-a-real-credential';
  const snapshot = a.capture(r, refs());
  const first = a.toRequest(snapshot), second = a.toRequest(snapshot);
  first.input.images[0] = 'changed';
  assert.equal(second.input.images[0], 'media://first');
  assert.equal(second.requestId, undefined); assert.equal(second.signal, undefined); assert.equal(second.apiKey, undefined);
});
test('missing or swapped mention materials cannot silently become text-only requests', () => {
  const a = api();
  assert.throws(() => a.validate(a.capture(request(), [refs()[0]])), /@图2/);
  const swapped = refs(); swapped[0].reference = 'media://second'; swapped[1].reference = 'media://first';
  assert.throws(() => a.validate(a.capture(request(), swapped)), /对应|顺序/);
  const duplicate = refs(); duplicate[1].tag = '@图1';
  assert.throws(() => a.validate(a.capture(request(), duplicate)), /重复/);
});
test('mixed image video audio tags remain matched to the original typed arrays', () => {
  const a = api();
  const r = { mode: 'creation', operation: 'video', model: 'original-video', prompt: '@图3的声音配合@图2与@图1', input: { images: ['media://i'], videos: ['media://v'], audios: ['media://a'], resolution: '1080p', duration: 8, metadata: { aspect_ratio: '16:9' }, n: 1 }, duration: 8 };
  const media = [{ tag: '@图1', type: 'image', reference: 'media://i' }, { tag: '@图2', type: 'video', reference: 'media://v' }, { tag: '@图3', type: 'audio', reference: 'media://a' }];
  const snapshot = a.capture(r, media); a.validate(snapshot);
  assert.deepEqual(plain(a.toRequest(snapshot)), r);
});
test('pure text tasks can replay without references but unknown old snapshots fail closed', () => {
  const a = api();
  a.validate(a.capture({ operation: 'image', model: 'original', prompt: '只生成风景', input: { n: 1 } }, []));
  assert.throws(() => a.validate(null), /原始|快照/);
});
test('canceled replay does not become failed or write a late result', () => {
  const app = read('app.js');
  assert.ok(app.includes("if (controller?.signal.aborted || (replayId && SessionSystem.isTaskCanceled(replayId))) return;"));
  assert.ok(app.includes('taskReplayControllers.get(taskId)?.abort()'));
});

test('all media task UIs wire regeneration and exact inline reference rendering', () => {
  const app = read('app.js'), client = read('standalone-client.js'), html = read('index.html');
  assert.match(html, /task-regeneration\.js/);
  assert.match(app, /data-regenerate-task/);
  assert.match(app, /data-ma-action="regenerate"/);
  assert.match(app, /function renderTaskReferencePrompt/);
  assert.match(app, /async function regenerateGenerationTask/);
  assert.match(app, /regenerationRefs: refMediaList/);
  assert.match(client, /TaskRegeneration\.capture/);
  assert.match(client, /getRegenerationSnapshot/);
  assert.match(client, /参考素材.*失效/);
  assert.doesNotMatch(client, /prepared\[key\] = values\.filter\(Boolean\)/);
});
