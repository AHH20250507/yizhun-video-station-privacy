import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';

const clientSource = fs.readFileSync(new URL('../standalone-client.js', import.meta.url), 'utf8');
const replaySource = fs.readFileSync(new URL('../task-regeneration.js', import.meta.url), 'utf8');
// Pillow-generated 2x2 red/blue animation: two frames, 200 ms each, infinite loop.
const animatedGif = 'R0lGODlhAgACAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAFAAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQBFAABACwAAAAAAgACAIEAAP8AAAAAAAAAAAAIBgABCAQQEAA7';
const model = 'gpt-image-2.6';

async function harness({ createPath = '/v1/images/generations', response = { data: [{ b64_json: animatedGif }] } } = {}) {
  class Storage {
    values = new Map();
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
    clear() { this.values.clear(); }
  }
  const blobs = new Map();
  const requests = [];
  const context = {
    localStorage: new Storage(), navigator: {}, document: { addEventListener() {} },
    console, Blob, FormData, DOMException, AbortController, structuredClone,
    crypto: { randomUUID }, setTimeout, clearTimeout, atob,
    URL: class extends URL {
      static createObjectURL(blob) { const url = `blob:format-${blobs.size + 1}`; blobs.set(url, blob); return url; }
      static revokeObjectURL(url) { blobs.delete(url); }
    },
    fetch: async (url, options = {}) => {
      if (blobs.has(String(url))) return { ok: true, blob: async () => blobs.get(String(url)) };
      requests.push({ url: String(url), ...options });
      const body = options.body instanceof FormData ? { url: 'https://provider.example.invalid/reference.png' } : response;
      return { ok: true, text: async () => JSON.stringify(body) };
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(replaySource, context);
  vm.runInContext(clientSource, context);
  await context.privacyReady;
  const client = context.StandaloneBackendClient;
  client.saveConfig({ image: { baseUrl: 'https://provider.example.invalid', apiKey: 'test-only', model, models: [model], createPath } });
  return { client, context, blobs, requests };
}

const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

test('model-local safe output formats survive discovery, profile normalization and catalog roundtrip', async () => {
  const response = {
    output_formats: ['gif'], // Provider-wide declarations must not leak to another model.
    data: [
      { id: model, output_formats: ['PNG', 'gif', 'svg', 'gif'], supported_output_formats: ['jpeg'], formats: ['webp'], secret: 'do-not-copy', input_schema: { properties: { output_format: { enum: ['gif', 'bmp'] } } } },
      { id: 'schema-only', schema: { properties: { output_format: { enum: ['gif', 'webp'] } } } },
      { id: 'nested', capabilities: { output_formats: ['gif'] }, metadata: { supported_output_formats: ['jpeg'], capabilities: { formats: ['png'] }, secret: 'do-not-copy' } },
      { id: 'unrelated' }
    ]
  };
  const h = await harness({ response });
  const profile = { id: 'format-profile', baseUrl: 'https://provider.example.invalid', apiKey: 'test-only', models: [] };
  const discovery = await h.client.discoverProviderModels('image', profile);
  assert.deepEqual(plain(discovery.modelMetadata[model].outputFormats), ['gif', 'png', 'jpeg', 'webp']);
  assert.deepEqual(plain(discovery.modelMetadata['schema-only'].outputFormats), ['gif', 'webp']);
  assert.deepEqual(plain(discovery.modelMetadata.nested.outputFormats), ['gif', 'jpeg', 'png']);
  assert.deepEqual(plain(discovery.modelMetadata.unrelated.outputFormats), []);
  assert.deepEqual(Object.keys(discovery.modelMetadata[model]).sort(), ['outputFormats', 'qualities', 'resolutions', 'sizes']);
  h.client.saveConfig({ image: { model, models: discovery.models, profiles: [{ ...profile, models: discovery.models, modelMetadata: discovery.modelMetadata }] } });
  const normalized = h.client.getConfig().image.profiles[0].modelMetadata;
  assert.deepEqual(plain(normalized[model].outputFormats), ['gif', 'png', 'jpeg', 'webp']);
  const rows = await h.client.request('/api/models');
  for (const row of rows.filter(row => row.operation === 'image')) {
    assert.deepEqual(plain(row.metadata.outputFormats), plain(normalized[row.model].outputFormats));
    assert.equal(row.metadata.secret, undefined);
    assert.equal(row.metadata.input_schema, undefined);
    assert.equal(row.metadata.schema, undefined);
  }
});

test('bare animated GIF base64 keeps both frames in one shared correctly typed Blob without requested format', async () => {
  const h = await harness();
  const result = await h.client.createGeneration({ operation: 'image', model, prompt: 'animate', input: {} });
  assert.equal(result.task.status, 'completed');
  const url = result.task.output.data[0].url;
  const blob = h.blobs.get(url);
  assert.equal(blob.type, 'image/gif');
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.deepEqual(bytes, Buffer.from(animatedGif, 'base64'));
  assert.equal(bytes.toString('ascii', 0, 6), 'GIF89a');
  assert.equal(bytes.toString('hex').split('21f904').length - 1, 2, 'both frame control blocks remain');
  assert.equal(h.blobs.size, 1);
  assert.equal(result.task.output.data[0].b64_json, undefined);
  assert.ok(JSON.stringify(result.task).length < 2048);
  const readBack = await h.client.getGeneration(result.task.id);
  assert.equal(readBack.output.data[0].url, url);
  const cached = await h.client.cacheGenerationMedia(result.task.id);
  assert.equal(cached.output.data[0].url, url);
  assert.equal(await h.client.fetchMediaBlob(cached.output._localMedia[0].id), blob);
  assert.equal(h.blobs.size, 1);
});

for (const [label, bytes, mime] of [
  ['GIF87a', Buffer.from('GIF87a\x00\x00', 'binary'), 'image/gif'],
  ['JPEG', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), 'image/jpeg'],
  ['PNG', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]), 'image/png'],
  ['WebP', Buffer.from('RIFF\x04\x00\x00\x00WEBPVP8 ', 'binary'), 'image/webp']
]) {
  test(`${label} signature determines MIME for bare bytes and overrides incorrect declared MIME without transcoding`, async () => {
    for (const field of ['b64_json', 'base64', 'image_base64', 'url', 'image_url', 'imageUrl', 'result_url', 'resultUrl']) {
      for (const declaration of ['image/x-mislabelled', null]) {
        const base64Field = ['b64_json', 'base64', 'image_base64'].includes(field);
        if (!declaration && !base64Field) continue;
        const source = `${declaration ? `DaTa:${declaration};base64,` : ''}${bytes.toString('base64')}`;
        const h = await harness({ response: { data: [{ [field]: source }] } });
        const result = await h.client.createGeneration({ operation: 'image', model, input: {} });
        const blob = h.blobs.get(result.task.output.data[0][base64Field ? 'url' : field]);
        assert.equal(blob.type, mime, `${field}, ${declaration}`);
        assert.deepEqual(Buffer.from(await blob.arrayBuffer()), bytes);
        assert.equal(h.blobs.size, 1);
      }
    }
  });
}

