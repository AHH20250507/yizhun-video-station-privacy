import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const imageResult = index => ({ data: [{ url: `https://media.example.invalid/image-${index}.png` }] });

async function harness({ respectAbort = true } = {}) {
  // Each VM owns its Storage prototype: the client's privacy wrappers cannot leak between tests.
  class Storage {
    values = new Map();
    getItem(key) { return this.values.get(String(key)) ?? null; }
    setItem(key, value) { this.values.set(String(key), String(value)); }
    removeItem(key) { this.values.delete(String(key)); }
    clear() { this.values.clear(); }
  }
  const requests = [];
  const timers = new Set();
  const setTimer = (callback, ms) => {
    const timer = setTimeout(() => { timers.delete(timer); callback(); }, ms);
    timers.add(timer);
    return timer;
  };
  const clearTimer = timer => { timers.delete(timer); clearTimeout(timer); };
  const context = {
    localStorage: new Storage(), navigator: {}, console,
    URL, Blob, FormData, DOMException, AbortController, structuredClone,
    crypto: { randomUUID }, setTimeout: setTimer, clearTimeout: clearTimer,
    document: { addEventListener() {} },
    // Deliberately no real fetch: every request is intercepted and completed by the test.
    fetch(url, options = {}) {
      assert.equal(new URL(url).hostname, 'provider.example.invalid');
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      const request = {
        url, method: options.method, signal: options.signal,
        body: options.body ? JSON.parse(options.body) : null,
        resolve(body) { resolve({ ok: true, text: async () => JSON.stringify(body) }); },
        reject(error) { reject(error); }
      };
      requests.push(request);
      if (respectAbort) {
        const abort = () => reject(new DOMException('Mock request aborted', 'AbortError'));
        if (options.signal?.aborted) abort();
        else options.signal?.addEventListener('abort', abort, { once: true });
      }
      return promise;
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('task-regeneration.js'), context, { filename: 'task-regeneration.js' });
  vm.runInContext(read('standalone-client.js'), context, { filename: 'standalone-client.js' });
  await context.privacyReady;
  const client = context.StandaloneBackendClient;
  for (const operation of ['image', 'video', 'llm']) {
    client.saveConfig({ [operation]: {
      baseUrl: 'https://provider.example.invalid', apiKey: 'not-a-real-credential',
      model: 'test-model', models: ['test-model'], profiles: []
    } });
  }
  return { client, requests, dispose() { for (const timer of timers) clearTimeout(timer); } };
}

async function until(predicate) {
  for (let i = 0; i < 30; i += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  assert.ok(predicate(), 'Expected mocked async operation to reach the requested point');
}
const observe = promise => promise.then(value => ({ value }), error => ({ error }));
const batchRequest = extra => ({ operation: 'image', model: 'test-model', prompt: 'landscape', input: { n: 7 }, count: 7, ...extra });

function assertCanceled(error, task) {
  assert.ok(error, 'Cancellation must reject rather than return a late success');
  assert.equal(error.name, 'AbortError');
  assert.equal(error.task?.status, 'canceled');
  assert.equal(task.status, 'canceled');
  assert.ok(task.finishedAt);
}

test('cancelGeneration keeps canceled batch immutable after late success or failure', async t => {
  const h = await harness({ respectAbort: false }); t.after(h.dispose);
  const progress = [];
  const result = observe(h.client.createGeneration(batchRequest({ onProgress: task => progress.push(task) })));
  await until(() => h.requests.length === 3);
  const taskId = progress[0].id;
  // Listing tasks used to replace the live task object while createGeneration still held the old one.
  await h.client.listGenerations();
  const canceled = await h.client.cancelGeneration(taskId, 'stop this batch');
  const progressAtCancel = progress.length;
  h.requests[0].resolve(imageResult(0));
  h.requests[1].reject(new Error('late provider error'));
  h.requests[2].resolve(imageResult(2));
  let settled = false;
  result.then(() => { settled = true; });
  await until(() => {
    // Drain wrongly scheduled requests too, so a regression fails assertions rather than hanging.
    h.requests.slice(3).forEach((request, index) => request.resolve(imageResult(index + 3)));
    return settled;
  });
  const { error } = await result;
  const stored = await h.client.getGeneration(taskId);
  assertCanceled(error, stored);
  assert.deepEqual(plain(stored), plain(canceled), 'Late responses must not modify cancellation metadata or output');
  assert.equal(h.requests.length, 3);
  assert.equal(progress.length, progressAtCancel);
});

for (const operation of ['image', 'video', 'llm']) {
  for (const cancellation of ['signal', 'cancelGeneration']) {
    test(`${cancellation} prevents late ${operation} create result from overwriting canceled state`, async t => {
      const h = await harness({ respectAbort: false }); t.after(h.dispose);
      const controller = new AbortController();
      const result = observe(h.client.createGeneration({ operation, model: 'test-model', prompt: 'test', signal: controller.signal }));
      await until(() => h.requests.length === 1);
      const taskId = (await h.client.listGenerations())[0].id;
      if (cancellation === 'signal') controller.abort();
      else await h.client.cancelGeneration(taskId, 'keep this reason');
      h.requests[0].resolve(operation === 'image' ? imageResult(0)
        : operation === 'video' ? { url: 'https://media.example.invalid/video.mp4' }
          : { choices: [{ message: { content: 'late text' } }] });
      const { error } = await result;
      const stored = await h.client.getGeneration(taskId);
      assertCanceled(error, stored);
      assert.deepEqual(plain(stored.output), {});
      if (cancellation === 'cancelGeneration') assert.equal(stored.errorMessage, 'keep this reason');
    });
  }
}

async function queuedTask(h, batch = false) {
  const result = observe(h.client.createGeneration({ operation: batch ? 'image' : 'video', model: 'test-model', prompt: 'test', input: batch ? { n: 7 } : {} }));
  let settled = false;
  result.then(() => { settled = true; });
  await until(() => {
    h.requests.forEach((request, index) => request.resolve({ id: `provider-${index}`, status: 'queued' }));
    return settled;
  });
  const { value, error } = await result;
  assert.equal(error, undefined);
  assert.equal(value.task.status, 'queued');
  return value.task;
}

for (const batch of [false, true]) {
  for (const cancellation of ['signal', 'cancelGeneration']) {
    for (const response of ['success', 'error']) {
      test(`${cancellation} protects ${batch ? 'batch' : 'single'} polling from late ${response}`, async t => {
        const h = await harness({ respectAbort: false }); t.after(h.dispose);
        const task = await queuedTask(h, batch);
        const baseline = h.requests.length;
        const controller = new AbortController();
        const result = observe(h.client.getGeneration(task.id, controller.signal));
        await until(() => h.requests.length === baseline + (batch ? 3 : 1));
        await h.client.listGenerations();
        let canceled;
        if (cancellation === 'signal') controller.abort();
        else canceled = await h.client.cancelGeneration(task.id, 'stop polling');
        let settled = false;
        result.then(() => { settled = true; });
        await until(() => {
          h.requests.slice(baseline).forEach((request, index) => {
            if (response === 'error') request.reject(new Error('late parse or network failure'));
            else request.resolve(batch ? imageResult(index) : { url: 'https://media.example.invalid/video.mp4' });
          });
          return settled;
        });
        const { error } = await result;
        const stored = (await h.client.listGenerations()).find(row => row.id === task.id);
        assertCanceled(error, stored);
        if (canceled) assert.deepEqual(plain(stored), plain(canceled));
        assert.deepEqual(plain(stored.output), plain(task.output));
        assert.equal(h.requests.length, baseline + (batch ? 3 : 1), 'Polling must stop dispatching subsequent jobs');
      });
    }
  }
}

for (const cancellation of ['signal', 'cancelGeneration']) {
  test(`waitForGeneration ${cancellation} emits no progress or retry callback after cancel`, async t => {
    const h = await harness(); t.after(h.dispose);
    const task = await queuedTask(h);
    const baseline = h.requests.length;
    const controller = new AbortController();
    let progress = 0, retries = 0;
    const result = observe(h.client.waitForGeneration(task, {
      signal: controller.signal, intervalMs: 1,
      onProgress() { progress += 1; }, onTransientError() { retries += 1; }
    }));
    await until(() => h.requests.length === baseline + 1);
    if (cancellation === 'signal') controller.abort();
    else {
      await h.client.cancelGeneration(task.id);
      h.requests[baseline].resolve({ url: 'https://media.example.invalid/late.mp4' });
    }
    let settled = false;
    result.then(() => { settled = true; });
    await until(() => settled || retries > 0);
    assert.equal(retries, 0, 'Cancellation is not a transient polling failure');
    const { error } = await result;
    assert.equal(progress, 0);
    assertCanceled(error, (await h.client.listGenerations()).find(row => row.id === task.id));
    assert.equal(h.requests.length, baseline + 1);
  });
}

test('signal abort marks an in-flight batch canceled before an uncooperative network settles', async t => {
  const h = await harness({ respectAbort: false }); t.after(h.dispose);
  const controller = new AbortController();
  const progress = [];
  const result = observe(h.client.createGeneration(batchRequest({ signal: controller.signal, onProgress: task => progress.push(task) })));
  await until(() => h.requests.length === 3);
  const taskId = progress[0].id;
  controller.abort();
  const canceled = (await h.client.listGenerations()).find(task => task.id === taskId);
  h.requests.forEach((request, index) => request.resolve(imageResult(index)));
  await result;
  assert.equal(canceled.status, 'canceled', 'Abort must mark local state immediately, not wait for network');
  assert.ok(canceled.providerJobs.every(job => job.status === 'canceled'));
  assert.equal(h.requests.length, 3);
});

for (const batch of [false, true]) {
  test(`pre-aborted signal submits no ${batch ? 'batch' : 'single'} provider request`, async t => {
    const h = await harness(); t.after(h.dispose);
    const controller = new AbortController(); controller.abort();
    const { error } = await observe(h.client.createGeneration({ operation: 'image', model: 'test-model', prompt: 'test', input: { n: batch ? 7 : 1 }, signal: controller.signal }));
    assertCanceled(error, (await h.client.listGenerations())[0]);
    assert.equal(h.requests.length, 0);
  });
}

test('uncanceled image batch still completes all jobs with bounded concurrency and ordered output', async t => {
  const h = await harness(); t.after(h.dispose);
  const result = observe(h.client.createGeneration(batchRequest()));
  await until(() => h.requests.length === 3);
  assert.equal(h.requests.length, 3);
  let settled = false; result.then(() => { settled = true; });
  await until(() => {
    h.requests.forEach((request, index) => request.resolve(imageResult(index)));
    return settled;
  });
  const { value, error } = await result;
  assert.equal(error, undefined);
  assert.equal(value.task.status, 'completed');
  assert.equal(h.requests.length, 7);
  assert.deepEqual(plain(value.task.output.data), Array.from({ length: 7 }, (_, index) => imageResult(index).data[0]));
});

test('signal abort cancels image batch without progress or scheduling later jobs', async t => {
  const h = await harness(); t.after(h.dispose);
  const controller = new AbortController();
  const progress = [];
  const result = observe(h.client.createGeneration(batchRequest({ signal: controller.signal, onProgress: task => progress.push(task) })));
  await until(() => h.requests.length === 3);
  const taskId = progress[0].id;
  const progressAtCancel = progress.length;
  controller.abort();
  const { error } = await result;
  assertCanceled(error, await h.client.getGeneration(taskId));
  assert.equal(h.requests.length, 3, 'Only the three already in flight may have been submitted');
  assert.equal(progress.length, progressAtCancel, 'No callbacks after cancellation');
  assert.ok(h.requests.every(request => request.signal.aborted));
  assert.ok(error.task.providerJobs.every(job => job.status === 'canceled'));
});
