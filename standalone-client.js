/*
 * Standalone browser data/API layer.
 * Privacy mode keeps only the user's provider configuration in localStorage.
 * Tasks, sessions, uploads and generated media remain in memory and disappear
 * when the page is refreshed or closed.
 */
(() => {
  'use strict';

  window.STANDALONE_MODE = true;
  window.PRIVACY_EPHEMERAL_MODE = true;

  const CONFIG_KEY = 'vkb_standalone_provider_config_v2';
  const LEGACY_CONFIG_KEY = 'vkb_standalone_provider_config_v1';
  const ALLOWED_LOCAL_STORAGE_KEYS = new Set([CONFIG_KEY]);
  const volatileLocalStorage = new Map();
  const storagePrototype = Object.getPrototypeOf(window.localStorage);
  const storageGetItem = storagePrototype.getItem;
  const storageSetItem = storagePrototype.setItem;
  const storageRemoveItem = storagePrototype.removeItem;
  const storageClear = storagePrototype.clear;
  const legacyProviderConfigRaw = storageGetItem.call(window.localStorage, LEGACY_CONFIG_KEY);
  const LEGACY_APP_STORAGE_KEYS = [
    LEGACY_CONFIG_KEY,
    'api_apiKey', 'api_llmKey', 'api_imageApiKey', 'api_baseUrl', 'api_llmBaseUrl', 'api_imageBaseUrl',
    'api_model', 'api_duration', 'api_llmModelName', 'api_imageModel', 'api_imageModels',
    'api_task_history', 'api_latest_status', 'vkb_script_history', 'vkb_current_script',
    'vkb_canvas_state', 'vkb_canvas_library', 'video_prompt_kb_long_script_state',
    'vkb_active_session_id', 'vkb_sessions_migrated_v1', 'vkb_creation_history_view',
    'vkb_lens_prompts', 'vkb_assets', 'vkb_prompt_templates', 'vkb_uploaded_resources',
    'vkb_multi_angle_results', 'vkb_multi_angle_cleared_at', 'vkb_admin_model_mode',
    'chat_generation_mode', 'chat_image_aspect', 'chat_image_count', 'sidebar_collapsed',
    'vkb_backend_url', 'vkb_access_token', 'vkb_auth_user', 'vkb_logged_user'
  ];

  LEGACY_APP_STORAGE_KEYS.forEach(key => storageRemoveItem.call(window.localStorage, key));

  storagePrototype.getItem = function privacyGetItem(key) {
    if (this !== window.localStorage) return storageGetItem.call(this, key);
    const normalizedKey = String(key);
    return ALLOWED_LOCAL_STORAGE_KEYS.has(normalizedKey)
      ? storageGetItem.call(this, normalizedKey)
      : (volatileLocalStorage.has(normalizedKey) ? volatileLocalStorage.get(normalizedKey) : null);
  };
  storagePrototype.setItem = function privacySetItem(key, value) {
    if (this !== window.localStorage) return storageSetItem.call(this, key, value);
    const normalizedKey = String(key);
    const normalizedValue = String(value);
    if (ALLOWED_LOCAL_STORAGE_KEYS.has(normalizedKey)) storageSetItem.call(this, normalizedKey, normalizedValue);
    else volatileLocalStorage.set(normalizedKey, normalizedValue);
  };
  storagePrototype.removeItem = function privacyRemoveItem(key) {
    if (this !== window.localStorage) return storageRemoveItem.call(this, key);
    const normalizedKey = String(key);
    if (ALLOWED_LOCAL_STORAGE_KEYS.has(normalizedKey)) storageRemoveItem.call(this, normalizedKey);
    volatileLocalStorage.delete(normalizedKey);
  };
  storagePrototype.clear = function privacyClear() {
    if (this !== window.localStorage) return storageClear.call(this);
    storageClear.call(this);
    volatileLocalStorage.clear();
  };

  const DB_NAME = 'vkbStandaloneData';
  const DB_VERSION = 1;
  const volatileStores = new Map(['tasks', 'media', 'prompts', 'assets'].map(name => [name, new Map()]));
  const terminal = new Set(['completed', 'failed', 'refunded', 'canceled']);
  const liveTasks = new Map();
  const liveMedia = new Map();
  const DEFAULT_IMAGE_MODELS = [
    'gpt-image-2',
    'gpt-image-2.5-flare',
    'gpt-image-2.5-sunburst',
    'nano-banana-2'
  ];

  const DEFAULTS = {
    video: { baseUrl: '', apiKey: '', model: 'sora-v3-2.5-720p-per-second', models: ['sora-v3-2.5-720p-per-second'], profiles: [], createPath: '/v1/videos', pollPath: '/v1/videos/{id}', uploadPath: '/v1/media/uploads' },
    image: { baseUrl: '', apiKey: '', model: DEFAULT_IMAGE_MODELS[0], models: DEFAULT_IMAGE_MODELS, profiles: [], createPath: '/v1/images/generations', pollPath: '/v1/image/generations/{id}', uploadPath: '/v1/media/uploads' },
    llm: { baseUrl: '', apiKey: '', model: 'gpt-5.6-sol', models: ['gpt-5.6-sol'], profiles: [], createPath: '/v1/chat/completions' }
  };
  const PROVIDER_LABELS = { image: '图片', llm: '语言', video: '视频' };

  const localUser = { id: 'local-user', username: '本地模式', role: 'admin', isActive: true };
  const localWallet = { balance: 0, reserved: 0, available: 0 };

  function deleteLegacyDatabase(name) {
    return new Promise(resolve => {
      if (!window.indexedDB) return resolve({ name, status: 'unsupported' });
      let settled = false;
      const finish = status => {
        if (settled) return;
        settled = true;
        resolve({ name, status });
      };
      try {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => finish('deleted');
        request.onerror = () => finish('error');
        request.onblocked = () => window.setTimeout(() => finish('blocked'), 1500);
      } catch {
        finish('error');
      }
    });
  }

  const serviceWorkerCleanup = 'serviceWorker' in navigator
    ? navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .then(results => ({ name: 'serviceWorker', status: results.every(Boolean) ? 'deleted' : 'error' }))
      .catch(() => ({ name: 'serviceWorker', status: 'error' }))
    : Promise.resolve({ name: 'serviceWorker', status: 'unsupported' });
  const cacheCleanup = 'caches' in window
    ? caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(results => ({ name: 'cacheStorage', status: results.every(Boolean) ? 'deleted' : 'error' }))
      .catch(() => ({ name: 'cacheStorage', status: 'error' }))
    : Promise.resolve({ name: 'cacheStorage', status: 'unsupported' });

  window.privacyReady = Promise.all([
    serviceWorkerCleanup,
    cacheCleanup,
    ...['vkbStandaloneData', 'videoPromptKbSessions', 'videoPromptKbImageResults'].map(deleteLegacyDatabase)
  ]).then(results => {
    const failures = results.filter(result => result && ['error', 'blocked'].includes(result.status));
    if (failures.length) throw new Error(`旧浏览器数据清理未完成：${failures.map(item => `${item.name} ${item.status}`).join('、')}`);
    return results;
  });

  function clone(value) {
    if (value === undefined) return undefined;
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function uid(prefix = '') {
    const id = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-4${Math.random().toString(16).slice(2, 5)}-a${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 14)}`;
    return prefix ? `${prefix}${id}` : id;
  }

  function nowIso() { return new Date().toISOString(); }

  function uniqueModels(values, fallback = []) {
    const source = Array.isArray(values) ? values : String(values || '').split(/[\n,，]/);
    const models = [...new Set(source.map(value => String(value || '').trim()).filter(Boolean))];
    return models.length ? models : [...fallback];
  }

  function readEmbeddedConfig() {
    return {};
  }

  function normalizeProviderProfile(profile = {}, index = 0, name = 'image') {
    return {
      id: String(profile.id || `${name}-${index + 1}`).trim(),
      label: String(profile.label || `${PROVIDER_LABELS[name] || name} Key ${index + 1}`).trim(),
      baseUrl: normalizeBaseUrl(profile.baseUrl || ''),
      apiKey: String(profile.apiKey || '').trim(),
      models: uniqueModels(profile.models)
    };
  }

  function normalizeProviderConfig(config = {}, name = 'image') {
    const model = String(config.model || '').trim();
    const fallbackModels = name === 'image' ? DEFAULT_IMAGE_MODELS : uniqueModels(DEFAULTS[name]?.models);
    let profiles = (Array.isArray(config.profiles) ? config.profiles : [])
      .map((profile, index) => normalizeProviderProfile(profile, index, name))
      .filter(profile => profile.baseUrl || profile.apiKey || profile.models.length);
    const hasExplicitModels = Array.isArray(config.models);
    const legacyModels = uniqueModels(config.models, hasExplicitModels ? [] : (model ? [model] : fallbackModels));
    if (!profiles.length && (config.baseUrl || config.apiKey)) {
      profiles = [normalizeProviderProfile({ id: `${name}-primary`, label: `${PROVIDER_LABELS[name] || name} Key 1`, baseUrl: config.baseUrl, apiKey: config.apiKey, models: legacyModels }, 0, name)];
    }
    const models = uniqueModels([...legacyModels, ...profiles.flatMap(profile => profile.models)]);
    const defaultModel = model && models.includes(model) ? model : models[0];
    const defaultProfile = profiles.find(profile => profile.models.includes(defaultModel)) || profiles[0];
    return {
      ...config,
      baseUrl: normalizeBaseUrl(config.baseUrl || defaultProfile?.baseUrl || ''),
      apiKey: String(config.apiKey || defaultProfile?.apiKey || '').trim(),
      model: defaultModel || '',
      models,
      profiles
    };
  }

  function normalizeImageProfile(profile = {}, index = 0) {
    return normalizeProviderProfile(profile, index, 'image');
  }

  function normalizeImageConfig(config = {}) {
    return normalizeProviderConfig(config, 'image');
  }

  function localMediaUrl() {
    return '';
  }

  function readConfig() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); } catch {}
    if (!Object.keys(saved).length) {
      try {
        const legacy = JSON.parse(legacyProviderConfigRaw || '{}');
        saved = legacy && typeof legacy === 'object' ? legacy : {};
      } catch {}
      if (Object.keys(saved).length) storageSetItem.call(window.localStorage, CONFIG_KEY, JSON.stringify(saved));
    }
    const embedded = readEmbeddedConfig();
    const mergedProvider = name => ({
      ...DEFAULTS[name],
      ...(embedded[name] || {}),
      ...(saved[name] || {}),
      models: saved[name]?.models || embedded[name]?.models || (saved[name]?.model ? [saved[name].model] : DEFAULTS[name].models),
      profiles: saved[name]?.profiles || embedded[name]?.profiles || DEFAULTS[name].profiles
    });
    return {
      video: normalizeProviderConfig(mergedProvider('video'), 'video'),
      image: normalizeProviderConfig(mergedProvider('image'), 'image'),
      llm: normalizeProviderConfig(mergedProvider('llm'), 'llm')
    };
  }

  function writeConfig(next) {
    const current = readConfig();
    const merged = {
      video: normalizeProviderConfig({ ...current.video, ...(next.video || {}) }, 'video'),
      image: normalizeProviderConfig({ ...current.image, ...(next.image || {}) }, 'image'),
      llm: normalizeProviderConfig({ ...current.llm, ...(next.llm || {}) }, 'llm')
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
    return merged;
  }

  function clearStoredConfig() {
    storageRemoveItem.call(window.localStorage, CONFIG_KEY);
    volatileLocalStorage.clear();
    return readConfig();
  }

  function hasAnyConfiguredProvider() {
    const config = readConfig();
    return ['video', 'image', 'llm'].some(name => config[name].profiles?.some(profile => profile.baseUrl && profile.apiKey) || (config[name].baseUrl && config[name].apiKey));
  }

  function memoryStore(name) {
    if (!volatileStores.has(name)) volatileStores.set(name, new Map());
    return volatileStores.get(name);
  }

  function openDb() {
    if (window.PRIVACY_EPHEMERAL_MODE) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        ['tasks', 'media', 'prompts', 'assets'].forEach(name => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('浏览器本地数据库打开失败'));
    });
  }

  async function dbRun(storeName, mode, executor) {
    if (window.PRIVACY_EPHEMERAL_MODE) {
      const store = memoryStore(storeName);
      const adapter = {
        put(value) { store.set(value.id, clone(value)); return { result: value }; },
        delete(id) { store.delete(id); return { result: undefined }; },
        get(id) { return { result: clone(store.get(id)) }; },
        getAll() { return { result: [...store.values()].map(clone) }; }
      };
      const result = executor(adapter);
      return result?.result ?? result;
    }
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      try { result = executor(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result?.result ?? result);
      tx.onerror = () => reject(tx.error || new Error('浏览器本地数据库操作失败'));
      tx.onabort = () => reject(tx.error || new Error('浏览器本地数据库操作已取消'));
    }).finally(() => db.close());
  }

  async function dbGet(store, id) {
    if (window.PRIVACY_EPHEMERAL_MODE) return clone(memoryStore(store).get(id)) || null;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  async function dbAll(store) {
    if (window.PRIVACY_EPHEMERAL_MODE) return [...memoryStore(store).values()].map(clone);
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  async function dbPut(store, value) {
    if (window.PRIVACY_EPHEMERAL_MODE) {
      memoryStore(store).set(value.id, clone(value));
      return value;
    }
    await dbRun(store, 'readwrite', objectStore => objectStore.put(clone(value)));
    return value;
  }

  async function dbDelete(store, id) {
    if (window.PRIVACY_EPHEMERAL_MODE) {
      memoryStore(store).delete(id);
      return;
    }
    await dbRun(store, 'readwrite', objectStore => objectStore.delete(id));
  }

  function normalizeBaseUrl(value) {
    let url = String(value || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const parsed = new URL(url);
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback)) {
      throw new Error('仅允许 HTTPS API 地址；本机 localhost/127.0.0.1 可使用 HTTP');
    }
    return parsed.href.replace(/\/+$/, '');
  }

  function joinUrl(baseUrl, path) {
    const base = normalizeBaseUrl(baseUrl);
    const suffix = String(path || '').startsWith('/') ? String(path) : `/${path}`;
    if (/\/v1$/i.test(base) && /^\/v1\//i.test(suffix)) return `${base}${suffix.slice(3)}`;
    return `${base}${suffix}`;
  }

  function providerFor(operation) {
    return operation === 'image' ? 'image' : operation === 'video' ? 'video' : 'llm';
  }

  function configuredProvider(operation, model = '') {
    const name = providerFor(operation);
    const provider = readConfig()[name];
    if (provider.profiles?.length) {
      const profile = provider.profiles.find(candidate => candidate.models.includes(model))
        || provider.profiles.find(candidate => candidate.models.includes(provider.model))
        || provider.profiles[0];
      if (!profile?.baseUrl || !profile?.apiKey) {
        throw new Error(`${PROVIDER_LABELS[name] || name}模型 ${model || provider.model} 对应的 API 地址或 Key 未配置`);
      }
      return { ...provider, ...profile, name, cacheKey: `${name}:${profile.id}`, profileId: profile.id };
    }
    if (!provider.baseUrl || !provider.apiKey) {
      const label = name === 'image' ? '图片' : name === 'video' ? '视频' : 'LLM';
      const error = new Error(`请先点击右上角“API 设置”，填写${label} API 地址和 Key`);
      error.code = 'API_NOT_CONFIGURED';
      throw error;
    }
    return { name, ...provider };
  }

  async function providerRequest(provider, path, options = {}) {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Number(options.timeoutMs || 420000));
    const externalAbortHandler = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', externalAbortHandler, { once: true });
    }
    try {
      const response = await fetch(joinUrl(provider.baseUrl, path), {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...(options.headers || {})
        }
      });
      const raw = await response.text();
      let body = null;
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
      if (!response.ok) {
        const detail = body?.error?.message || body?.message || body?.error || raw || response.statusText;
        const error = new Error(`供应商请求失败 HTTP ${response.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
        error.status = response.status;
        throw error;
      }
      return body || {};
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (!timedOut && options.signal?.aborted) throw new DOMException('请求已取消', 'AbortError');
        throw new Error('供应商请求超时，请稍后查询任务或重试');
      }
      if (/Failed to fetch/i.test(String(error?.message))) {
        throw new Error('浏览器无法连接 API。请检查地址、网络及供应商是否允许跨域访问（CORS）');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
      options.signal?.removeEventListener?.('abort', externalAbortHandler);
    }
  }

  function statusOf(data) {
    return String(data?.status || data?.state || data?.data?.status || data?.data?.state || '').toLowerCase();
  }

  function providerTaskIdOf(data) {
    return data?.id || data?.task_id || data?.taskId || data?.data?.id || data?.data?.task_id || data?.data?.taskId || null;
  }

  function imageSources(data) {
    const result = [];
    const visit = value => {
      if (!value) return;
      if (Array.isArray(value)) return value.forEach(visit);
      if (typeof value !== 'object') return;
      const url = value.url || value.image_url || value.imageUrl || value.result_url || value.resultUrl;
      if (typeof url === 'string' && url) result.push(url);
      const b64 = value.b64_json || value.base64 || value.image_base64;
      if (typeof b64 === 'string' && b64) result.push(b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`);
      visit(value.data); visit(value.result); visit(value.images);
    };
    visit(data);
    return [...new Set(result)];
  }

  function videoSource(data) {
    return data?.url || data?.video_url || data?.videoUrl || data?.metadata?.url || data?.metadata?.video_url
      || data?.data?.url || data?.data?.video_url || data?.data?.metadata?.url
      || data?.output?.url || data?.output?.video_url || data?.result?.url
      || (Array.isArray(data?.videos) ? (typeof data.videos[0] === 'string' ? data.videos[0] : data.videos[0]?.url) : '') || '';
  }

  function textSource(data) {
    return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.content || data?.text || data?.output_text || '';
  }

  function hasOutput(operation, data) {
    return operation === 'image' ? imageSources(data).length > 0 : operation === 'video' ? Boolean(videoSource(data)) : Boolean(textSource(data));
  }

  function isSuccess(status) { return ['completed', 'complete', 'success', 'successful', 'succeeded', 'done', 'finished'].includes(status); }
  function isFailure(status) { return ['failed', 'failure', 'error', 'errored', 'canceled', 'cancelled'].includes(status); }

  async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index], index);
      }
    });
    await Promise.all(runners);
    return results;
  }

  function imageJobFromOutput(output, index) {
    const providerStatus = statusOf(output);
    const providerTaskId = providerTaskIdOf(output);
    if (isFailure(providerStatus)) {
      return {
        index,
        status: providerStatus.startsWith('cancel') ? 'canceled' : 'failed',
        providerTaskId,
        output,
        errorMessage: output?.error?.message || output?.message || `供应商返回失败状态：${providerStatus}`
      };
    }
    if (hasOutput('image', output)) return { index, status: 'completed', providerTaskId, output, errorMessage: null };
    if (isSuccess(providerStatus)) throw new Error('供应商返回完成状态，但没有可识别的图片结果');
    if (providerTaskId) return { index, status: 'queued', providerTaskId, output, errorMessage: null };
    throw new Error('供应商没有返回图片结果或可查询的任务 ID');
  }

  function updateImageBatchTask(task) {
    const jobs = Array.isArray(task.providerJobs) ? task.providerJobs : [];
    const requested = Math.max(1, Number(task.input?.n || jobs.length || 1));
    const sources = [...new Set(jobs.flatMap(job => imageSources(job.output || {})))].slice(0, requested);
    const pending = jobs.filter(job => !terminal.has(job.status));
    const failed = jobs.filter(job => ['failed', 'canceled'].includes(job.status));
    task.providerTaskId = pending.find(job => job.providerTaskId)?.providerTaskId
      || jobs.find(job => job.providerTaskId)?.providerTaskId
      || null;
    task.output = {
      data: sources.map(source => ({ url: source })),
      batch: { requested, generated: sources.length, failed: failed.length, pending: pending.length }
    };
    if (pending.length) {
      task.status = pending.some(job => job.status === 'running') ? 'running' : 'queued';
      task.errorMessage = null;
      task.finishedAt = null;
      return task;
    }
    task.finishedAt = nowIso();
    if (sources.length) {
      task.status = 'completed';
      task.errorMessage = sources.length < requested
        ? `批量生成部分完成：需要 ${requested} 张，实际返回 ${sources.length} 张`
        : null;
      return task;
    }
    task.status = failed.length && failed.every(job => job.status === 'canceled') ? 'canceled' : 'failed';
    task.errorMessage = failed.map(job => job.errorMessage).filter(Boolean)[0] || '批量图片生成失败';
    return task;
  }

  async function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
      reader.readAsDataURL(blob);
    });
  }

  async function ensureProviderMedia(media, provider) {
    if (!media) return null;
    const cacheKey = provider.cacheKey || provider.name;
    if (media.providerUrls?.[cacheKey]) return media.providerUrls[cacheKey];
    if (media.providerUrl) return media.providerUrl;
    if (media.blob && provider.uploadPath) {
      try {
        const form = new FormData();
        form.append('file', media.blob, media.name || 'reference-media');
        const result = await providerRequest(provider, provider.uploadPath, { method: 'POST', body: form, timeoutMs: 600000 });
        const url = result?.url || result?.data?.url;
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
          media.providerUrls = { ...(media.providerUrls || {}), [cacheKey]: url };
          await dbPut('media', media);
          return url;
        }
      } catch (error) {
        console.warn('供应商媒体上传不可用，尝试内联文件', error);
      }
    }
    if (media.dataUrl) return media.dataUrl;
    if (media.blob) {
      if (media.blob.size > 40 * 1024 * 1024) throw new Error(`供应商未提供媒体上传接口，${media.name || '参考文件'} 超过 40 MB，无法以内联方式提交`);
      return blobToDataUrl(media.blob);
    }
    return null;
  }

  async function referenceValue(value, provider) {
    if (!value) return null;
    if (typeof value === 'string') {
      if (value.startsWith('media://')) {
        const media = await dbGet('media', value.slice('media://'.length));
        return ensureProviderMedia(media, provider);
      }
      return value;
    }
    if (typeof value !== 'object') return null;
    if (value.providerUrl) return value.providerUrl;
    if (typeof value.reference === 'string') return referenceValue(value.reference, provider);
    if (value.reference && typeof value.reference === 'object') return referenceValue(value.reference, provider);
    if (value.mediaId || value.id) {
      const media = await dbGet('media', value.mediaId || value.id);
      return ensureProviderMedia(media, provider);
    }
    if (value.url || value.source) return value.url || value.source;
    return null;
  }

  async function prepareProviderInput(input = {}, provider) {
    const prepared = { ...(input || {}) };
    delete prepared.client_context;
    for (const key of ['images', 'videos', 'audios']) {
      if (!Array.isArray(prepared[key])) continue;
      const values = await Promise.all(prepared[key].map(value => referenceValue(value, provider)));
      prepared[key] = values.filter(Boolean);
      if (!prepared[key].length) delete prepared[key];
    }
    return prepared;
  }

  async function saveTask(task) {
    liveTasks.set(task.id, task);
    try { await dbPut('tasks', task); } catch (error) { console.warn('任务写入本地数据库失败', error); }
    return task;
  }

  async function loadTask(id) {
    return liveTasks.get(id) || await dbGet('tasks', id);
  }

  async function createGeneration({ mode = 'creation', operation, model, prompt = '', input = {}, duration = 1, count = 1, requestId, signal, onProgress }) {
    const provider = configuredProvider(operation, model);
    const task = {
      id: uid(), requestId: requestId || uid('request_'), mode, operation, model,
      status: 'running', reservedCredits: 0, consumedCredits: 0, providerTaskId: null,
      prompt, input: clone(input), output: {}, errorMessage: null,
      createdAt: nowIso(), updatedAt: nowIso(), finishedAt: null
    };
    await saveTask(task);
    try {
      const prepared = await prepareProviderInput(input, provider);
      const requestedImageCount = operation === 'image' ? Math.min(10, Math.max(1, Number(prepared.n) || Number(count) || 1)) : 1;
      if (operation === 'image' && requestedImageCount > 1) {
        task.providerJobs = Array.from({ length: requestedImageCount }, (_, index) => ({
          index,
          status: 'queued',
          providerTaskId: null,
          output: {},
          errorMessage: null
        }));
        updateImageBatchTask(task);
        await saveTask(task);
        onProgress?.(clone(task));
        const jobResults = await mapWithConcurrency(
          Array.from({ length: requestedImageCount }, (_, index) => index),
          3,
          async index => {
            task.providerJobs[index] = { ...task.providerJobs[index], status: 'running' };
            updateImageBatchTask(task);
            onProgress?.(clone(task));
            let job;
            try {
              // 部分 OpenAI 兼容图片服务会忽略 n>1。拆成独立的 n=1 请求，确保每个模型都能可靠批量生成。
              const output = await providerRequest(provider, provider.createPath, {
                method: 'POST',
                body: JSON.stringify({ model, prompt, ...prepared, n: 1 }),
                signal
              });
              job = imageJobFromOutput(output, index);
            } catch (error) {
              job = { index, status: 'failed', providerTaskId: null, output: {}, errorMessage: error.message || '图片生成失败' };
            }
            task.providerJobs[index] = job;
            updateImageBatchTask(task);
            task.updatedAt = nowIso();
            await saveTask(task);
            onProgress?.(clone(task));
            return job;
          }
        );
        task.providerJobs = jobResults;
        updateImageBatchTask(task);
        task.updatedAt = nowIso();
        await saveTask(task);
        if (task.status === 'failed' || task.status === 'canceled') {
          const error = new Error(task.errorMessage || '批量图片生成失败');
          error.task = clone(task);
          throw error;
        }
        return { task: clone(task), pricing: pricingFor({ operation, duration, count: requestedImageCount }), duplicate: false };
      }
      const body = operation === 'video'
        ? { model, prompt, ...prepared }
        : operation === 'image'
          ? { model, prompt, n: Number(prepared.n) || Number(count) || 1, ...prepared }
          : { model, messages: prepared.messages || [{ role: 'user', content: prompt }], stream: false, temperature: prepared.temperature ?? 0.7, ...prepared };
      const path = operation === 'video' ? provider.createPath : operation === 'image' ? provider.createPath : provider.createPath;
      const output = await providerRequest(provider, path, { method: 'POST', body: JSON.stringify(body), signal });
      const providerStatus = statusOf(output);
      task.providerTaskId = providerTaskIdOf(output);
      task.output = output;
      if (isFailure(providerStatus)) {
        task.status = providerStatus.startsWith('cancel') ? 'canceled' : 'failed';
        task.errorMessage = output?.error?.message || output?.message || `供应商返回失败状态：${providerStatus}`;
        task.finishedAt = nowIso();
      } else if (hasOutput(operation, output) || isSuccess(providerStatus)) {
        if (!hasOutput(operation, output)) throw new Error(`供应商返回完成状态，但没有可识别的${operation === 'video' ? '视频' : operation === 'image' ? '图片' : '文本'}结果`);
        task.status = 'completed';
        task.finishedAt = nowIso();
      } else if (task.providerTaskId) {
        task.status = 'queued';
      } else {
        throw new Error('供应商没有返回生成结果或可查询的任务 ID');
      }
      task.updatedAt = nowIso();
      await saveTask(task);
      return { task: clone(task), pricing: pricingFor({ operation, duration, count }), duplicate: false };
    } catch (error) {
      task.status = 'failed';
      task.errorMessage = error.message || '生成失败';
      task.finishedAt = nowIso();
      task.updatedAt = nowIso();
      await saveTask(task);
      error.task = clone(task);
      throw error;
    }
  }

  async function getGeneration(taskId, signal) {
    const task = await loadTask(taskId);
    if (!task) { const error = new Error('本地任务不存在'); error.status = 404; throw error; }
    if (terminal.has(task.status) || !task.providerTaskId) return clone(task);
    const provider = configuredProvider(task.operation, task.model);
    const pathTemplate = provider.pollPath || (task.operation === 'video' ? '/v1/videos/{id}' : '/v1/image/generations/{id}');
    if (task.operation === 'image' && Array.isArray(task.providerJobs) && task.providerJobs.length) {
      try {
        const pendingJobs = task.providerJobs.filter(job => !terminal.has(job.status));
        const polledJobs = await mapWithConcurrency(pendingJobs, 3, async job => {
          try {
            const output = await providerRequest(provider, pathTemplate.replaceAll('{id}', encodeURIComponent(job.providerTaskId)), { method: 'GET', signal, timeoutMs: 90000 });
            return imageJobFromOutput(output, job.index);
          } catch (error) {
            // 网络或服务端异常交给外层重试；不可解析的“完成”响应只标记该张失败，避免拖死整批任务。
            if (error?.status || /超时|无法连接|Failed to fetch/i.test(String(error?.message))) throw error;
            return { ...job, status: 'failed', errorMessage: error.message || '图片任务返回异常' };
          }
        });
        const updates = new Map(polledJobs.map(job => [job.index, job]));
        task.providerJobs = task.providerJobs.map(job => updates.get(job.index) || job);
        updateImageBatchTask(task);
        task.updatedAt = nowIso();
        await saveTask(task);
      } catch (error) {
        task.errorMessage = error.message || '批量图片状态查询失败';
        task.updatedAt = nowIso();
        await saveTask(task);
        throw error;
      }
      return clone(task);
    }
    try {
      const output = await providerRequest(provider, pathTemplate.replaceAll('{id}', encodeURIComponent(task.providerTaskId)), { method: 'GET', signal, timeoutMs: 90000 });
      const providerStatus = statusOf(output);
      task.output = output;
      if (isFailure(providerStatus)) {
        task.status = providerStatus.startsWith('cancel') ? 'canceled' : 'failed';
        task.errorMessage = output?.error?.message || output?.message || '供应商生成失败';
        task.finishedAt = nowIso();
      } else if (hasOutput(task.operation, output) || isSuccess(providerStatus)) {
        if (!hasOutput(task.operation, output)) throw new Error('供应商报告任务完成，但没有返回可识别的结果地址');
        task.status = 'completed';
        task.finishedAt = nowIso();
      } else {
        task.status = ['queued', 'pending', 'waiting'].includes(providerStatus) ? 'queued' : 'running';
      }
      task.updatedAt = nowIso();
      await saveTask(task);
    } catch (error) {
      task.errorMessage = error.message || '状态查询失败';
      task.updatedAt = nowIso();
      await saveTask(task);
      throw error;
    }
    return clone(task);
  }

  async function waitForGeneration(taskOrId, options = {}) {
    let task = typeof taskOrId === 'object' ? clone(taskOrId) : await getGeneration(taskOrId, options.signal);
    const started = Date.now();
    const timeoutMs = Number(options.timeoutMs || 3600000);
    let errors = 0;
    while (!terminal.has(task.status)) {
      if (options.signal?.aborted) throw new DOMException('已取消', 'AbortError');
      if (Date.now() - started > timeoutMs) throw new Error('生成任务等待超时，可稍后在当前浏览器中继续查看');
      await new Promise(resolve => setTimeout(resolve, Number(options.intervalMs || 1500)));
      try {
        task = await getGeneration(task.id, options.signal);
        errors = 0;
        options.onProgress?.(clone(task));
      } catch (error) {
        errors += 1;
        options.onTransientError?.(error, { attempt: errors, maxAttempts: 12, taskId: task.id });
        if (errors > 12) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.min(5000, 600 * errors)));
      }
    }
    if (task.status !== 'completed') {
      const error = new Error(task.errorMessage || '生成失败');
      error.task = task;
      throw error;
    }
    return task;
  }

  async function listGenerations(limit = 100) {
    const rows = await dbAll('tasks');
    rows.forEach(task => liveTasks.set(task.id, task));
    return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit).map(clone);
  }

  async function cancelGeneration(taskId, reason = '用户取消任务') {
    const task = await loadTask(taskId);
    if (!task) throw new Error('本地任务不存在');
    task.status = 'canceled'; task.errorMessage = reason; task.finishedAt = nowIso(); task.updatedAt = nowIso();
    await saveTask(task);
    return clone(task);
  }

  function pricingFor({ operation, duration = 1, count = 1 }) {
    return { credits: 0, unitCredits: 0, multiplier: operation === 'video' ? Number(duration || 1) : Number(count || 1), unit: operation === 'video' ? 'second' : operation === 'image' ? 'image' : 'request' };
  }

  function modelRows() {
    const config = readConfig();
    const row = (mode, operation, model, displayName, providerName, isDefault = true) => ({
      id: `${mode}:${operation}:${model}`, mode, operation, model, display_name: displayName || model,
      provider_name: providerName, is_active: true, metadata: { isDefault, description: '使用本机浏览器 API 配置' }
    });
    const configuredModels = provider => {
      const profileModels = (provider.profiles || [])
        .filter(profile => profile.baseUrl && profile.apiKey)
        .flatMap(profile => profile.models || []);
      if (profileModels.length) return uniqueModels(profileModels);
      return provider.baseUrl && provider.apiKey ? uniqueModels(provider.models || []) : [];
    };
    const rowsFor = (modes, operation, providerName) => modes.flatMap(mode => configuredModels(config[providerName]).map(model =>
      row(mode, operation, model, model, providerName, model === config[providerName].model)
    ));
    return [
      ...rowsFor(['creation', 'canvas'], 'video', 'video'),
      ...rowsFor(['creation', 'canvas'], 'llm', 'llm'),
      ...rowsFor(['long-script'], 'long-script', 'llm'),
      ...rowsFor(['creation', 'canvas', 'multi-angle'], 'image', 'image')
    ].filter(item => item.model);
  }

  async function uploadReferenceMedia(file, onProgress) {
    if (!file) throw new Error('请选择文件');
    onProgress?.(5);
    const id = uid();
    const isSmallImage = String(file.type || '').startsWith('image/') && file.size <= 12 * 1024 * 1024;
    const dataUrl = isSmallImage ? await blobToDataUrl(file) : '';
    onProgress?.(70);
    const record = { id, name: file.name || 'reference-media', type: String(file.type || '').split('/')[0] || 'file', mimeType: file.type || 'application/octet-stream', sizeBytes: file.size || 0, blob: file, dataUrl, providerUrls: {}, reference: `media://${id}`, createdAt: Date.now() };
    await dbPut('media', record);
    liveMedia.set(id, file);
    onProgress?.(100);
    return { id, name: record.name, mimeType: record.mimeType, sizeBytes: record.sizeBytes, url: localMediaUrl(id) || dataUrl || URL.createObjectURL(file), reference: record.reference };
  }

  async function cacheGenerationMedia(taskId) {
    const task = await loadTask(taskId);
    if (!task) throw new Error('任务不存在');
    const source = task.operation === 'image' ? imageSources(task.output)[0] : videoSource(task.output);
    if (!source) return clone(task);
    const response = await fetch(source);
    if (!response.ok) throw new Error(`生成媒体读取失败 HTTP ${response.status}`);
    const blob = await response.blob();
    const id = uid();
    liveMedia.set(id, blob);
    task.output = { ...(task.output || {}), _localMedia: [{ id, mimeType: blob.type, sizeBytes: blob.size }] };
    await saveTask(task);
    return clone(task);
  }

  async function fetchMediaBlob(mediaId) {
    const live = liveMedia.get(mediaId);
    if (live instanceof Blob) return live;
    const media = await dbGet('media', mediaId);
    if (media?.blob instanceof Blob) return media.blob;
    if (media?.dataUrl) return fetch(media.dataUrl).then(response => response.blob());
    throw new Error('本地媒体不存在');
  }

  function normalizePrompt(payload, existing = {}) {
    const createdAt = existing.createdAt || Date.now();
    return {
      ...existing, id: existing.id || uid(), title: String(payload.title || existing.title || '未命名提示词'),
      prompt: String(payload.prompt ?? existing.prompt ?? ''), description: String(payload.description ?? existing.description ?? ''),
      category: String(payload.category || existing.category || '通用'), targetType: payload.targetType || existing.targetType || 'both',
      scope: 'private', tags: Array.isArray(payload.tags) ? payload.tags.map(String).filter(Boolean) : (existing.tags || []),
      isFavorite: payload.isFavorite ?? existing.isFavorite ?? false, usageCount: existing.usageCount || 0,
      canEdit: true, createdAt, updatedAt: Date.now()
    };
  }

  async function listLibraryPrompts() { return (await dbAll('prompts')).sort((a, b) => b.updatedAt - a.updatedAt); }
  async function createLibraryPrompt(payload) { const item = normalizePrompt(payload); await dbPut('prompts', item); return item; }
  async function updateLibraryPrompt(id, payload) { const item = normalizePrompt(payload, await dbGet('prompts', id) || { id }); await dbPut('prompts', item); return item; }
  async function deleteLibraryPrompt(id) { await dbDelete('prompts', id); return { id }; }
  async function copyLibraryPrompt(id) { const source = await dbGet('prompts', id); if (!source) throw new Error('提示词不存在'); return createLibraryPrompt({ ...source, title: `${source.title} 副本` }); }

  async function mediaRecord(id) {
    const item = await dbGet('media', id);
    if (!item) return null;
    const url = localMediaUrl(item.id) || (item.blob instanceof Blob ? URL.createObjectURL(item.blob) : item.dataUrl);
    return { id: item.id, name: item.name, type: item.type, mimeType: item.mimeType, sizeBytes: item.sizeBytes, url, reference: item.reference, createdAt: item.createdAt };
  }

  async function normalizeAsset(payload, existing = {}) {
    const ids = Array.isArray(payload.mediaIds) ? payload.mediaIds : (existing.media || []).map(item => item.id);
    const media = (await Promise.all(ids.map(mediaRecord))).filter(Boolean).map(item => ({ ...item, isCover: item.id === (payload.coverMediaId || existing.coverMediaId || ids[0]) }));
    return {
      ...existing, id: existing.id || uid(), name: String(payload.name || existing.name || '未命名资产'),
      description: String(payload.description ?? existing.description ?? ''), category: String(payload.category || existing.category || '其他'),
      scope: 'private', tags: Array.isArray(payload.tags) ? payload.tags.map(String).filter(Boolean) : (existing.tags || []),
      isFavorite: payload.isFavorite ?? existing.isFavorite ?? false, canEdit: true, media,
      primaryMedia: media.find(item => item.isCover) || media[0] || null, coverMediaId: payload.coverMediaId || existing.coverMediaId || ids[0] || null,
      createdAt: existing.createdAt || Date.now(), updatedAt: Date.now()
    };
  }

  async function listLibraryAssets() { return (await dbAll('assets')).sort((a, b) => b.updatedAt - a.updatedAt); }
  async function createLibraryAsset(payload) { const item = await normalizeAsset(payload); await dbPut('assets', item); return item; }
  async function updateLibraryAsset(id, payload) { const item = await normalizeAsset(payload, await dbGet('assets', id) || { id }); await dbPut('assets', item); return item; }
  async function deleteLibraryAsset(id) { await dbDelete('assets', id); return { id }; }
  async function copyLibraryAsset(id) { const source = await dbGet('assets', id); if (!source) throw new Error('资产不存在'); const item = { ...source, id: uid(), name: `${source.name} 副本`, createdAt: Date.now(), updatedAt: Date.now() }; await dbPut('assets', item); return item; }
  async function listLibraryUploads(limit = 100) {
    const assets = await dbAll('assets');
    const used = new Set(assets.flatMap(asset => (asset.media || []).map(item => item.id)));
    const rows = (await dbAll('media')).filter(item => !used.has(item.id)).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    return Promise.all(rows.map(mediaRecord));
  }

  async function discoverProviderModels(name, profile = {}) {
    if (!profile.baseUrl || !profile.apiKey) throw new Error('请先填写 API 地址和 Key');
    const scoped = { ...DEFAULTS[name], ...profile, name, cacheKey: `${name}:${profile.id || 'draft'}` };
    let models = [];
    try {
      const body = await providerRequest(scoped, '/v1/models', { method: 'GET', timeoutMs: 30000 });
      models = (body?.data || body?.models || []).map(item => item?.id || item).filter(Boolean);
    } catch (modelsError) {
      try {
        const usage = await providerRequest(scoped, '/api/usage/token/', { method: 'GET', timeoutMs: 30000 });
        models = Object.keys(usage?.data?.model_limits || {}).filter(model => usage.data.model_limits[model]);
      } catch {
        throw modelsError;
      }
    }
    models = uniqueModels(models);
    if (!models.length) throw new Error('连接成功，但这个 Key 没有返回可用模型');
    return { name, models };
  }

  async function testProvider(name, override = null) {
    const config = override || readConfig()[name];
    if (config.profiles?.length) {
      const results = await Promise.all(config.profiles.map(async profile => {
        if (!profile.baseUrl || !profile.apiKey) return { profile, ok: false, models: [], error: '未配置地址或 Key' };
        try {
          const { models } = await discoverProviderModels(name, profile);
          return { profile, ok: true, models };
        } catch (error) {
          return { profile, ok: false, models: [], error: error.message };
        }
      }));
      const failed = results.filter(result => !result.ok);
      const models = uniqueModels(results.flatMap(result => result.models));
      return {
        name,
        configured: true,
        ok: !failed.length,
        models,
        profiles: results,
        message: failed.length
          ? `${failed.map(result => result.profile.label).join('、')} 连接失败：${failed[0].error}`
          : `${results.length} 个 Key 均连接成功，可见 ${models.length} 个模型`
      };
    }
    if (!config.baseUrl || !config.apiKey) return { name, configured: false, ok: false, message: '未配置' };
    try {
      const { models } = await discoverProviderModels(name, config);
      return { name, configured: true, ok: true, models, message: models.length ? `连接成功，可见 ${models.length} 个模型` : '连接成功，但模型列表为空' };
    } catch (error) {
      return { name, configured: true, ok: false, message: error.message };
    }
  }

  async function request(path, options = {}) {
    const url = new URL(path, 'http://standalone.local');
    const method = String(options.method || 'GET').toUpperCase();
    let payload = {};
    try { payload = options.body ? JSON.parse(options.body) : {}; } catch {}
    if (url.pathname === '/api/pricing') return modelRows().map(item => ({ mode: item.mode, operation: item.operation, model: item.model, unit: item.operation === 'video' ? 'second' : item.operation === 'image' ? 'image' : 'request', credits: 0, unitCredits: 0, multiplier: 1, isActive: true }));
    if (url.pathname === '/api/pricing/preview') return pricingFor(payload);
    if (url.pathname === '/api/models') return modelRows();
    if (url.pathname === '/api/admin/users') return [];
    if (url.pathname === '/api/admin/providers' && method === 'GET') {
      const config = readConfig();
      return ['video', 'llm', 'image'].map(name => ({ id: name, name, base_url: config[name].baseUrl, enabled: true, metadata: { createPath: config[name].createPath, pollPathTemplate: config[name].pollPath, mediaUploadPath: config[name].uploadPath, models: config[name].models, profiles: config[name].profiles.map(profile => ({ ...profile, apiKey: '' })) } }));
    }
    if (url.pathname === '/api/admin/providers' && method === 'POST') {
      const name = payload.name;
      if (!['video', 'image', 'llm'].includes(name)) throw new Error('未知 API 类型');
      const current = readConfig()[name];
      const metadata = payload.metadata || {};
      let profiles = current.profiles;
      if (Array.isArray(metadata.profiles)) {
        const currentById = new Map((current.profiles || []).map(profile => [profile.id, profile]));
        profiles = metadata.profiles.map((profile, index) => {
          const previous = currentById.get(profile.id) || {};
          return normalizeProviderProfile({ ...previous, ...profile, apiKey: profile.apiKey || previous.apiKey }, index, name);
        });
      }
      const next = { ...current, baseUrl: normalizeBaseUrl(payload.baseUrl || current.baseUrl), apiKey: payload.apiKey || current.apiKey, createPath: metadata.createPath || current.createPath, pollPath: metadata.pollPathTemplate || current.pollPath, uploadPath: metadata.mediaUploadPath || current.uploadPath, models: Array.isArray(metadata.models) ? uniqueModels(metadata.models) : current.models, profiles };
      writeConfig({ [name]: next });
      return { id: name, name, base_url: next.baseUrl, enabled: true, metadata };
    }
    if (url.pathname === '/api/admin/pricing') return payload;
    if (url.pathname === '/api/admin/models') {
      const name = providerFor(payload.operation);
      const config = readConfig();
      const models = uniqueModels([...(config[name].models || []), payload.model]);
      const model = payload.isDefault === true || !config[name].model ? payload.model : config[name].model;
      writeConfig({ [name]: { ...config[name], model, models } });
      return payload;
    }
    if (url.pathname === '/api/admin/overview') return { userCount: 1, taskStatuses: [], ledgerTotals: [] };
    if (/^\/api\/admin\/(tasks|ledger|audit)$/.test(url.pathname)) return [];
    throw new Error(`纯前端版本不需要此服务端接口：${url.pathname}`);
  }

  const client = {
    request,
    login: async () => ({ accessToken: 'local', user: localUser }),
    register: async () => ({ accessToken: 'local', user: localUser }),
    restore: async () => true,
    logout: () => {},
    refreshWallet: async () => localWallet,
    getWalletLedger: async () => [],
    createGeneration,
    getGeneration,
    listGenerations,
    cacheGenerationMedia,
    fetchMediaBlob,
    cancelGeneration,
    getModels: async () => modelRows(),
    listLibraryPrompts,
    createLibraryPrompt,
    updateLibraryPrompt,
    deleteLibraryPrompt,
    copyLibraryPrompt,
    listLibraryAssets,
    createLibraryAsset,
    updateLibraryAsset,
    deleteLibraryAsset,
    copyLibraryAsset,
    listLibraryUploads,
    previewPricing: async payload => pricingFor(payload),
    waitForGeneration,
    uploadReferenceMedia,
    testProvider,
    discoverProviderModels,
    getConfig: readConfig,
    saveConfig: writeConfig,
    clearStoredConfig,
    isConfigured: hasAnyConfiguredProvider,
    getToken: () => 'local',
    getUser: () => localUser,
    getWallet: () => localWallet,
    isAuthenticated: () => true,
    isAdmin: () => true,
    baseUrl: ''
  };

  window.StandaloneBackendClient = client;

  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.add('standalone-mode');
    document.body.classList.add('standalone-mode');
    const settings = document.getElementById('btnStandaloneSettings');
    settings?.addEventListener('click', () => window.openApiConfigModal?.());
    document.getElementById('btnTestStandaloneApis')?.addEventListener('click', async () => {
      const resultNode = document.getElementById('apiTestResult');
      const saved = readConfig();
      const entries = {
        video: { ...saved.video, baseUrl: document.getElementById('cfgApiBaseUrl')?.value.trim() || saved.video.baseUrl, apiKey: document.getElementById('cfgApiKey')?.value.trim() || saved.video.apiKey },
        llm: { ...saved.llm, baseUrl: document.getElementById('cfgLlmBaseUrl')?.value.trim() || saved.llm.baseUrl, apiKey: document.getElementById('cfgLlmApiKey')?.value.trim() || saved.llm.apiKey },
        image: (() => {
          const currentProfiles = new Map((saved.image.profiles || []).map(profile => [profile.id, profile]));
          const primary = currentProfiles.get('gpt-image') || saved.image.profiles?.[0] || {};
          const image2 = currentProfiles.get('gpt-image-2') || saved.image.profiles?.find(profile => profile.models.includes('gpt-image-2')) || {};
          const nano = currentProfiles.get('nano-banana') || saved.image.profiles?.find(profile => profile.models.includes('nano-banana-2')) || {};
          const profiles = [
            normalizeImageProfile({ ...primary, id: 'gpt-image', label: 'GPT Image 2.5', baseUrl: document.getElementById('cfgImageBaseUrl')?.value.trim() || primary.baseUrl || saved.image.baseUrl, apiKey: document.getElementById('cfgImageApiKey')?.value.trim() || primary.apiKey || saved.image.apiKey, models: document.getElementById('cfgImageModel')?.value || primary.models }),
            normalizeImageProfile({ ...image2, id: 'gpt-image-2', label: 'GPT Image 2', baseUrl: document.getElementById('cfgImage2BaseUrl')?.value.trim() || image2.baseUrl || saved.image.baseUrl, apiKey: document.getElementById('cfgImage2ApiKey')?.value.trim() || image2.apiKey || saved.image.apiKey, models: document.getElementById('cfgImage2Models')?.value || image2.models }),
            normalizeImageProfile({ ...nano, id: 'nano-banana', label: 'Nano Banana', baseUrl: document.getElementById('cfgNanoImageBaseUrl')?.value.trim() || nano.baseUrl, apiKey: document.getElementById('cfgNanoImageApiKey')?.value.trim() || nano.apiKey, models: document.getElementById('cfgNanoImageModels')?.value || nano.models })
          ];
          return normalizeImageConfig({ ...saved.image, profiles, models: profiles.flatMap(profile => profile.models) });
        })()
      };
      if (resultNode) { resultNode.className = 'api-test-status'; resultNode.textContent = '正在分别测试视频、LLM 和图片 API…'; }
      const tests = await Promise.all(['video', 'llm', 'image'].map(name => testProvider(name, entries[name])));
      const failed = tests.filter(item => item.configured && !item.ok);
      if (resultNode) {
        resultNode.className = `api-test-status ${failed.length ? 'error' : 'success'}`;
        resultNode.textContent = tests.map(item => `${item.name === 'video' ? '视频' : item.name === 'image' ? '图片' : 'LLM'}：${item.message}`).join(' ｜ ');
      }
    });
    if (!hasAnyConfiguredProvider()) {
      window.setTimeout(() => window.openApiConfigModal?.(), 900);
    }
  });
})();