test('unknown signatures retain explicit Data URL MIME and bare-byte PNG compatibility fallback', async () => {
  for (const [encoded, mime] of [
    ['data:image/webp;base64,AQID', 'image/webp'],
    ['AQID', 'image/png'],
    [Buffer.from('RIFFnot-a-WebP').toString('base64'), 'image/png'],
    [Buffer.from('GIF89x').toString('base64'), 'image/png']
  ]) {
    const h = await harness({ response: { data: [{ b64_json: encoded }] } });
    const result = await h.client.createGeneration({ operation: 'image', model, input: {} });
    const blob = h.blobs.get(result.task.output.data[0].url);
    assert.equal(blob.type, mime);
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from(encoded.split(',').at(-1), 'base64'));
  }
});

test('invalid requested image formats fail before reference uploads and retain original task/replay parameters', async () => {
  for (const output_format of ['svg', 'jpg', 'GIF', '', null, 1, { format: 'gif' }]) {
    const h = await harness();
    const upload = await h.client.uploadReferenceMedia(new Blob(['reference'], { type: 'image/png' }));
    const input = { output_format, size: '1024x1024', images: [upload.reference] };
    await assert.rejects(h.client.createGeneration({ operation: 'image', model, prompt: '@图1', input }), error => {
      assert.match(error.message, /output_format.*png.*jpeg.*webp.*gif/i);
      assert.deepEqual(plain(error.task.input), input);
      assert.deepEqual(plain(h.client.getRegenerationSnapshot(error.task.id).request.input), input);
      assert.equal(error.task.status, 'failed');
      return true;
    });
    assert.equal(h.requests.length, 0, 'neither reference upload nor generation reaches network');
  }
});

test('GIF edits paths reject before reference uploads without discarding the references', async () => {
  for (const createPath of ['/v1/images/edits', '/v1/images/edits/', '/custom/images/edits?preview=1', '/custom/images/edits/#preview']) {
    const h = await harness({ createPath });
    const upload = await h.client.uploadReferenceMedia(new Blob(['reference'], { type: 'image/png' }));
    const input = { output_format: 'gif', images: [upload.reference] };
    await assert.rejects(h.client.createGeneration({ operation: 'image', model, prompt: '@图1', input }), error => {
      assert.match(error.message, /GIF.*\/images\/edits/i);
      assert.deepEqual(plain(error.task.input), input);
      assert.deepEqual(plain(h.client.getRegenerationSnapshot(error.task.id).request.input), input);
      return true;
    });
    assert.equal(h.requests.length, 0);
  }
});

for (const count of [1, 2]) {
  test(`GIF JSON generation and replay preserve exact requested parameters for ${count} result(s)`, async () => {
    const h = await harness();
    const input = { output_format: 'gif', quality: 'high', size: '1024x1024', provider_option: { preserve: true } };
    const result = await h.client.createGeneration({ operation: 'image', model, prompt: 'animate red to blue', input, count });
    assert.equal(result.task.status, 'completed');
    assert.deepEqual(plain(result.task.input), input);
    assert.equal(h.requests.length, count);
    for (const request of h.requests) {
      assert.equal(request.headers['Content-Type'], 'application/json');
      assert.equal(request.body instanceof FormData, false);
      assert.deepEqual(JSON.parse(request.body), { model, prompt: 'animate red to blue', n: 1, ...input });
    }
    const snapshot = h.client.getRegenerationSnapshot(result.task.id);
    assert.deepEqual(plain(snapshot.request.input), input);
    snapshot.request.input.output_format = 'png';
    const original = h.client.getRegenerationSnapshot(result.task.id);
    assert.equal(original.request.input.output_format, 'gif', 'snapshot callers cannot mutate the retained request');
    const replay = await h.client.createGeneration(h.context.TaskRegeneration.toRequest(original));
    assert.deepEqual(plain(replay.task.input), input);
    assert.equal(h.requests.length, count * 2);
    for (const blob of h.blobs.values()) {
      assert.equal(blob.type, 'image/gif');
      assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from(animatedGif, 'base64'));
    }
  });
}

test('allowed static formats remain valid, including edits with references', async () => {
  for (const output_format of ['png', 'jpeg', 'webp']) {
    const h = await harness({ createPath: '/v1/images/edits' });
    const input = { output_format, images: ['https://provider.example.invalid/reference.png'] };
    const result = await h.client.createGeneration({ operation: 'image', model, input });
    assert.equal(result.task.status, 'completed');
    assert.deepEqual(JSON.parse(h.requests[0].body).images, input.images);
    assert.equal(JSON.parse(h.requests[0].body).output_format, output_format);
  }
});

test('GIF generation with references retains the references rather than silently switching to text-only generation', async () => {
  const h = await harness();
  const input = { output_format: 'gif', images: ['https://provider.example.invalid/reference.png'] };
  const result = await h.client.createGeneration({ operation: 'image', model, prompt: '@图1', input });
  assert.equal(result.task.status, 'completed');
  assert.deepEqual(JSON.parse(h.requests[0].body).images, input.images);
  assert.deepEqual(plain(h.client.getRegenerationSnapshot(result.task.id).request.input), input);
});
