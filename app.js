// 全局后台节点扩写状态字典 (取消节点选中不影响后台 LLM 流式扩写任务)
const canvasNodeExpandingState = {};
const DEFAULT_VIDEO_MODEL = 'sora-v3-2.5-720p-per-second';
const DEFAULT_PRIMARY_IMAGE_MODELS = ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'];
const DEFAULT_IMAGE2_IMAGE_MODELS = ['gpt-image-2'];
const DEFAULT_NANO_IMAGE_MODELS = ['nano-banana-2'];
const DEFAULT_IMAGE_MODELS = [...DEFAULT_IMAGE2_IMAGE_MODELS, ...DEFAULT_PRIMARY_IMAGE_MODELS, ...DEFAULT_NANO_IMAGE_MODELS];

function parseImageModelList(value, fallback = DEFAULT_IMAGE_MODELS) {
  let source = value;
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try { source = JSON.parse(value); } catch (error) {}
  }
  if (!Array.isArray(source)) source = String(source || '').split(/[\n,，]/);
  const models = [...new Set(source.map(model => String(model || '').trim()).filter(Boolean))];
  return models.length ? models : [...fallback];
}

function storedImageModels() {
  return parseImageModelList(localStorage.getItem('api_imageModels') || localStorage.getItem('api_imageModel') || '', DEFAULT_IMAGE_MODELS);
}

function isCustomDurationVideoModel(model) {
  return String(model || '').endsWith('-per-second');
}

// 预设模板工作流数据
const CANVAS_PRESET_TEMPLATES = [
  {
    id: 'tpl_cyberpunk',
    name: '🌌 赛博朋克巨鲸视频工作流',
    desc: '包含提示词 + 情绪参考图 + 16:9 Sora 旗舰视频生成',
    nodes: [
      { id: 'node_t_1', type: 'text', x: 80, y: 100, title: '📝 赛博巨鲸提示词', content: '一条具有赛博朋克发光质感的巨大鲸鱼在星海泛舟，电影级8K画质，超高清微距摄影' },
      { id: 'node_a_1', type: 'asset', x: 80, y: 300, title: '🖼️ 氛围参考图', assetName: '熊主任', imgUrl: 'assets/logo_brand.png' },
      { id: 'node_v_1', type: 'video', x: 500, y: 150, title: '🎬 Sora 视频生成节点', model: DEFAULT_VIDEO_MODEL, aspect: '16:9', duration: 5 }
    ],
    connections: [
      { fromId: 'node_t_1', toId: 'node_v_1' },
      { fromId: 'node_a_1', toId: 'node_v_1' }
    ]
  },
  {
    id: 'tpl_ecommerce',
    name: '📱 电商新品特写展示工作流',
    desc: '适用于新机质检、展示柜微距慢动作视频生成',
    nodes: [
      { id: 'node_t_2', type: 'text', x: 80, y: 100, title: '📝 新品微距提示词', content: '镜头特写极细微数码质感，极具现代科技感的展柜旋转展示，柔和暖色追光摄影' },
      { id: 'node_a_2', type: 'asset', x: 80, y: 300, title: '🖼️ 产品展柜参考', assetName: '数码展柜', imgUrl: '' },
      { id: 'node_v_2', type: 'video', x: 500, y: 150, title: '🎬 9:16 竖屏短视频节点', model: DEFAULT_VIDEO_MODEL, aspect: '9:16', duration: 10 }
    ],
    connections: [
      { fromId: 'node_t_2', toId: 'node_v_2' },
      { fromId: 'node_a_2', toId: 'node_v_2' }
    ]
  },
  {
    id: 'tpl_cinematic',
    name: '🎬 电影级微距质感生成工作流',
    desc: '大师级电影打光、景深变焦与超高清细节微距',
    nodes: [
      { id: 'node_t_3', type: 'text', x: 80, y: 100, title: '📝 电影大师提示词', content: '大师级电影光影，景深虚化与粒子漂移效果，4K超高清细节' },
      { id: 'node_v_3', type: 'video', x: 480, y: 120, title: '🎬 AI 电影生成节点', model: DEFAULT_VIDEO_MODEL, aspect: '16:9', duration: 5 }
    ],
    connections: [
      { fromId: 'node_t_3', toId: 'node_v_3' }
    ]
  }
];

// 计算当前屏幕视口中心，保证新增节点精确落入用户眼前的视口中心



// --- 2. 预置的高清镜头示例数据 ---
const SEED_PROMPTS = [
  {
    id: 'seed-1',
    title: '雨夜霓虹赛博朋克女性特写',
    prompt: 'Cinematic extreme close-up shot of a cyberpunk woman in rain, neon cyan and magenta lights reflecting on wet skin and glowing eyes, shallow depth of field, anamorphic lens flare, photorealistic 8k, 24fps motion.',
    shotSize: '特写',
    movement: '推镜头',
    angle: '平视角度',
    category: '人物肖像',
    motion: '微动 (1-3)',
    lighting: '赛博霓虹对比光影',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    createdAt: Date.now() - 100000
  },
  {
    id: 'seed-2',
    title: '雪山绝壁古堡航拍俯瞰大远景',
    prompt: 'Extreme long shot aerial drone view of a mystical ancient stone castle perched on a snowy mountain ridge during golden hour sunset, cinematic clouds drifting, epic atmospheric scale, unreal engine 5 render.',
    shotSize: '大远景',
    movement: '航拍俯瞰',
    angle: '鸟瞰视角',
    category: '风光自然',
    motion: '中度 (4-6)',
    lighting: '黄金时刻日光暖光',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    createdAt: Date.now() - 80000
  },
  {
    id: 'seed-3',
    title: '未来科幻飞船环绕360度展示',
    prompt: '360 degree orbit shot around a sleek white futuristic spacecraft floating in deep space near a glowing nebula, volumetric thruster blue light, ultra detailed mechanical parts, 8k resolution.',
    shotSize: '全景',
    movement: '环绕拍摄',
    angle: '仰视角度',
    category: '动作科幻',
    motion: '中度 (4-6)',
    lighting: '深空星云冷调发光',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    createdAt: Date.now() - 60000
  },
  {
    id: 'seed-4',
    title: '晨露玫瑰花瓣微距变焦放大',
    prompt: 'Ultra high-definition macro close-up of a fresh red rose petal with crystal water drops, camera slow zoom in focusing on liquid refraction of sunlight, National Geographic style 4k 60fps.',
    shotSize: '微距',
    movement: '推镜头',
    angle: '平视角度',
    category: '风光自然',
    motion: '微动 (1-3)',
    lighting: '晨光自然穿透强日光',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoylikes.mp4',
    createdAt: Date.now() - 40000
  },
  {
    id: 'seed-5',
    title: '极简北欧现代客厅慢速跟随平移',
    prompt: 'Slow dolly tracking shot through a sunlit minimalistic Scandinavian apartment, natural beige interior design, warm wooden furniture, soft shadows, architectural digest presentation.',
    shotSize: '中景',
    movement: '平移跟随',
    angle: '平视角度',
    category: '建筑空间',
    motion: '中度 (4-6)',
    lighting: '柔和漫反射自然日光',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    createdAt: Date.now() - 20000
  }
];

// 镜头库是独立于“提示词库”的视频样例资料；使用单独的轻量本地存储，避免两套数据串联。
const PromptStore = {
  key: 'vkb_lens_prompts',
  async getAll() {
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch (error) { return []; }
  },
  async save(item) {
    const items = await this.getAll();
    const index = items.findIndex(entry => entry.id === item.id);
    if (index >= 0) items[index] = item; else items.push(item);
    localStorage.setItem(this.key, JSON.stringify(items));
    return item;
  },
  async delete(id) {
    const items = (await this.getAll()).filter(item => item.id !== id);
    localStorage.setItem(this.key, JSON.stringify(items));
  }
};

// --- 3. 应用状态 ---
const state = {
  prompts: [],
  filterShotSize: '',
  filterMovement: '',
  filterAngle: '',
  filterCategory: '',
  searchQuery: '',
  activeDetailItem: null,
  uploadedVideoBlob: null,
  
  // 浏览器只保留模型偏好；供应商地址和密钥由服务端管理。
  apiConfig: {
    model: localStorage.getItem('api_model') || DEFAULT_VIDEO_MODEL,
    duration: parseInt(localStorage.getItem('api_duration') || '15', 10),
    llmModelName: localStorage.getItem('api_llmModelName') || 'gpt-5.6-sol',
    imageModel: localStorage.getItem('api_imageModel') || storedImageModels()[0],
    imageModels: storedImageModels(),
    providerMetadata: {}
  },
  activeTasks: [],
  taskHistory: JSON.parse(localStorage.getItem('api_task_history') || '[]'),
  scriptHistory: JSON.parse(localStorage.getItem('vkb_script_history') || '[]'),
  historyFilter: 'all',
  latestFinishedStatus: localStorage.getItem('api_latest_status') || 'none',
  chatRefMediaList: [],
  chatGenerationMode: localStorage.getItem('chat_generation_mode') === 'image' ? 'image' : 'video',
  chatImageAspect: localStorage.getItem('chat_image_aspect') || '1:1',
  chatImageCount: Math.min(10, Math.max(1, parseInt(localStorage.getItem('chat_image_count') || '1', 10) || 1)),
  imageResultCache: new Map(),
  isBatchSelectingHistory: false,
  selectedHistoryIds: new Set(),
  // 提示词库与资产库以服务端为唯一数据源；旧 localStorage 数据保留但不再自动载入。
  promptTemplates: [],
  assets: [],
  uploadedResources: [],
  promptKbFilter: "all",
  assetCategoryFilter: "all",
  promptKbSearch: '',
  promptKbTargetType: 'all',
  promptKbScope: 'all',
  promptKbFavoriteOnly: false,
  assetKbSearch: '',
  assetKbMediaType: 'all',
  assetKbScope: 'all',
  assetKbFavoriteOnly: false,
  libraryLoading: false,
  libraryLoaded: false,
  isBatchSelectingPrompts: false,
  isBatchSelectingAssets: false,
  selectedPromptIds: new Set(),
  selectedAssetIds: new Set(),
  currentView: "videoGen",
  serverModels: [],
  pricingPreviewRequestId: 0,
  adminModelMode: localStorage.getItem('vkb_admin_model_mode') || 'creation'
};

/* ==========================================================================
   Managed video loading
   Keep completed videos out of the network/decoder pipeline until the user
   explicitly presses play. Opening a site, session, history page, or canvas
   must never assign a video src by itself.
   ========================================================================== */
const managedVideoInteractionHandlers = new WeakMap();

function getManagedVideoSource(video) {
  if (!(video instanceof HTMLVideoElement)) return '';
  return video.dataset.lazyVideoSrc || video.getAttribute('src') || '';
}

function deactivateManagedVideo(video, options = {}) {
  if (!(video instanceof HTMLVideoElement)) return;
  if (!options.force && !video.paused) return;
  const source = getManagedVideoSource(video);
  if (source) video.dataset.lazyVideoSrc = source;
  try { video.pause(); } catch (error) {}
  video.removeAttribute('src');
  video.preload = 'none';
  delete video.dataset.managedVideoActive;
  delete video.dataset.coverFrameRequested;
  const canvasWrapper = video.closest('.canvas-pure-video');
  if (canvasWrapper) {
    canvasWrapper.classList.add('canvas-video-awaiting-play');
    canvasWrapper.classList.remove('canvas-video-cover-loading', 'is-video-playing');
  }
  try { video.load(); } catch (error) {}
}

function pauseOtherManagedVideos(activeVideo) {
  document.querySelectorAll('video').forEach(video => {
    if (video === activeVideo) return;
    if (video.dataset.lazyVideoSrc) deactivateManagedVideo(video, { force: true });
    else if (!video.paused) {
      try { video.pause(); } catch (error) {}
    }
  });
}

function activateManagedVideo(video, options = {}) {
  if (!(video instanceof HTMLVideoElement)) return false;
  const source = getManagedVideoSource(video);
  if (!source) return false;
  const interactionHandler = managedVideoInteractionHandlers.get(video);
  if (interactionHandler) video.removeEventListener('pointerdown', interactionHandler, true);
  managedVideoInteractionHandlers.delete(video);
  delete video.dataset.managedVideoInteractionBound;
  if (video.getAttribute('src') !== source) {
    const canvasWrapper = video.closest('.canvas-pure-video');
    if (canvasWrapper) {
      canvasWrapper.classList.remove('canvas-video-awaiting-play');
      canvasWrapper.classList.add('canvas-video-cover-loading');
    }
    video.src = source;
    video.preload = options.preload || video.dataset.lazyVideoPreload || 'auto';
    video.dataset.managedVideoActive = '1';
    try { video.load(); } catch (error) {}
  }
  if (options.play) {
    pauseOtherManagedVideos(video);
    const playPromise = video.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  }
  return true;
}

function observeManagedVideos(root = document) {
  const videos = root instanceof HTMLVideoElement
    ? [root]
    : Array.from(root?.querySelectorAll?.('video[data-lazy-video-src]') || []);
  videos.forEach(video => {
    video.preload = video.dataset.managedVideoActive === '1' ? (video.dataset.lazyVideoPreload || 'metadata') : 'none';
    if (video.dataset.managedVideoActive === '1' || video.dataset.clickVideoLoad !== '1' || video.dataset.managedVideoInteractionBound === '1') return;
    const handler = event => {
      if (video.dataset.managedVideoActive === '1') return;
      event.preventDefault();
      event.stopPropagation();
      activateManagedVideo(video, { play: true, preload: 'auto' });
    };
    managedVideoInteractionHandlers.set(video, handler);
    video.dataset.managedVideoInteractionBound = '1';
    video.addEventListener('pointerdown', handler, { capture: true, once: true });
  });
}

function unobserveManagedVideos(root = document) {
  const videos = root instanceof HTMLVideoElement
    ? [root]
    : Array.from(root?.querySelectorAll?.('video[data-managed-video-interaction-bound="1"]') || []);
  videos.forEach(video => {
    const handler = managedVideoInteractionHandlers.get(video);
    if (handler) video.removeEventListener('pointerdown', handler, true);
    managedVideoInteractionHandlers.delete(video);
    delete video.dataset.managedVideoInteractionBound;
  });
}

function releaseManagedVideos(root = document, options = {}) {
  const videos = root instanceof HTMLVideoElement
    ? [root]
    : Array.from(root?.querySelectorAll?.('video') || []);
  videos.forEach(video => {
    if (!video.dataset.lazyVideoSrc && video.getAttribute('src')) video.dataset.lazyVideoSrc = video.getAttribute('src');
    if (video.dataset.lazyVideoSrc) deactivateManagedVideo(video, { force: options.force !== false });
    else {
      try { video.pause(); } catch (error) {}
    }
  });
}

function prepareLazyVideoMarkup(html) {
  if (!html || !/<video\b/i.test(html)) return html || '';
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('video').forEach(video => {
    const source = video.dataset.lazyVideoSrc || video.getAttribute('src') || '';
    if (source) video.dataset.lazyVideoSrc = source;
    video.removeAttribute('src');
    video.removeAttribute('autoplay');
    video.preload = 'none';
    delete video.dataset.managedVideoActive;
    delete video.dataset.managedVideoInteractionBound;
  });
  return template.innerHTML;
}

function serializeManagedVideoHtml(root, fallback = '') {
  if (!root) return fallback;
  const clone = root.cloneNode(true);
  clone.querySelectorAll('video').forEach(video => {
    const source = video.dataset.lazyVideoSrc || video.getAttribute('src') || '';
    if (source) video.dataset.lazyVideoSrc = source;
    video.removeAttribute('src');
    video.removeAttribute('autoplay');
    video.preload = 'none';
    delete video.dataset.managedVideoActive;
    delete video.dataset.managedVideoInteractionBound;
  });
  return clone.innerHTML || fallback;
}

const BackendClient = window.StandaloneBackendClient;
if (!BackendClient) {
  throw new Error('隐私版客户端未能加载，应用已停止以避免启用持久化后端模式');
}
const LegacyBackendClient = (() => {
  const baseUrl = (localStorage.getItem('vkb_backend_url') || 'http://127.0.0.1:8786').replace(/\/+$/, '');
  const TOKEN_KEY = 'vkb_access_token';
  const USER_KEY = 'vkb_auth_user';
  let accessToken = localStorage.getItem(TOKEN_KEY) || '';
  let user = null;
  let wallet = null;
  try { user = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (error) {}

  function authHeaders() {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }

  function saveSession(nextToken, nextUser) {
    accessToken = nextToken || '';
    user = nextUser || null;
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
    else localStorage.removeItem(TOKEN_KEY);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }

  function clearSession() {
    saveSession('', null);
    wallet = null;
    localStorage.removeItem('vkb_logged_user');
  }

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...authHeaders(),
        ...(options.headers || {})
      }
    });
    const raw = await response.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : {}; } catch (error) {}
    if (!response.ok || payload?.ok === false) {
      const apiError = new Error(payload?.error?.message || raw || `请求失败 (HTTP ${response.status})`);
      apiError.status = response.status;
      apiError.code = payload?.error?.code || 'REQUEST_FAILED';
      if (response.status === 401) {
        clearSession();
        updateAuthUi();
      }
      throw apiError;
    }
    return payload?.data;
  }

  async function login(username, password) {
    const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    saveSession(result.accessToken, result.user);
    localStorage.setItem('vkb_logged_user', result.user.username);
    await refreshWallet();
    return result;
  }

  async function register(username, password) {
    const result = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    saveSession(result.accessToken, result.user);
    localStorage.setItem('vkb_logged_user', result.user.username);
    await refreshWallet();
    return result;
  }

  async function restore() {
    if (!accessToken) return false;
    try {
      const result = await request('/api/auth/me');
      user = result.user;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem('vkb_logged_user', user.username);
      await refreshWallet();
      return true;
    } catch (error) {
      clearSession();
      return false;
    }
  }

  async function refreshWallet() {
    if (!accessToken) return null;
    wallet = await request('/api/wallet');
    updateAuthUi();
    return wallet;
  }

  async function getWalletLedger(limit = 20) {
    if (!accessToken) return [];
    return request(`/api/wallet/ledger?limit=${Math.min(100, Math.max(1, Number(limit) || 20))}`);
  }

  async function createGeneration({ mode = 'creation', operation, model, prompt, input = {}, duration = 1, count = 1, requestId, signal }) {
    const idempotencyKey = requestId || `${mode}_${operation}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return request('/api/generations', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ mode, operation, model, prompt, input, duration, count, requestId: idempotencyKey }),
      signal
    });
  }

  async function getGeneration(taskId, signal) {
    return request(`/api/generations/${encodeURIComponent(taskId)}`, { signal });
  }

  async function listGenerations(limit = 100) {
    return request(`/api/generations?limit=${Math.min(100, Math.max(1, Number(limit) || 100))}`);
  }

  async function cacheGenerationMedia(taskId) {
    return request(`/api/generations/${encodeURIComponent(taskId)}/cache-media`, { method: 'POST' });
  }

  async function fetchMediaBlob(mediaId) {
    const response = await fetch(`${baseUrl}/api/media/${encodeURIComponent(mediaId)}`, { headers: authHeaders() });
    if (!response.ok) {
      const raw = await response.text();
      let payload = null;
      try { payload = raw ? JSON.parse(raw) : null; } catch (error) {}
      const apiError = new Error(payload?.error?.message || raw || `图片读取失败 (HTTP ${response.status})`);
      apiError.status = response.status;
      throw apiError;
    }
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('服务器返回的不是图片');
    return blob;
  }

  async function cancelGeneration(taskId, reason = '用户取消任务') {
    return request(`/api/generations/${encodeURIComponent(taskId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async function getModels() {
    return request('/api/models');
  }

  async function listLibraryPrompts(params = {}) {
    const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all'));
    return request(`/api/library/prompts${search.size ? `?${search}` : ''}`);
  }

  async function createLibraryPrompt(payload) {
    return request('/api/library/prompts', { method: 'POST', body: JSON.stringify(payload) });
  }

  async function updateLibraryPrompt(id, payload) {
    return request(`/api/library/prompts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async function deleteLibraryPrompt(id) {
    return request(`/api/library/prompts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async function copyLibraryPrompt(id) {
    return request(`/api/library/prompts/${encodeURIComponent(id)}/copy`, { method: 'POST' });
  }

  async function listLibraryAssets(params = {}) {
    const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all'));
    return request(`/api/library/assets${search.size ? `?${search}` : ''}`);
  }

  async function createLibraryAsset(payload) {
    return request('/api/library/assets', { method: 'POST', body: JSON.stringify(payload) });
  }

  async function updateLibraryAsset(id, payload) {
    return request(`/api/library/assets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async function deleteLibraryAsset(id) {
    return request(`/api/library/assets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async function copyLibraryAsset(id) {
    return request(`/api/library/assets/${encodeURIComponent(id)}/copy`, { method: 'POST' });
  }

  async function listLibraryUploads(limit = 100) {
    return request(`/api/library/uploads?limit=${Math.min(200, Math.max(1, Number(limit) || 100))}`);
  }

  async function previewPricing(payload, signal) {
    return request('/api/pricing/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
    });
  }

  async function waitForGeneration(taskOrId, options = {}) {
    const taskId = typeof taskOrId === 'string' ? taskOrId : taskOrId?.id;
    let task = typeof taskOrId === 'object' ? taskOrId : null;
    const timeoutMs = options.timeoutMs || 600000;
    const maxConsecutiveErrors = Math.max(1, Number(options.maxConsecutiveErrors) || 12);
    let consecutiveErrors = 0;
    const startedAt = Date.now();
    while (!task || !['completed', 'refunded', 'failed', 'canceled'].includes(task.status)) {
      if (options.signal?.aborted) throw new DOMException('已取消', 'AbortError');
      if (Date.now() - startedAt > timeoutMs) throw new Error('生成任务等待超时');
      await new Promise(resolve => setTimeout(resolve, options.intervalMs || 600));
      try {
        task = await getGeneration(taskId, options.signal);
        consecutiveErrors = 0;
      } catch (error) {
        if (options.signal?.aborted || error?.name === 'AbortError') throw error;
        const status = Number(error?.status || 0);
        const transient = !status || status === 408 || status === 429 || status >= 500;
        consecutiveErrors += 1;
        if (!transient || consecutiveErrors > maxConsecutiveErrors || Date.now() - startedAt > timeoutMs) throw error;
        options.onTransientError?.(error, { attempt: consecutiveErrors, maxAttempts: maxConsecutiveErrors, taskId });
        const retryDelay = Math.min(5000, 500 * Math.pow(1.65, consecutiveErrors - 1));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      if (options.onProgress) options.onProgress(task);
    }
    if (task.status !== 'completed') {
      const error = new Error(task.errorMessage || '生成失败，预扣积分已退回');
      error.task = task;
      throw error;
    }
    await refreshWallet().catch(() => {});
    return task;
  }

  return {
    request,
    login,
    register,
    restore,
    logout: clearSession,
    refreshWallet,
    getWalletLedger,
    createGeneration,
    getGeneration,
    listGenerations,
    cacheGenerationMedia,
    fetchMediaBlob,
    cancelGeneration,
    getModels,
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
    previewPricing,
    waitForGeneration,
    getToken: () => accessToken,
    getUser: () => user,
    getWallet: () => wallet,
    isAuthenticated: () => !!accessToken && !!user,
    isAdmin: () => user?.role === 'admin',
    baseUrl
  };
})();

function updateAuthUi() {
  const user = BackendClient.getUser();
  const wallet = BackendClient.getWallet();
  const isAdmin = user?.role === 'admin';
  document.querySelectorAll('[data-admin-only]').forEach(node => {
    node.classList.toggle('hidden', !isAdmin);
    node.hidden = !isAdmin;
  });
  const adminMenu = document.getElementById('menuGroupAdmin');
  if (adminMenu) {
    adminMenu.classList.toggle('hidden', !isAdmin);
    adminMenu.hidden = !isAdmin;
  }
  const adminView = document.getElementById('viewAdmin');
  if (!isAdmin) adminView?.classList.add('hidden');
  const overlay = document.getElementById('loginOverlay');
  const userName = document.getElementById('userNameText');
  const pillBalance = document.getElementById('creditPillBalance');
  const balanceText = document.getElementById('creditBalanceText');
  const reservedText = document.getElementById('creditReservedText');
  if (user) {
    overlay?.classList.add('hidden');
    if (overlay) overlay.style.display = 'none';
    if (userName) userName.textContent = `${user.username}${user.role === 'admin' ? ' · 管理员' : ''}`;
    if (pillBalance) pillBalance.textContent = `${Number(wallet?.balance ?? 0)}`;
    if (balanceText) balanceText.textContent = `${Number(wallet?.balance ?? 0)}`;
    if (reservedText) reservedText.textContent = `预扣积分：${Number(wallet?.reserved ?? 0)}`;
  } else {
    if (userName) userName.textContent = '未登录';
    if (pillBalance) pillBalance.textContent = '--';
    if (balanceText) balanceText.textContent = '--';
    if (reservedText) reservedText.textContent = '预扣积分：--';
    document.getElementById('creditLedgerList')?.replaceChildren(Object.assign(document.createElement('span'), { className: 'credit-ledger-empty', textContent: '请先登录' }));
    if (overlay) {
      overlay.classList.remove('hidden', 'logged-in');
      overlay.style.display = 'flex';
      overlay.style.opacity = '1';
    }
  }
}

function formatLedgerTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ledgerEntryLabel(entry) {
  return {
    grant: '赠送积分',
    reserve: '预扣积分',
    consume: '生成扣费',
    release: '释放预扣',
    refund: '失败退款',
    adjustment: '余额调整'
  }[entry?.entry_type] || entry?.entry_type || '积分变动';
}

let creditLedgerRequest = null;
async function loadCreditLedger() {
  const list = document.getElementById('creditLedgerList');
  if (!list || !BackendClient.isAuthenticated()) return;
  if (creditLedgerRequest) return creditLedgerRequest;
  list.innerHTML = '<span class="credit-ledger-empty">正在读取记录...</span>';
  creditLedgerRequest = BackendClient.getWalletLedger(20)
    .then(entries => {
      const rows = Array.isArray(entries) ? entries : [];
      list.innerHTML = rows.length ? rows.map(entry => {
        const amount = Number(entry.amount || 0);
        const sign = amount > 0 ? '+' : '';
        const description = entry.description || ledgerEntryLabel(entry);
        return `<div class="credit-ledger-row">
          <div class="credit-ledger-main"><div class="credit-ledger-desc" title="${escapeHTML(description)}">${escapeHTML(description)}</div><div class="credit-ledger-time">${escapeHTML(formatLedgerTime(entry.created_at))}</div></div>
          <span class="credit-ledger-amount ${amount >= 0 ? 'is-positive' : 'is-negative'}">${sign}${amount}</span>
        </div>`;
      }).join('') : '<span class="credit-ledger-empty">暂无积分记录</span>';
    })
    .catch(error => {
      list.innerHTML = `<span class="credit-ledger-empty">记录读取失败：${escapeHTML(error.message || '请稍后重试')}</span>`;
    })
    .finally(() => { creditLedgerRequest = null; });
  return creditLedgerRequest;
}

function initCreditHoverCard() {
  const pill = document.getElementById('creditPill');
  const card = document.getElementById('creditHoverCard');
  if (!pill || !card || pill.dataset.creditHoverBound) return;
  pill.dataset.creditHoverBound = 'true';

  const positionCard = () => {
    if (card.hasAttribute('hidden')) return;
    const rect = pill.getBoundingClientRect();
    const cardWidth = Math.min(300, window.innerWidth - 32);
    const left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, rect.right - cardWidth));
    card.style.width = `${cardWidth}px`;
    card.style.left = `${left}px`;
    card.style.right = 'auto';
    card.style.top = `${rect.bottom + 10}px`;
    card.style.bottom = 'auto';
  };

  const open = () => {
    if (!BackendClient.isAuthenticated()) return;
    pill.classList.add('credit-card-open');
    pill.dataset.creditHoverOpen = 'true';
    if (card.parentElement !== document.body) document.body.appendChild(card);
    card.classList.add('credit-hover-card-portal');
    card.setAttribute('aria-hidden', 'false');
    card.removeAttribute('hidden');
    positionCard();
    void loadCreditLedger();
  };

  const close = event => {
    const next = event?.relatedTarget;
    if (next && (pill.contains(next) || card.contains(next))) return;
    pill.classList.remove('credit-card-open');
    delete pill.dataset.creditHoverOpen;
    card.setAttribute('aria-hidden', 'true');
    card.setAttribute('hidden', '');
  };

  pill.addEventListener('mouseenter', open);
  pill.addEventListener('mouseleave', close);
  pill.addEventListener('focusin', open);
  pill.addEventListener('focusout', close);
  card.addEventListener('mouseenter', open);
  card.addEventListener('mouseleave', close);
  card.addEventListener('focusout', close);
  window.addEventListener('resize', positionCard);
  window.addEventListener('scroll', positionCard, true);
}

function extractGenerationText(task) {
  const output = task?.output || {};
  return output?.choices?.[0]?.message?.content
    || output?.choices?.[0]?.text
    || output?.content
    || output?.text
    || '';
}

async function backendGenerateText({ mode = 'creation', operation = 'llm', model, prompt, messages, signal, onProgress }) {
  const configuredModel = getPreferredServerModel(mode, operation, model || state.apiConfig.llmModelName);
  if (!configuredModel) {
    const modeLabel = mode === 'canvas' ? '画布智能体' : (mode === 'long-script' ? '长剧本' : '创作扩写');
    throw new Error(`${modeLabel}暂无可用模型，请联系管理员启用模型`);
  }
  const created = await BackendClient.createGeneration({
    mode,
    operation,
    model: configuredModel,
    prompt,
    input: { messages: messages || [{ role: 'user', content: prompt }], temperature: 0.7 },
    signal
  });
  const task = await BackendClient.waitForGeneration(created.task, { signal, onProgress });
  return extractGenerationText(task);
}

let el = {};

const EPHEMERAL_SESSION_MODE = window.PRIVACY_EPHEMERAL_MODE !== false;
const ephemeralSessionStores = { sessions: new Map(), meta: new Map() };

/* ========================================================================== 
   Multi-session core (privacy mode keeps session payloads in memory only)
   ========================================================================== */
const SessionSystem = (() => {
  const DB_NAME = 'videoPromptKbSessions';
  const DB_VERSION = 1;
  const ACTIVE_KEY = 'vkb_active_session_id';
  const MIGRATION_KEY = 'vkb_sessions_migrated_v1';
  const TYPE_VIEW = { creation: 'videoGen', canvas: 'canvasMode', 'long-script': 'longScriptGen' };
  const TYPE_META = {
    creation: { label: '创作', icon: '✦' },
    canvas: { label: '画布', icon: '▦' },
    'long-script': { label: '长剧本', icon: '▤' },
    'multi-angle': { label: '多角度', icon: '◉' }
  };
  let db = null;
  let sessions = [];
  let activeSession = null;
  let initialized = false;
  let applying = false;
  let saveTimer = null;
  let saveChain = Promise.resolve();
  let initialCreationHtml = '';
  let contextMenu = null;
  let mutationObserver = null;
  let creationLatestScrollObserver = null;
  let creationLatestScrollTimer = null;
  let creationLatestScrollInteractionController = null;
  let activeSessionDirty = false;
  let pendingCreationDomMigrationSave = false;
  let historyViewMode = localStorage.getItem('vkb_creation_history_view') === 'grid' ? 'grid' : 'list';
  const HISTORY_MEDIA_PAGE_SIZE = 30;
  let historyVisibleCount = HISTORY_MEDIA_PAGE_SIZE;
  let previewMediaItem = null;
  const permanentDeleteArmed = new Set();
  let sessionBatchMode = false;
  const sessionBatchSelected = new Set();
  let trashBatchMode = false;
  const trashBatchSelected = new Set();
  let trashBatchDeleteArmed = false;
  const pollers = new Map();
  const canceledTaskIds = new Set();
  const pendingSessionRequests = new Map();

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `session_${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
  }

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (error) {}
    }
    return JSON.parse(JSON.stringify(value));
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });
  }

  function openDatabase() {
    if (EPHEMERAL_SESSION_MODE) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('sessions')) {
          const store = database.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('deletedAt', 'deletedAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAllSessions() {
    if (EPHEMERAL_SESSION_MODE) return [...ephemeralSessionStores.sessions.values()].map(clone);
    const transaction = db.transaction('sessions', 'readonly');
    return requestResult(transaction.objectStore('sessions').getAll());
  }

  async function putSession(session) {
    if (EPHEMERAL_SESSION_MODE) {
      ephemeralSessionStores.sessions.set(session.id, clone(session));
    } else {
      const transaction = db.transaction('sessions', 'readwrite');
      transaction.objectStore('sessions').put(session);
      await transactionDone(transaction);
    }
    const index = sessions.findIndex(item => item.id === session.id);
    if (index >= 0) sessions[index] = session;
    else sessions.push(session);
    return session;
  }

  async function removeSession(id) {
    if (EPHEMERAL_SESSION_MODE) {
      ephemeralSessionStores.sessions.delete(id);
    } else {
      const transaction = db.transaction('sessions', 'readwrite');
      transaction.objectStore('sessions').delete(id);
      await transactionDone(transaction);
    }
    sessions = sessions.filter(item => item.id !== id);
  }

  function parseLocalJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn(`Failed to parse legacy state ${key}:`, error);
      return fallback;
    }
  }

  function getEmptyCreationData() {
    return {
      chatHtml: initialCreationHtml,
      inputDraft: '',
      refMedia: [],
      mode: 'video',
      model: document.getElementById('chatModelSelect')?.value || state.apiConfig.model,
      imageModel: document.getElementById('chatImageModelSelect')?.value || state.apiConfig.imageModel,
      videoAspect: document.getElementById('chatAspectSelect')?.value || '16:9',
      imageAspect: document.getElementById('chatImageAspectSelect')?.value || '1:1',
      imageCount: document.getElementById('chatImageCountInput')?.value || '1',
      duration: document.getElementById('chatDurationSelect')?.value || '5',
      tasks: []
    };
  }

  function getEmptyCanvasData() {
    return { nodes: [], connections: [], zoom: 1, panX: 0, panY: 0, tasks: [] };
  }

  function getEmptyLongScriptData() {
    return {
      htmlCode: '',
      shots: [],
      versions: [],
      history: [],
      inputDraft: '',
      pendingImages: []
    };
  }

  function createRecord(type, data, timestamp = Date.now(), options = {}) {
    return {
      id: uuid(),
      type,
      title: '未命名',
      pinned: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      transient: options.transient === true,
      taskSummary: { running: 0, completed: 0, failed: 0 },
      data: clone(data)
    };
  }

  function getLegacyLongScriptData() {
    const legacy = parseLocalJson('video_prompt_kb_long_script_state', null);
    if (!legacy) return getEmptyLongScriptData();
    const shots = Array.isArray(legacy.shots) ? legacy.shots : getInitialStoryboardShots();
    return {
      htmlCode: legacy.htmlCode || compileShotsTo7ColumnHtml(shots),
      shots,
      versions: Array.isArray(legacy.versions) ? legacy.versions : [],
      history: Array.isArray(legacy.history) ? legacy.history : [],
      inputDraft: legacy.inputDraft || '',
      pendingImages: Array.isArray(legacy.pendingImages) ? legacy.pendingImages : []
    };
  }

  async function migrateLegacySessions() {
    if (EPHEMERAL_SESSION_MODE) {
      if (sessions.length) return;
      const now = Date.now();
      await Promise.all([
        putSession(createRecord('creation', getEmptyCreationData(), now - 2)),
        putSession(createRecord('canvas', getEmptyCanvasData(), now - 1)),
        putSession(createRecord('long-script', getEmptyLongScriptData(), now))
      ]);
      return;
    }
    if (localStorage.getItem(MIGRATION_KEY) === '1') return;
    const now = Date.now();
    const legacyCanvas = parseLocalJson('vkb_canvas_state', null);
    const creation = createRecord('creation', getEmptyCreationData(), now - 2);
    const canvas = createRecord('canvas', legacyCanvas ? {
      nodes: legacyCanvas.nodes || [],
      connections: legacyCanvas.connections || [],
      zoom: legacyCanvas.zoom || 1,
      panX: legacyCanvas.panX || 0,
      panY: legacyCanvas.panY || 0,
      tasks: []
    } : getEmptyCanvasData(), now - 1);
    const longScript = createRecord('long-script', getLegacyLongScriptData(), now);
    await Promise.all([putSession(creation), putSession(canvas), putSession(longScript)]);
    localStorage.setItem(MIGRATION_KEY, '1');
    if (!localStorage.getItem(ACTIVE_KEY)) localStorage.setItem(ACTIVE_KEY, creation.id);
  }

  function getTasksForSession(id) {
    const active = (state.activeTasks || []).filter(task => task.sessionId === id);
    const history = (state.taskHistory || []).filter(task => task.sessionId === id);
    const byId = new Map();
    [...history, ...active].forEach(task => byId.set(task.taskId, clone(task)));
    return [...byId.values()];
  }

  function summarizeTasks(tasks) {
    return (tasks || []).reduce((summary, task) => {
      if (['queued', 'in_progress', 'running', 'rendering', 'paused', 'reconciling', 'needs_review'].includes(task.status)) summary.running += 1;
      else if (task.status === 'completed' && task.unseen) summary.completed += 1;
      else if (['failed', 'refunded', 'canceled'].includes(task.status) && task.unseen) summary.failed += 1;
      return summary;
    }, { running: 0, completed: 0, failed: 0 });
  }

  function captureCreationState() {
    return {
      chatHtml: serializeManagedVideoHtml(el.aiChatStream, initialCreationHtml),
      inputDraft: el.aiChatTextarea?.value || '',
      refMedia: clone(state.chatRefMediaList || []),
      mode: getChatGenerationMode(),
      model: el.chatModelSelect?.value || state.apiConfig.model,
      imageModel: document.getElementById('chatImageModelSelect')?.value || state.apiConfig.imageModel,
      videoAspect: el.chatAspectSelect?.value || '16:9',
      imageAspect: el.chatImageAspectSelect?.value || state.chatImageAspect || '1:1',
      imageCount: el.chatImageCountInput?.value || state.chatImageCount || '1',
      duration: el.chatDurationSelect?.value || '5',
      tasks: getTasksForSession(activeSession?.id)
    };
  }

  function captureCanvasState() {
    syncAllCanvasInputSelections(false);
    return {
      nodes: clone(canvasState.nodes || []),
      connections: clone(canvasState.connections || []),
      zoom: canvasState.zoom || 1,
      panX: canvasState.panX || 0,
      panY: canvasState.panY || 0,
      tasks: getTasksForSession(activeSession?.id)
    };
  }

  function captureLongScriptState() {
    return {
      htmlCode: window.currentCanvasHtmlCode || '',
      shots: clone(window.currentStoryboardShots || []),
      versions: clone(activeSession?.data?.versions || []),
      history: clone(window.longScriptChatHistory || []),
      inputDraft: document.getElementById('longScriptChatInput')?.value || '',
      pendingImages: clone(window.longScriptPendingImages || []),
      longScriptRun: clone(activeSession?.data?.longScriptRun || null)
    };
  }

  function captureActiveState() {
    if (!activeSession) return null;
    if (activeSession.type === 'canvas') return captureCanvasState();
    if (activeSession.type === 'long-script') return captureLongScriptState();
    return captureCreationState();
  }

  function normalizeCreationRecoveryText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function getCreationSessionSearchText(session) {
    const container = document.createElement('div');
    container.innerHTML = session?.data?.chatHtml || '';
    container.querySelectorAll('textarea').forEach(textarea => {
      textarea.replaceWith(document.createTextNode(textarea.textContent || textarea.value || ''));
    });
    return normalizeCreationRecoveryText(`${container.textContent || ''} ${session?.data?.inputDraft || ''}`);
  }

  function frontendVideoTaskFromBackend(backendTask, session, previous = null) {
    const combinedResponse = { ...backendTask, ...(backendTask.output || {}) };
    const parsed = parseVideoTaskResponse(combinedResponse, new Date(backendTask.createdAt || Date.now()).getTime());
    const duration = Number(backendTask.input?.duration || previous?.duration || 5);
    const aspectRatio = backendTask.input?.metadata?.aspect_ratio || previous?.options?.aspectRatio || '16:9';
    return {
      ...(previous ? clone(previous) : {}),
      source: 'chat',
      mediaType: 'video',
      operation: 'video',
      taskId: backendTask.id,
      backendTaskId: backendTask.id,
      requestId: backendTask.requestId || previous?.requestId || null,
      prompt: backendTask.prompt || previous?.prompt || '',
      model: backendTask.model || previous?.model || DEFAULT_VIDEO_MODEL,
      duration,
      options: { ...(previous?.options || {}), aspectRatio, duration },
      status: backendTask.status || parsed.status || previous?.status || 'in_progress',
      progress: backendTask.status === 'completed'
        ? 100
        : Math.max(Number(previous?.progress || 0), Number(parsed.progress || 0)),
      reservedCredits: Number(backendTask.reservedCredits || previous?.reservedCredits || 0),
      consumedCredits: Number(backendTask.consumedCredits || previous?.consumedCredits || 0),
      videoUrl: parsed.videoUrl || previous?.videoUrl || null,
      errorMsg: backendTask.errorMessage || parsed.errorMsg || previous?.errorMsg || null,
      consecutivePollErrors: Number(backendTask.consecutivePollErrors || 0),
      recoveryState: backendTask.recoveryState || previous?.recoveryState || 'normal',
      createdAt: new Date(backendTask.createdAt || previous?.createdAt || Date.now()).getTime(),
      updatedAt: new Date(backendTask.updatedAt || Date.now()).getTime(),
      sessionId: session.id,
      sessionType: 'creation'
    };
  }

  function frontendImageTaskFromBackend(backendTask, session, previous = null) {
    const imageSources = extractImageSourcesFromOutput(backendTask.output || {});
    const status = backendTask.status || previous?.status || 'in_progress';
    const isTerminal = ['completed', 'refunded', 'failed', 'canceled'].includes(status);
    const aspectRatio = backendTask.input?.metadata?.aspect_ratio || previous?.options?.aspectRatio || '1:1';
    const count = Number(backendTask.input?.n || previous?.count || 1);
    return {
      ...(previous ? clone(previous) : {}),
      source: 'chat',
      mediaType: 'image',
      operation: 'image',
      taskId: backendTask.id,
      backendTaskId: backendTask.id,
      requestId: backendTask.requestId || previous?.requestId || null,
      prompt: backendTask.prompt || previous?.prompt || '',
      model: backendTask.model || previous?.model || state.apiConfig.imageModel || 'gpt-image-2',
      imageSize: backendTask.input?.size || previous?.imageSize || '',
      count,
      options: { ...(previous?.options || {}), generationMode: 'image', aspectRatio, size: backendTask.input?.size || '', count },
      status,
      progress: status === 'completed' ? 100 : (isTerminal ? 100 : Math.min(92, Math.max(Number(previous?.progress || 5), Number(backendTask.progress || backendTask.output?.progress || 0)))),
      reservedCredits: Number(backendTask.reservedCredits || previous?.reservedCredits || 0),
      consumedCredits: Number(backendTask.consumedCredits || previous?.consumedCredits || 0),
      imageUrls: imageSources.length ? imageSources : (previous?.imageUrls || []),
      imageUrl: imageSources[0] || previous?.imageUrl || null,
      providerJobs: Array.isArray(backendTask.providerJobs) ? clone(backendTask.providerJobs) : previous?.providerJobs,
      errorMsg: status === 'completed' ? null : (backendTask.errorMessage || previous?.errorMsg || null),
      consecutivePollErrors: Number(backendTask.consecutivePollErrors || 0),
      recoveryState: backendTask.recoveryState || previous?.recoveryState || 'normal',
      createdAt: new Date(backendTask.createdAt || previous?.createdAt || Date.now()).getTime(),
      updatedAt: new Date(backendTask.updatedAt || Date.now()).getTime(),
      sessionId: session.id,
      sessionType: 'creation'
    };
  }

  function frontendCanvasTaskFromBackend(backendTask, session, previous = null, canvasNodeId = null) {
    const mediaType = backendTask.operation === 'image' ? 'image' : 'video';
    const combinedResponse = { ...backendTask, ...(backendTask.output || {}) };
    const parsedVideo = mediaType === 'video'
      ? parseVideoTaskResponse(combinedResponse, new Date(backendTask.createdAt || Date.now()).getTime())
      : null;
    const imageSources = mediaType === 'image' ? extractImageSourcesFromOutput(backendTask.output || {}) : [];
    const status = backendTask.status || previous?.status || 'in_progress';
    const isTerminal = ['completed', 'refunded', 'failed', 'canceled'].includes(status);
    const duration = Number(backendTask.input?.duration || previous?.duration || 5);
    const aspectRatio = backendTask.input?.metadata?.aspect_ratio || previous?.options?.aspectRatio || '16:9';
    const taskId = previous?.taskId || backendTask.requestId || backendTask.id;
    return {
      ...(previous ? clone(previous) : {}),
      source: 'canvas',
      mediaType,
      operation: mediaType,
      taskId,
      backendTaskId: backendTask.id,
      requestId: backendTask.requestId || previous?.requestId || taskId,
      prompt: backendTask.prompt || previous?.prompt || '',
      model: backendTask.model || previous?.model || (mediaType === 'image' ? state.apiConfig.imageModel : DEFAULT_VIDEO_MODEL),
      duration,
      options: { ...(previous?.options || {}), aspectRatio, duration },
      status,
      progress: status === 'completed' ? 100 : (isTerminal ? 100 : Math.min(92, Math.max(Number(previous?.progress || 5), Number(backendTask.progress || parsedVideo?.progress || 0)))),
      reservedCredits: Number(backendTask.reservedCredits || previous?.reservedCredits || 0),
      consumedCredits: Number(backendTask.consumedCredits || previous?.consumedCredits || 0),
      imageUrls: imageSources.length ? imageSources : (previous?.imageUrls || []),
      imageUrl: imageSources[0] || previous?.imageUrl || null,
      videoUrl: parsedVideo?.videoUrl || previous?.videoUrl || null,
      errorMsg: status === 'completed' ? null : (backendTask.errorMessage || parsedVideo?.errorMsg || previous?.errorMsg || null),
      consecutivePollErrors: Number(backendTask.consecutivePollErrors || 0),
      recoveryState: backendTask.recoveryState || previous?.recoveryState || 'normal',
      createdAt: new Date(backendTask.createdAt || previous?.createdAt || Date.now()).getTime(),
      updatedAt: new Date(backendTask.updatedAt || Date.now()).getTime(),
      sessionId: session.id,
      sessionType: 'canvas',
      canvasNodeId: canvasNodeId || previous?.canvasNodeId || null
    };
  }

  function applyRecoveredCanvasTaskToNode(node, task) {
    if (!node || !task) return;
    node.taskId = task.taskId;
    node.progress = task.progress;
    node.errorMsg = task.errorMsg || '';
    if (task.status === 'completed') {
      node.errorMsg = '';
      node.statusMessage = '';
      node.recoveryState = 'normal';
      if (task.mediaType === 'image' && task.imageUrl) {
        node.imgUrl = task.imageUrl;
        node.mediaAutoSizePending = true;
        node.assetName = 'AI 生成图片';
        node.title = '🖼️ 参考图节点';
        node.status = 'done';
      } else if (task.mediaType === 'video' && task.videoUrl) {
        node.videoUrl = task.videoUrl;
        node.mediaAutoSizePending = true;
        node.status = 'done';
      } else {
        node.status = 'failed';
        node.progress = 100;
        node.errorMsg = `后台任务已完成，但没有返回${task.mediaType === 'image' ? '图片' : '视频'}地址`;
      }
      return;
    }
    if (['refunded', 'failed'].includes(task.status)) {
      node.status = 'failed';
      node.progress = 100;
      node.errorMsg = task.errorMsg || '生成失败，积分已退回';
      return;
    }
    if (task.status === 'canceled') {
      node.status = 'idle';
      node.progress = 0;
      node.errorMsg = '任务已取消';
      return;
    }
    node.recoveryState = task.recoveryState || task.status;
    node.statusMessage = task.status === 'needs_review'
      ? '等待供应商状态确认'
      : task.status === 'reconciling'
        ? '网络波动，后台自动恢复中'
        : '';
    node.status = 'generating';
  }

  async function reconcileBackendGenerationTasks() {
    if (!initialized || !BackendClient.isAuthenticated()) return;
    let backendTasks;
    try {
      backendTasks = await BackendClient.listGenerations(100);
    } catch (error) {
      console.warn('Backend task reconciliation failed:', error);
      return;
    }
    const creationSessions = sessions.filter(session => !session.deletedAt && session.type === 'creation');
    const eligibleTasks = (backendTasks || []).filter(task => task?.mode === 'creation' && ['image', 'video'].includes(task?.operation));
    let activeCreationChanged = false;
    for (const backendTask of eligibleTasks) {
      let targetSession = creationSessions.find(session => (session.data?.tasks || []).some(task =>
        task.taskId === backendTask.id || task.backendTaskId === backendTask.id
      ));
      const boundSessionId = backendTask.input?.metadata?.client_session_id;
      if (!targetSession && boundSessionId) {
        targetSession = creationSessions.find(session => session.id === boundSessionId);
      }
      if (!targetSession) {
        const promptText = normalizeCreationRecoveryText(backendTask.prompt);
        const promptNeedle = promptText.slice(0, Math.min(80, promptText.length));
        if (promptNeedle.length >= 16) {
          const promptMatches = creationSessions.filter(session => getCreationSessionSearchText(session).includes(promptNeedle));
          if (promptMatches.length === 1) targetSession = promptMatches[0];
        }
      }
      if (!targetSession) {
        const taskCreatedAt = new Date(backendTask.createdAt || 0).getTime();
        const recentMatches = creationSessions.filter(session => {
          const distance = Math.abs(Number(session.updatedAt || session.createdAt || 0) - taskCreatedAt);
          return Number.isFinite(taskCreatedAt)
            && distance <= 15 * 60 * 1000
            && /llm-confirm-card|task-item-card/.test(session.data?.chatHtml || '');
        });
        if (recentMatches.length === 1) targetSession = recentMatches[0];
      }
      const mcpDraftId = backendTask.input?.metadata?.source === 'mcp'
        ? backendTask.input?.metadata?.draft_id
        : null;
      if (!targetSession && mcpDraftId) {
        targetSession = creationSessions.find(session => session.data?.mcpDraftId === mcpDraftId);
      }
      if (!targetSession && mcpDraftId) {
        const createdAt = new Date(backendTask.createdAt || Date.now()).getTime();
        const promptTitle = normalizeCreationRecoveryText(backendTask.prompt).slice(0, 24);
        targetSession = createRecord('creation', {
          ...getEmptyCreationData(),
          mode: backendTask.operation === 'image' ? 'image' : 'video',
          mcpDraftId,
          tasks: []
        }, Number.isFinite(createdAt) ? createdAt : Date.now());
        targetSession.title = promptTitle ? `MCP · ${promptTitle}` : 'MCP 创作';
        await putSession(targetSession);
        creationSessions.push(targetSession);
      }
      if (!targetSession) continue;

      const tasks = Array.isArray(targetSession.data?.tasks) ? targetSession.data.tasks : [];
      const index = tasks.findIndex(task => task.taskId === backendTask.id || task.backendTaskId === backendTask.id);
      const nextTask = backendTask.operation === 'image'
        ? frontendImageTaskFromBackend(backendTask, targetSession, index >= 0 ? tasks[index] : null)
        : frontendVideoTaskFromBackend(backendTask, targetSession, index >= 0 ? tasks[index] : null);
      if (index >= 0) tasks[index] = nextTask;
      else tasks.push(nextTask);
      targetSession.data = { ...(targetSession.data || getEmptyCreationData()), tasks };
      targetSession.taskSummary = summarizeTasks(tasks);
      await putSession(targetSession);
      if (activeSession?.id === targetSession.id) {
        activeSession.data = clone(targetSession.data);
        activeCreationChanged = true;
      }
    }

    if (activeCreationChanged && activeSession?.type === 'creation') {
      // 页面恢复或后台轮询完成时，同步内存任务并直接刷新当前卡片，不再依赖整页刷新。
      restoreSessionTasks(activeSession.data?.tasks || []);
      rehydrateCreationDom();
    }

    const canvasSessions = sessions.filter(session => !session.deletedAt && session.type === 'canvas');
    const canvasTasks = (backendTasks || []).filter(task => task?.mode === 'canvas' && ['image', 'video'].includes(task?.operation));
    for (const backendTask of canvasTasks) {
      const clientContext = backendTask.input?.client_context || {};
      const boundSessionId = clientContext.session_id || backendTask.input?.metadata?.client_session_id || null;
      let targetSession = canvasSessions.find(session => (session.data?.tasks || []).some(task =>
        task.taskId === backendTask.requestId
        || task.taskId === backendTask.id
        || task.backendTaskId === backendTask.id
      ));
      if (!targetSession && boundSessionId) targetSession = canvasSessions.find(session => session.id === boundSessionId);
      if (!targetSession) continue;

      const tasks = Array.isArray(targetSession.data?.tasks) ? targetSession.data.tasks : [];
      const index = tasks.findIndex(task =>
        task.taskId === backendTask.requestId
        || task.taskId === backendTask.id
        || task.backendTaskId === backendTask.id
      );
      const previous = index >= 0 ? tasks[index] : null;
      const canvasNodeId = previous?.canvasNodeId || clientContext.node_id || null;
      const targetNode = (targetSession.data?.nodes || []).find(node => node.id === canvasNodeId);
      if (!targetNode) continue;

      const nextTask = frontendCanvasTaskFromBackend(backendTask, targetSession, previous, canvasNodeId);
      applyRecoveredCanvasTaskToNode(targetNode, nextTask);
      if (index >= 0) tasks[index] = nextTask;
      else tasks.push(nextTask);
      targetSession.data = { ...(targetSession.data || getEmptyCanvasData()), tasks };
      targetSession.taskSummary = summarizeTasks(tasks);
      await putSession(targetSession);

      if (activeSession?.id === targetSession.id) {
        activeSession.data = clone(targetSession.data);
        const liveNode = canvasState?.nodes?.find(node => node.id === canvasNodeId);
        if (liveNode) applyRecoveredCanvasTaskToNode(liveNode, nextTask);
      }
    }
    if (activeSession?.type === 'canvas' && typeof renderCanvasNodesAndLines === 'function') renderCanvasNodesAndLines();
    renderSidebar();
  }

  function setSaveStatus(text, className = '') {
    const status = document.getElementById('sessionSaveStatus');
    if (!status) return;
    const visibleText = EPHEMERAL_SESSION_MODE && !className.includes('error')
      ? '仅本次打开有效'
      : text;
    status.textContent = visibleText;
    status.className = `session-save-status${className ? ` ${className}` : ''}`;
  }

  async function saveNow(options = {}) {
    if (!initialized || applying || !activeSession || activeSession.deletedAt) return;
    window.clearTimeout(saveTimer);
    const sessionId = activeSession.id;
    const data = captureActiveState();
    if (activeSession.transient && !hasMeaningfulContent(activeSession.type, data)) {
      activeSession.data = data;
      activeSessionDirty = false;
      setSaveStatus('未保存草稿');
      return activeSession;
    }
    const shouldTouch = options.touch !== false && activeSessionDirty;
    setSaveStatus('保存中', 'saving');
    saveChain = saveChain.catch(() => {}).then(async () => {
      let session = sessions.find(item => item.id === sessionId);
      if (!session && activeSession?.id === sessionId && activeSession.transient) {
        activeSession.transient = false;
        session = activeSession;
      }
      if (!session || session.deletedAt) return;
      session.data = data;
      session.taskSummary = summarizeTasks(data.tasks || []);
      if (shouldTouch) session.updatedAt = Date.now();
      await putSession(session);
      if (activeSession?.id === sessionId) {
        localStorage.setItem(ACTIVE_KEY, sessionId);
        activeSessionDirty = false;
      }
    });
    try {
      await saveChain;
      setSaveStatus('已保存');
      renderSidebar();
    } catch (error) {
      console.error('Session save failed:', error);
      setSaveStatus('保存失败', 'error');
    }
  }

  function scheduleSave() {
    if (!initialized || applying || !activeSession || activeSession.deletedAt) return;
    activeSessionDirty = true;
    setSaveStatus('保存中', 'saving');
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveNow(), 500);
  }

  function setSegmentValue(element, value) {
    if (!element) return;
    element.value = String(value);
    const segment = element.closest('.apple-segment-control');
    if (segment) {
      segment.dataset.value = String(value);
      segment.querySelectorAll('.segment-btn').forEach(button => button.classList.toggle('active', button.dataset.value === String(value)));
    }
  }

  function scrollCreationSessionToLatest() {
    const container = el.aiChatStream;
    if (!container) return;
    if (creationLatestScrollObserver) creationLatestScrollObserver.disconnect();
    if (creationLatestScrollTimer) window.clearTimeout(creationLatestScrollTimer);
    if (creationLatestScrollInteractionController) creationLatestScrollInteractionController.abort();
    let canceledByUser = false;
    const interactionController = new AbortController();
    creationLatestScrollInteractionController = interactionController;
    const stopAutoFollow = () => {
      canceledByUser = true;
      creationLatestScrollObserver?.disconnect();
      creationLatestScrollObserver = null;
      if (creationLatestScrollTimer) window.clearTimeout(creationLatestScrollTimer);
      creationLatestScrollTimer = null;
      interactionController.abort();
      if (creationLatestScrollInteractionController === interactionController) creationLatestScrollInteractionController = null;
    };
    const alignToLatest = () => {
      if (canceledByUser) return;
      container.scrollTop = container.scrollHeight;
    };
    const interactionOptions = { passive: true, signal: interactionController.signal };
    container.addEventListener('wheel', stopAutoFollow, interactionOptions);
    container.addEventListener('touchstart', stopAutoFollow, interactionOptions);
    container.addEventListener('pointerdown', stopAutoFollow, { signal: interactionController.signal });
    alignToLatest();
    window.requestAnimationFrame(() => {
      alignToLatest();
      window.requestAnimationFrame(alignToLatest);
    });
    creationLatestScrollObserver = new MutationObserver(alignToLatest);
    creationLatestScrollObserver.observe(container, { childList: true, subtree: true });
    container.querySelectorAll('img, video').forEach(media => {
      media.addEventListener('load', alignToLatest, { once: true });
      media.addEventListener('loadedmetadata', alignToLatest, { once: true });
    });
    creationLatestScrollTimer = window.setTimeout(() => {
      stopAutoFollow();
    }, 1500);
  }

  function restoreCreation(data) {
    const next = data || getEmptyCreationData();
    if (el.aiChatStream) el.aiChatStream.innerHTML = prepareLazyVideoMarkup(next.chatHtml || initialCreationHtml);
    state.chatRefMediaList = clone(next.refMedia || []);
    if (el.aiChatTextarea) el.aiChatTextarea.value = next.inputDraft || '';
    renderChatRefMediaList();
    // 恢复会话时先完整同步模型与时长，再统一请求一次价格，避免先按旧时长显示积分。
    if (next.imageModel && state.apiConfig) state.apiConfig.imageModel = next.imageModel;
    syncChatGenerationMode(next.mode || 'video', { persist: false, price: false });
    const model = next.model || state.apiConfig.model;
    if (el.chatModelSelect) el.chatModelSelect.value = model;
    const modelDropdown = document.getElementById('chatModelDropdown');
    if (modelDropdown) {
      modelDropdown.dataset.value = model;
      modelDropdown.querySelectorAll('.pill-option').forEach(option => option.classList.toggle('active', option.dataset.value === model));
      const option = modelDropdown.querySelector(`.pill-option[data-value="${CSS.escape(model)}"]`);
      const label = modelDropdown.querySelector('.pill-label');
      if (label && option) label.textContent = option.querySelector('.opt-name')?.textContent || model;
    }
    setSegmentValue(el.chatAspectSelect, next.videoAspect || '16:9');
    setSegmentValue(el.chatImageAspectSelect, next.imageAspect || '1:1');
    syncChatImageCount(next.imageCount || 1, { persist: false });
    syncChatDurationControl(model, next.duration || 5);
    updateCreationPricePreview();
    restoreSessionTasks(next.tasks || []);
    rehydrateCreationDom();
    observeManagedVideos(el.aiChatStream);
  }

  function restoreCanvas(data) {
    const next = data || getEmptyCanvasData();
    releaseCanvasLocalMediaUrls(canvasState.nodes || []);
    canvasState.nodes = clone(next.nodes || []);
    let clearedLegacySizeError = false;
    canvasState.nodes.forEach(node => {
      if (/请求体不能超过\s*2\s*MB/i.test(String(node.errorMsg || ''))) {
        node.status = 'idle';
        node.progress = 0;
        node.errorMsg = '';
        clearedLegacySizeError = true;
      }
    });
    if (clearedLegacySizeError) {
      next.nodes = clone(canvasState.nodes);
      window.setTimeout(() => {
        if (activeSession?.type === 'canvas') void saveNow({ touch: false });
      }, 150);
    }
    rehydrateCanvasLocalMediaNodes(canvasState.nodes);
    canvasState.connections = clone(next.connections || []);
    canvasState.zoom = next.zoom || 1;
    canvasState.panX = next.panX || 0;
    canvasState.panY = next.panY || 0;
    canvasState.selectedNodeIds = [];
    canvasState.selectedConnectionIds = [];
    syncAllCanvasInputSelections(false);
    restoreSessionTasks(next.tasks || []);
    (next.tasks || []).filter(task => ['queued', 'in_progress', 'running', 'rendering', 'paused', 'reconciling', 'needs_review'].includes(task.status)).forEach(savedTask => {
      const task = state.activeTasks.find(item => item.taskId === savedTask.taskId) || savedTask;
      const node = canvasState.nodes.find(item => item.id === task.canvasNodeId);
      if (!node) return;
      node.taskId = task.taskId;
      node.status = 'generating';
      node.progress = task.progress || node.progress || 5;
    });
  }

  function renderLongScriptHistory() {
    const container = document.getElementById('longScriptChatContainer');
    if (!container) return;
    if (window.longScriptChatHistory.length) {
      container.innerHTML = window.longScriptChatHistory.map(renderLongScriptMessage).join('');
    } else {
      container.innerHTML = renderLongScriptMessage({ role: 'assistant', content: '有什么想法，尽管和我说说。' });
    }
    container.scrollTop = container.scrollHeight;
  }

  function restoreLongScript(data) {
    const next = data || getEmptyLongScriptData();
    window.currentStoryboardShots = clone(next.shots || []);
    window.longScriptChatHistory = clone(next.history || []);
    window.longScriptPendingImages = clone(next.pendingImages || []);
    const input = document.getElementById('longScriptChatInput');
    if (input) input.value = next.inputDraft || '';
    renderLongScriptHistory();
    if (typeof renderLongScriptAttachmentPreview === 'function') renderLongScriptAttachmentPreview();
    renderCanvasBrowserHtml(next.htmlCode || '', { persist: false, allowEmpty: true });
    if (typeof updateLongScriptRollbackButton === 'function') updateLongScriptRollbackButton();
    if (typeof syncLongScriptRunUi === 'function') syncLongScriptRunUi(next.longScriptRun || null);
  }

  function restoreSessionTasks(tasks) {
    (tasks || []).forEach(savedTask => {
      if (!savedTask?.taskId) return;
      const existing = state.activeTasks.find(task => task.taskId === savedTask.taskId)
        || state.taskHistory.find(task => task.taskId === savedTask.taskId);
      const task = { ...(existing ? clone(existing) : {}), ...clone(savedTask) };
      state.activeTasks = state.activeTasks.filter(item => item.taskId !== task.taskId);
      state.taskHistory = state.taskHistory.filter(item => item.taskId !== task.taskId);
      if (['queued', 'in_progress', 'running', 'rendering', 'paused', 'reconciling', 'needs_review'].includes(task.status)) {
        task.status = task.source === 'canvas'
          ? 'rendering'
          : 'in_progress';
        state.activeTasks.push(task);
      }
      else state.taskHistory.unshift(task);
    });
    updateStatusIndicators();
  }

  async function openSession(id, options = {}) {
    const target = sessions.find(item => item.id === id && !item.deletedAt);
    if (!target) return;
    if (activeSession && activeSession.id !== target.id) await saveNow();
    if (target.type === 'canvas' && BackendClient.isAuthenticated()) {
      try {
        await reconcileBackendGenerationTasks();
      } catch (error) {
        console.warn('Canvas session backend reconciliation failed:', error);
      }
    }
    applying = true;
    activeSession = target;
    activeSessionDirty = false;
    localStorage.setItem(ACTIVE_KEY, target.id);
    try {
      if (target.type === 'canvas') restoreCanvas(target.data);
      else if (target.type === 'long-script') restoreLongScript(target.data);
      else restoreCreation(target.data);
      switchView(TYPE_VIEW[target.type]);
      if (target.type === 'creation') scrollCreationSessionToLatest();
      if (target.type === 'canvas') {
        initCanvasEngine();
        renderCanvasNodesAndLines();
        applyCanvasTransform();
        resumeCanvasSessionTasks(target.data?.tasks || []);
      }
      await markSessionViewed(target.id);
      await new Promise(resolve => window.setTimeout(resolve, 0));
    } finally {
      applying = false;
    }
    setSaveStatus('已保存');
    renderSidebar();
    if (pendingCreationDomMigrationSave && activeSession?.type === 'creation') {
      pendingCreationDomMigrationSave = false;
      scheduleSave();
    }
    if (!options.silent) closeContextMenu();
  }

  async function openInitial() {
    const requestedId = localStorage.getItem(ACTIVE_KEY);
    const target = sessions.find(item => item.id === requestedId && !item.deletedAt)
      || sessions.filter(item => !item.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (target) await openSession(target.id, { silent: true });
  }

  function hasMeaningfulContent(type, data = {}) {
    if (type === 'canvas') {
      return !!((data.nodes || []).length || (data.connections || []).length || (data.tasks || []).length);
    }
    if (type === 'long-script') {
      return !!((data.history || []).length
        || (data.inputDraft || '').trim()
        || (data.pendingImages || []).some(image => image?.status !== 'error' && (image?.url || image?.previewUrl || image?.status === 'loading'))
        || (data.htmlCode || '').trim()
        || (data.tasks || []).length);
    }
    const hasMessages = !!(data.chatHtml && data.chatHtml !== initialCreationHtml && !/gemini-welcome-card/.test(data.chatHtml));
    return !!(hasMessages
      || (data.inputDraft || '').trim()
      || (data.refMedia || []).length
      || (data.tasks || []).length);
  }

  function isEmpty(session) {
    return !hasMeaningfulContent(session?.type, session?.data || {});
  }

  function getEmptyData(type) {
    if (type === 'canvas') return getEmptyCanvasData();
    if (type === 'long-script') return getEmptyLongScriptData();
    return getEmptyCreationData();
  }

  async function createNew(type, options = {}) {
    if (!TYPE_VIEW[type]) return null;
    if (activeSession?.type === type) {
      await saveNow({ touch: false });
      if (isEmpty(activeSession) && !options.force) {
        if (!activeSession.transient) await openSession(activeSession.id);
        return activeSession;
      }
    } else if (activeSession) {
      await saveNow();
    }
    const session = createRecord(type, options.data || getEmptyData(type));
    await putSession(session);
    await openSession(session.id);
    return session;
  }

  async function startDraft(type) {
    if (!TYPE_VIEW[type]) return null;
    if (activeSession) await saveNow();
    applying = true;
    activeSession = createRecord(type, getEmptyData(type), Date.now(), { transient: true });
    activeSessionDirty = false;
    try {
      if (type === 'canvas') restoreCanvas(activeSession.data);
      else if (type === 'long-script') restoreLongScript(activeSession.data);
      else restoreCreation(activeSession.data);
      switchView(TYPE_VIEW[type]);
      if (type === 'canvas') {
        initCanvasEngine();
        renderCanvasNodesAndLines();
        applyCanvasTransform();
      }
      await new Promise(resolve => window.setTimeout(resolve, 0));
    } finally {
      applying = false;
    }
    setSaveStatus('未保存草稿');
    renderSidebar();
    closeContextMenu();
    return activeSession;
  }

  async function ensureActivePersisted() {
    if (!activeSession) return null;
    const target = activeSession;
    if (target.transient) {
      const data = captureActiveState();
      if (!hasMeaningfulContent(target.type, data)) return target;
      target.transient = false;
      target.data = data;
      target.updatedAt = Date.now();
      setSaveStatus('保存中', 'saving');
      try {
        saveChain = saveChain.catch(() => {}).then(() => putSession(target));
        await saveChain;
        if (activeSession?.id === target.id) localStorage.setItem(ACTIVE_KEY, target.id);
      } catch (error) {
        target.transient = true;
        setSaveStatus('保存失败', 'error');
        throw error;
      }
      if (activeSession?.id === target.id) activeSessionDirty = false;
      if (activeSession?.id === target.id) setSaveStatus('已保存');
      renderSidebar();
    }
    return target;
  }

  async function updateSessionData(sessionId, updater, options = {}) {
    let result = null;
    saveChain = saveChain.catch(() => {}).then(async () => {
      const session = sessions.find(item => item.id === sessionId);
      if (!session || session.deletedAt) return;
      const nextData = clone(session.data || {});
      const updatedData = typeof updater === 'function' ? (updater(nextData) || nextData) : { ...nextData, ...clone(updater || {}) };
      session.data = updatedData;
      if (Array.isArray(updatedData.tasks)) session.taskSummary = summarizeTasks(updatedData.tasks);
      if (options.touch !== false) session.updatedAt = Date.now();
      await putSession(session);
      if (activeSession?.id === sessionId) activeSession.data = clone(updatedData);
      result = clone(session);
    });
    await saveChain;
    renderSidebar();
    return result;
  }

  async function openType(type) {
    return startDraft(type);
  }

  function escapeText(value) {
    const div = document.createElement('div');
    div.textContent = String(value || '');
    return div.innerHTML;
  }

  function taskStatusHtml(session) {
    const summary = session.taskSummary || { running: 0, completed: 0, failed: 0 };
    const longScriptRunning = session.type === 'long-script' && session.data?.longScriptRun?.status === 'running';
    const runningCount = summary.running + (longScriptRunning ? 1 : 0);
    if (runningCount) return `<span class="session-item-status"><span class="session-status-spinner"></span>${runningCount}</span>`;
    if (summary.failed) return '<span class="session-item-status session-status-failed" title="有未查看失败任务">!</span>';
    if (summary.completed) return '<span class="session-item-status session-status-complete" title="有未查看完成任务">✓</span>';
    return '';
  }

  function renderSessionRows(list) {
    return list.map(session => {
      const meta = TYPE_META[session.type] || TYPE_META.creation;
      const checked = sessionBatchSelected.has(session.id);
      return `<div class="session-list-item${activeSession?.id === session.id ? ' active' : ''}${sessionBatchMode ? ' batch-mode' : ''}" data-session-id="${session.id}" title="${escapeText(meta.label)} · ${escapeText(session.title)}">
        ${sessionBatchMode ? `<label class="session-batch-check" title="选择会话"><input type="checkbox" data-session-select="${session.id}" ${checked ? 'checked' : ''} aria-label="选择 ${escapeText(session.title)}"></label>` : ''}
        <span class="session-item-icon">${meta.icon}</span>
        <span class="session-item-copy"><span class="session-item-type">${meta.label}</span><span class="session-item-title">${escapeText(session.title)}</span></span>
        <span class="session-item-status">${taskStatusHtml(session)}${session.pinned ? '<span class="session-pin-indicator" title="已置顶" aria-label="已置顶"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"></path><path d="M5 17h14"></path><path d="M7 17l1-7-3-3V5h14v2l-3 3 1 7"></path></svg></span>' : ''}${sessionBatchMode ? '' : `<button type="button" class="session-more-button" data-session-menu="${session.id}" aria-label="会话菜单">•••</button>`}</span>
      </div>`;
    }).join('');
  }

  function updateSessionBatchUi(activeSessions) {
    const validIds = new Set(activeSessions.map(item => item.id));
    [...sessionBatchSelected].forEach(id => {
      if (!validIds.has(id)) sessionBatchSelected.delete(id);
    });
    const bar = document.getElementById('sessionBatchActionBar');
    if (bar) bar.hidden = !sessionBatchMode;
    document.getElementById('btnToggleSessionBatchEdit')?.classList.toggle('is-active', sessionBatchMode);
    const count = document.getElementById('sessionBatchSelectedCount');
    if (count) count.textContent = `已选 ${sessionBatchSelected.size} 项`;
    const deleteButton = document.getElementById('btnSessionBatchDelete');
    if (deleteButton) deleteButton.disabled = !sessionBatchSelected.size;
    const selectAllButton = document.getElementById('btnSessionBatchSelectAll');
    if (selectAllButton) selectAllButton.textContent = activeSessions.length && sessionBatchSelected.size === activeSessions.length ? '取消全选' : '全选';
  }

  function renderSidebar() {
    const list = document.getElementById('sessionHistoryList');
    const activeSessions = sessions.filter(item => !item.deletedAt);
    const pinned = activeSessions.filter(item => item.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
    const normal = activeSessions.filter(item => !item.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
    if (list) list.innerHTML = renderSessionRows([...pinned, ...normal]);
    updateSessionBatchUi(activeSessions);
    const deletedCount = sessions.filter(item => !!item.deletedAt).length;
    const count = document.getElementById('sessionTrashCount');
    if (count) count.textContent = String(deletedCount);
  }

  function getSessionMediaItems(session) {
    const tasks = Array.isArray(session?.data?.tasks) ? session.data.tasks : [];
    const byKey = new Map();
    const mediaSources = new Set();
    tasks.forEach(task => {
      if (task.status !== 'completed') return;
      if (task.mediaType === 'image') {
        const resultIds = Array.isArray(task.imageResultIds) && task.imageResultIds.length ? task.imageResultIds : (task.imageResultId ? [task.imageResultId] : []);
        const imageUrls = Array.isArray(task.imageUrls) && task.imageUrls.length ? task.imageUrls : (task.imageUrl ? [task.imageUrl] : []);
        const imageItems = [
          ...resultIds.map(imageResultId => ({ imageResultId, imageUrl: null })),
          ...imageUrls.map(imageUrl => ({ imageResultId: null, imageUrl }))
        ];
        imageItems.forEach((imageItem, index) => {
          const source = imageItem.imageResultId || imageItem.imageUrl;
          if (!source) return;
          const key = `${task.taskId || source}_image_${index + 1}`;
          mediaSources.add(source);
          byKey.set(key, {
            ...clone(task),
            ...imageItem,
            imageResultIds: undefined,
            imageUrls: undefined,
            taskId: key,
            parentTaskId: task.taskId,
            mediaType: 'image',
            sessionId: session.id,
            sessionType: session.type,
            sessionTitle: session.title,
            sessionUpdatedAt: session.updatedAt
          });
        });
        return;
      }
      if (!task.videoUrl) return;
      const source = task.videoUrl;
      const key = task.taskId || source;
      mediaSources.add(source);
      byKey.set(key, {
        ...clone(task),
        mediaType: 'video',
        sessionId: session.id,
        sessionType: session.type,
        sessionTitle: session.title,
        sessionUpdatedAt: session.updatedAt
      });
    });
    if (session?.type === 'canvas' && Array.isArray(session.data?.nodes)) {
      session.data.nodes.forEach(node => {
        const imageUrl = node.type === 'asset' && node.status === 'done' && node.assetName === 'AI 生成图片' ? node.imgUrl : '';
        const videoUrl = node.type === 'video' && node.videoUrl ? node.videoUrl : '';
        const source = imageUrl || videoUrl;
        if (!source || mediaSources.has(source)) return;
        const mediaType = imageUrl ? 'image' : 'video';
        const key = `node_${node.id}_${mediaType}`;
        mediaSources.add(source);
        byKey.set(key, {
          taskId: key,
          mediaType,
          imageUrl: imageUrl || null,
          videoUrl: videoUrl || null,
          prompt: node.title || (mediaType === 'image' ? '画布生成图片' : '画布生成视频'),
          createdAt: session.updatedAt,
          updatedAt: session.updatedAt,
          sessionId: session.id,
          sessionType: session.type,
          sessionTitle: session.title,
          sessionUpdatedAt: session.updatedAt
        });
      });
    }
    return [...byKey.values()].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }

  function getAllSessionMedia() {
    const sessionMedia = sessions
      .filter(session => !session.deletedAt)
      .flatMap(getSessionMediaItems)
    const multiAngleMedia = (state.taskHistory || [])
      .filter(task => task.source === 'multi-angle' && task.status === 'completed' && task.mediaType === 'image')
      .flatMap(task => {
        const resultIds = Array.isArray(task.imageResultIds) && task.imageResultIds.length ? task.imageResultIds : (task.imageResultId ? [task.imageResultId] : []);
        const imageUrls = Array.isArray(task.imageUrls) && task.imageUrls.length ? task.imageUrls : (task.imageUrl ? [task.imageUrl] : []);
        return [
          ...resultIds.map((imageResultId, index) => ({ imageResultId, imageUrl: null, index })),
          ...imageUrls.map((imageUrl, index) => ({ imageResultId: null, imageUrl, index: resultIds.length + index }))
        ].map(item => ({
          ...clone(task),
          ...item,
          taskId: `${task.taskId}_image_${item.index + 1}`,
          parentTaskId: task.taskId,
          sessionId: 'multi-angle-history',
          sessionType: 'multi-angle',
          sessionTitle: '多角度创作'
        }));
      });
    return [...sessionMedia, ...multiAngleMedia]
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }

  function mediaThumbHtml(item, compact = false) {
    const title = escapeText(item.prompt || (item.mediaType === 'image' ? '生成图片' : '生成视频'));
    if (item.mediaType === 'image') {
      const sourceAttribute = item.imageUrl ? ` src="${escapeText(item.imageUrl)}"` : '';
      return `<button type="button" class="creation-history-media-thumb${compact ? ' compact' : ''}" data-preview-task="${escapeText(item.taskId || item.imageResultId || '')}" data-session-id="${escapeText(item.sessionId)}" title="${title}">
        <img${sourceAttribute} ${item.imageResultId ? `data-image-result-id="${escapeText(item.imageResultId)}"` : ''} alt="${title}">
        <span class="creation-history-media-kind">图片</span>
      </button>`;
    }
    return `<button type="button" class="creation-history-media-thumb is-video${compact ? ' compact' : ''}" data-preview-task="${escapeText(item.taskId || safeMediaUrl(item.videoUrl) || '')}" data-session-id="${escapeText(item.sessionId)}" title="${title}">
      <video data-lazy-video-src="${escapeText(safeMediaUrl(item.videoUrl))}" data-lazy-video-release="auto" muted playsinline preload="none"></video>
      <span class="creation-history-play" aria-hidden="true">▶</span>
      <span class="creation-history-media-kind">视频</span>
    </button>`;
  }

  function creationHistoryLoadMoreHtml(shown, total) {
    if (shown >= total) return '';
    return `<div class="creation-history-load-more"><button type="button" class="btn btn-secondary" data-history-load-more>再显示 ${Math.min(HISTORY_MEDIA_PAGE_SIZE, total - shown)} 个</button><span>已显示 ${shown}/${total}</span></div>`;
  }

  function renderCreationHistory() {
    const content = document.getElementById('creationHistoryContent');
    if (!content) return;
    releaseManagedVideos(content, { force: true });
    unobserveManagedVideos(content);
    const media = getAllSessionMedia();
    const count = document.getElementById('creationHistoryCount');
    if (count) count.textContent = `${media.length} 个生成结果`;
    document.getElementById('btnCreationHistoryListView')?.classList.toggle('active', historyViewMode === 'list');
    document.getElementById('btnCreationHistoryGridView')?.classList.toggle('active', historyViewMode === 'grid');
    if (!media.length) {
      content.innerHTML = '<div class="creation-history-empty">暂无已完成的图片或视频</div>';
      return;
    }
    const visibleCount = Math.min(historyVisibleCount, media.length);
    if (historyViewMode === 'grid') {
      const visibleMedia = media.slice(0, visibleCount);
      content.innerHTML = `<div class="creation-history-media-grid">${visibleMedia.map(item => mediaThumbHtml(item)).join('')}</div>${creationHistoryLoadMoreHtml(visibleMedia.length, media.length)}`;
    } else {
      let remaining = visibleCount;
      const groups = sessions
        .filter(session => !session.deletedAt)
        .map(session => ({ session, media: getSessionMediaItems(session) }))
        .filter(group => group.media.length)
        .sort((a, b) => b.session.updatedAt - a.session.updatedAt);
      const multiAngleItems = getAllSessionMedia().filter(item => item.sessionType === 'multi-angle');
      if (multiAngleItems.length) {
        groups.unshift({
          session: { id: 'multi-angle-history', type: 'multi-angle', title: '多角度创作', updatedAt: multiAngleItems[0].updatedAt || multiAngleItems[0].createdAt || Date.now() },
          media: multiAngleItems
        });
      }
      const visibleGroups = groups.map(({ session, media: items }) => {
        if (remaining <= 0) return null;
        const visibleItems = items.slice(0, remaining);
        remaining -= visibleItems.length;
        return { session, media: visibleItems, total: items.length };
      }).filter(Boolean);
      const renderedCount = visibleGroups.reduce((sum, group) => sum + group.media.length, 0);
      content.innerHTML = `<div class="creation-history-session-list">${visibleGroups.map(({ session, media: items, total }) => {
        const meta = TYPE_META[session.type] || TYPE_META.creation;
        return `<article class="creation-history-session-card">
          <div class="creation-history-session-head">
            <div><span class="creation-history-session-type">${meta.icon} ${meta.label}</span><h4>${escapeText(session.title)}</h4><p>${new Date(session.updatedAt).toLocaleString('zh-CN')} · ${total} 个生成结果</p></div>
            ${session.type === 'multi-angle' ? '' : `<button type="button" class="btn btn-secondary btn-sm" data-open-history-session="${escapeText(session.id)}">当前页查看</button>`}
          </div>
          <div class="creation-history-session-media">${items.map(item => mediaThumbHtml(item, true)).join('')}</div>
        </article>`;
      }).join('')}</div>${creationHistoryLoadMoreHtml(renderedCount, media.length)}`;
    }
    void hydrateStoredImageElements(content);
    observeManagedVideos(content);
  }

  function setHistoryView(mode) {
    historyViewMode = mode === 'grid' ? 'grid' : 'list';
    historyVisibleCount = HISTORY_MEDIA_PAGE_SIZE;
    localStorage.setItem('vkb_creation_history_view', historyViewMode);
    renderCreationHistory();
  }

  async function openCreationHistory() {
    if (activeSession) await saveNow();
    historyVisibleCount = HISTORY_MEDIA_PAGE_SIZE;
    switchView('creationHistory');
    renderCreationHistory();
  }

  async function openMediaPreview(item) {
    if (!item) return;
    previewMediaItem = item;
    const modal = document.getElementById('creationMediaPreviewModal');
    const body = document.getElementById('creationMediaPreviewBody');
    const title = document.getElementById('creationMediaPreviewTitle');
    const meta = document.getElementById('creationMediaPreviewMeta');
    const openButton = document.getElementById('btnOpenCreationMediaSession');
    if (!modal || !body) return;
    if (title) title.textContent = item.prompt || (item.mediaType === 'image' ? '生成图片' : '生成视频');
    if (meta) meta.textContent = `${TYPE_META[item.sessionType]?.label || '创作'} · ${item.sessionTitle} · ${new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleString('zh-CN')}`;
    if (openButton) openButton.textContent = item.sessionType === 'multi-angle' ? '返回多角度创作' : '打开所属会话';
    if (item.mediaType === 'image') {
      const source = item.imageResultId ? await loadImageResultData(item.imageResultId) : item.imageUrl;
      body.innerHTML = source ? `<img src="${escapeText(source)}" alt="生成图片预览">` : '<div class="creation-history-empty">图片已不可用</div>';
    } else {
      const source = safeMediaUrl(item.videoUrl);
      body.replaceChildren();
      if (source) {
        const video = document.createElement('video');
        video.src = source;
        video.controls = true;
        video.autoplay = true;
        body.appendChild(video);
      } else {
        body.textContent = '视频地址无效或使用了不安全协议';
      }
    }
    modal.classList.remove('hidden');
  }

  function closeMediaPreview() {
    const modal = document.getElementById('creationMediaPreviewModal');
    modal?.classList.add('hidden');
    const body = document.getElementById('creationMediaPreviewBody');
    releaseManagedVideos(body, { force: true });
    body?.replaceChildren();
    previewMediaItem = null;
  }

  async function downloadPreviewMedia() {
    if (!previewMediaItem) return;
    if (previewMediaItem.mediaType === 'image') {
      const source = previewMediaItem.imageResultId ? await loadImageResultData(previewMediaItem.imageResultId) : previewMediaItem.imageUrl;
      if (source) await downloadGeneratedImage(source, previewMediaItem);
      return;
    }
    const source = safeMediaUrl(previewMediaItem.videoUrl);
    if (!source) return showToast('视频地址无效或使用了不安全协议', 'error');
    const link = document.createElement('a');
    link.href = source;
    link.download = `video_${String(previewMediaItem.taskId || Date.now()).slice(0, 12)}.mp4`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function closeContextMenu() {
    contextMenu?.remove();
    contextMenu = null;
  }

  function openContextMenu(id, anchor) {
    closeContextMenu();
    const session = sessions.find(item => item.id === id);
    if (!session) return;
    contextMenu = document.createElement('div');
    contextMenu.className = 'session-context-menu';
    contextMenu.innerHTML = `
      <button type="button" data-action="rename">修改</button>
      <button type="button" data-action="pin">${session.pinned ? '取消置顶' : '置顶'}</button>
      <button type="button" data-action="delete" class="danger">删除</button>`;
    document.body.appendChild(contextMenu);
    const rect = anchor.getBoundingClientRect();
    contextMenu.style.left = `${Math.min(rect.right - 126, window.innerWidth - 136)}px`;
    contextMenu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - contextMenu.offsetHeight - 8)}px`;
    contextMenu.addEventListener('click', async event => {
      const action = event.target.closest('button')?.dataset.action;
      if (action === 'rename') await renameSession(id);
      else if (action === 'pin') await togglePin(id);
      else if (action === 'delete') await moveToTrash(id);
      closeContextMenu();
    });
  }

  async function renameSession(id) {
    const session = sessions.find(item => item.id === id);
    if (!session) return;
    const title = window.prompt('修改会话标题', session.title);
    if (title === null) return;
    const normalized = title.trim();
    if (!normalized) return;
    session.title = normalized;
    session.updatedAt = Date.now();
    await putSession(session);
    renderSidebar();
  }

  async function togglePin(id) {
    const session = sessions.find(item => item.id === id);
    if (!session) return;
    session.pinned = !session.pinned;
    session.updatedAt = Date.now();
    await putSession(session);
    renderSidebar();
  }

  function cancelTask(taskId, reason = '已取消') {
    canceledTaskIds.add(taskId);
    const task = state.activeTasks.find(item => item.taskId === taskId)
      || state.taskHistory.find(item => item.taskId === taskId);
    const backendTaskId = task?.backendTaskId || ((!String(taskId).startsWith('image_') && !String(taskId).startsWith('fail_')) ? taskId : null);
    if (backendTaskId) {
      void BackendClient.cancelGeneration(backendTaskId, reason).catch(error => {
        if (error.status !== 404 && error.status !== 409) console.warn('Backend task cancellation failed:', error);
      });
    }
    const imageTimer = imageReconcileTimers.get(taskId);
    if (imageTimer) window.clearTimeout(imageTimer);
    imageReconcileTimers.delete(taskId);
    const handles = pollers.get(taskId) || [];
    handles.forEach(handle => window.clearInterval(handle));
    pollers.delete(taskId);
    if (task) {
      task.status = 'canceled';
      task.progress = 100;
      task.errorMsg = reason;
      saveTaskToHistory(task);
      void handleTaskFinished(task, 'canceled').catch(error => console.warn('Canceled task session save failed:', error));
    }
    state.activeTasks = state.activeTasks.filter(item => item.taskId !== taskId);
    const card = document.getElementById(`task-card-${taskId}`);
    const badge = card?.querySelector('.task-status-badge');
    const target = card?.querySelector(`[id$="target-${CSS.escape(taskId)}"]`);
    if (badge) {
      badge.className = 'task-status-badge canceled';
      badge.textContent = '已取消';
    }
    if (target) target.innerHTML = '<div class="session-task-resume">任务已在本地停止，后续结果不会写回。</div>';
    const canvasNode = canvasState.nodes?.find(item => item.taskId === taskId);
    if (canvasNode) {
      canvasNode.status = 'canceled';
      canvasNode.progress = 100;
      canvasNode.errorMsg = reason;
      saveCanvasState();
      renderCanvasNodesAndLines();
    }
    updateTaskQueueUI();
    updateStatusIndicators();
    syncCreationSubmitButtonState();
    scheduleSave();
  }

  function cancelSessionTasks(sessionId) {
    (state.activeTasks || []).filter(task => task.sessionId === sessionId).forEach(task => cancelTask(task.taskId, '会话已删除，任务已取消'));
    const pendingControllers = pendingSessionRequests.get(sessionId) || new Set();
    pendingControllers.forEach(controller => controller.abort());
    pendingSessionRequests.delete(sessionId);
    if (typeof cancelLongScriptRun === 'function') cancelLongScriptRun(sessionId, '会话已删除，AI 请求已取消');
  }

  function registerPendingRequest(sessionId, controller) {
    if (!sessionId || !controller) return;
    const controllers = pendingSessionRequests.get(sessionId) || new Set();
    controllers.add(controller);
    pendingSessionRequests.set(sessionId, controllers);
  }

  function unregisterPendingRequest(sessionId, controller) {
    const controllers = pendingSessionRequests.get(sessionId);
    if (!controllers) return;
    controllers.delete(controller);
    if (!controllers.size) pendingSessionRequests.delete(sessionId);
  }

  async function moveToTrash(id) {
    const session = sessions.find(item => item.id === id);
    if (!session) return;
    if (activeSession?.id === id) await saveNow();
    cancelSessionTasks(id);
    session.deletedAt = Date.now();
    session.updatedAt = session.deletedAt;
    await putSession(session);
    if (activeSession?.id === id) {
      activeSession = null;
      const next = sessions.filter(item => !item.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (next) await openSession(next.id);
      else await createNew('creation', { force: true });
    }
    renderSidebar();
  }

  function setSessionBatchMode(enabled) {
    sessionBatchMode = !!enabled;
    if (!sessionBatchMode) sessionBatchSelected.clear();
    closeContextMenu();
    renderSidebar();
  }

  function toggleSessionBatchSelection(id, checked) {
    const session = sessions.find(item => item.id === id && !item.deletedAt);
    if (!session) return;
    if (checked) sessionBatchSelected.add(id);
    else sessionBatchSelected.delete(id);
    renderSidebar();
  }

  function toggleSelectAllSessions() {
    const activeIds = sessions.filter(item => !item.deletedAt).map(item => item.id);
    if (activeIds.length && activeIds.every(id => sessionBatchSelected.has(id))) sessionBatchSelected.clear();
    else activeIds.forEach(id => sessionBatchSelected.add(id));
    renderSidebar();
  }

  async function batchMoveSessionsToTrash() {
    const selected = sessions.filter(item => !item.deletedAt && sessionBatchSelected.has(item.id));
    if (!selected.length) return;
    const selectedIds = new Set(selected.map(item => item.id));
    if (activeSession && selectedIds.has(activeSession.id)) await saveNow();
    const deletedAt = Date.now();
    for (const session of selected) {
      cancelSessionTasks(session.id);
      session.deletedAt = deletedAt;
      session.updatedAt = deletedAt;
      await putSession(session);
    }
    const activeWasDeleted = !!(activeSession && selectedIds.has(activeSession.id));
    sessionBatchMode = false;
    sessionBatchSelected.clear();
    if (activeWasDeleted) {
      activeSession = null;
      const next = sessions.filter(item => !item.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (next) await openSession(next.id);
      else await createNew('creation', { force: true });
    }
    renderSidebar();
    showToast(`已将 ${selected.length} 个会话移入回收站`);
  }

  async function restoreFromTrash(id) {
    const session = sessions.find(item => item.id === id);
    if (!session) return;
    session.deletedAt = null;
    session.updatedAt = Date.now();
    await putSession(session);
    trashBatchSelected.delete(id);
    trashBatchDeleteArmed = false;
    renderTrash();
    renderSidebar();
  }

  async function permanentlyDelete(id) {
    const session = sessions.find(item => item.id === id && item.deletedAt);
    if (!session) return;
    if (!permanentDeleteArmed.has(id)) {
      permanentDeleteArmed.add(id);
      renderTrash();
      return;
    }
    permanentDeleteArmed.delete(id);
    const candidateImageResultIds = [...collectImageResultIds(session)];
    await removeSession(id);
    state.activeTasks = (state.activeTasks || []).filter(task => task.sessionId !== id);
    state.taskHistory = (state.taskHistory || []).filter(task => task.sessionId !== id);
    localStorage.setItem('api_task_history', JSON.stringify(state.taskHistory));
    try {
      await cleanupUnreferencedImageResultIds(candidateImageResultIds, { sessions: clone(sessions) });
    } catch (error) {
      console.warn('Deleted session image cleanup deferred:', error);
    }
    renderTrash();
    renderSidebar();
  }

  function setTrashBatchMode(enabled) {
    trashBatchMode = !!enabled;
    trashBatchDeleteArmed = false;
    if (!trashBatchMode) trashBatchSelected.clear();
    renderTrash();
  }

  function toggleTrashBatchSelection(id, checked) {
    const session = sessions.find(item => item.id === id && item.deletedAt);
    if (!session) return;
    if (checked) trashBatchSelected.add(id);
    else trashBatchSelected.delete(id);
    trashBatchDeleteArmed = false;
    renderTrash();
  }

  function toggleSelectAllTrashSessions() {
    const deletedIds = sessions.filter(item => !!item.deletedAt).map(item => item.id);
    if (deletedIds.length && deletedIds.every(id => trashBatchSelected.has(id))) trashBatchSelected.clear();
    else deletedIds.forEach(id => trashBatchSelected.add(id));
    trashBatchDeleteArmed = false;
    renderTrash();
  }

  async function batchPermanentlyDeleteTrash() {
    const selected = sessions.filter(item => item.deletedAt && trashBatchSelected.has(item.id));
    if (!selected.length) return;
    if (!trashBatchDeleteArmed) {
      trashBatchDeleteArmed = true;
      renderTrash();
      return;
    }
    const selectedIds = new Set(selected.map(item => item.id));
    const candidateImageResultIds = [...new Set(selected.flatMap(session => [...collectImageResultIds(session)]))];
    for (const session of selected) await removeSession(session.id);
    state.activeTasks = (state.activeTasks || []).filter(task => !selectedIds.has(task.sessionId));
    state.taskHistory = (state.taskHistory || []).filter(task => !selectedIds.has(task.sessionId));
    localStorage.setItem('api_task_history', JSON.stringify(state.taskHistory));
    try {
      await cleanupUnreferencedImageResultIds(candidateImageResultIds, { sessions: clone(sessions) });
    } catch (error) {
      console.warn('Batch deleted session image cleanup deferred:', error);
    }
    trashBatchMode = false;
    trashBatchDeleteArmed = false;
    trashBatchSelected.clear();
    renderTrash();
    renderSidebar();
    showToast(`已永久删除 ${selected.length} 个会话`);
  }

  function updateTrashBatchUi(deletedSessions) {
    const validIds = new Set(deletedSessions.map(item => item.id));
    [...trashBatchSelected].forEach(id => {
      if (!validIds.has(id)) trashBatchSelected.delete(id);
    });
    const bar = document.getElementById('sessionTrashBatchActionBar');
    if (bar) bar.hidden = !trashBatchMode;
    document.getElementById('btnToggleTrashBatchEdit')?.classList.toggle('is-active', trashBatchMode);
    const count = document.getElementById('sessionTrashBatchSelectedCount');
    if (count) count.textContent = `已选 ${trashBatchSelected.size} 项`;
    const deleteButton = document.getElementById('btnTrashBatchDelete');
    if (deleteButton) {
      deleteButton.disabled = !trashBatchSelected.size;
      deleteButton.textContent = trashBatchDeleteArmed ? `确认永久删除 ${trashBatchSelected.size} 项` : '永久删除';
    }
    const selectAllButton = document.getElementById('btnTrashBatchSelectAll');
    if (selectAllButton) selectAllButton.textContent = deletedSessions.length && trashBatchSelected.size === deletedSessions.length ? '取消全选' : '全选';
  }

  function renderTrash() {
    const list = document.getElementById('sessionTrashList');
    if (!list) return;
    const deleted = sessions.filter(item => !!item.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt);
    updateTrashBatchUi(deleted);
    if (!deleted.length) {
      list.innerHTML = '<div class="ls-asset-picker-empty">回收站为空</div>';
      return;
    }
    list.innerHTML = deleted.map(session => {
      const meta = TYPE_META[session.type] || TYPE_META.creation;
      const armed = permanentDeleteArmed.has(session.id);
      const checked = trashBatchSelected.has(session.id);
      return `<div class="session-trash-row${trashBatchMode ? ' batch-mode' : ''}" data-session-id="${session.id}">
        ${trashBatchMode ? `<label class="session-batch-check" title="选择会话"><input type="checkbox" data-trash-select="${session.id}" ${checked ? 'checked' : ''} aria-label="选择 ${escapeText(session.title)}"></label>` : ''}
        <div><div class="session-trash-row-title">${meta.label} · ${escapeText(session.title)}</div><div class="session-trash-row-meta">删除于 ${new Date(session.deletedAt).toLocaleString('zh-CN')}</div></div>
        ${trashBatchMode ? '' : `<div class="session-trash-actions"><button type="button" class="btn btn-secondary btn-sm" data-trash-action="restore">恢复</button><button type="button" class="btn btn-secondary btn-sm danger" data-trash-action="permanent">${armed ? '确认永久删除' : '永久删除'}</button></div>`}
      </div>`;
    }).join('');
  }

  function openTrash() {
    trashBatchMode = false;
    trashBatchSelected.clear();
    trashBatchDeleteArmed = false;
    renderTrash();
    document.getElementById('sessionTrashModal')?.classList.remove('hidden');
  }

  function closeTrash() {
    permanentDeleteArmed.clear();
    trashBatchMode = false;
    trashBatchSelected.clear();
    trashBatchDeleteArmed = false;
    document.getElementById('sessionTrashModal')?.classList.add('hidden');
  }

  function registerPoller(taskId, handle) {
    if (!taskId || !handle) return;
    const handles = pollers.get(taskId) || [];
    handles.push(handle);
    pollers.set(taskId, handles);
  }

  function unregisterPoller(taskId, handle) {
    if (!pollers.has(taskId)) return;
    const handles = pollers.get(taskId).filter(item => item !== handle);
    if (handles.length) pollers.set(taskId, handles);
    else pollers.delete(taskId);
  }

  function hasPoller(taskId) {
    return !!(taskId && pollers.get(taskId)?.length);
  }

  function isTaskCanceled(taskId) {
    return canceledTaskIds.has(taskId);
  }

  function assignTask(task, fallbackType) {
    if (!task) return task;
    if (!Object.prototype.hasOwnProperty.call(task, 'sessionId')) task.sessionId = activeSession?.id || null;
    if (!Object.prototype.hasOwnProperty.call(task, 'sessionType')) task.sessionType = activeSession?.type || fallbackType || 'creation';
    return task;
  }

  async function trackTask(task) {
    if (!task?.sessionId) return;
    await updateSessionData(task.sessionId, data => {
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      const index = tasks.findIndex(item => item.taskId === task.taskId);
      if (index >= 0) tasks[index] = clone(task);
      else tasks.push(clone(task));
      data.tasks = tasks;
      return data;
    });
  }

  async function handleTaskFinished(task, status) {
    if (!task?.sessionId) return;
    const session = sessions.find(item => item.id === task.sessionId);
    if (!session || session.deletedAt) return;
    task.unseen = activeSession?.id !== session.id;
    const updatedSession = await updateSessionData(task.sessionId, data => {
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      const index = tasks.findIndex(item => item.taskId === task.taskId);
      if (index >= 0) tasks[index] = clone(task);
      else tasks.push(clone(task));
      data.tasks = tasks;
      if (session.type === 'canvas' && task.canvasNodeId && Array.isArray(data.nodes)) {
        const node = data.nodes.find(item => item.id === task.canvasNodeId);
        if (node) {
          node.taskId = task.taskId;
          node.progress = task.progress;
          node.status = status === 'completed' ? 'done' : status;
          if (task.videoUrl) {
            node.videoUrl = task.videoUrl;
            node.mediaAutoSizePending = true;
          }
          if (status === 'completed') {
            node.errorMsg = '';
            node.statusMessage = '';
            node.recoveryState = 'normal';
          } else if (task.errorMsg) {
            node.errorMsg = task.errorMsg;
          }
        }
      }
      return data;
    });
    if (task.unseen && updatedSession) {
      const statusText = status === 'completed' ? '已完成' : (status === 'canceled' ? '已取消' : '失败');
      showToast(`${TYPE_META[session.type]?.label || '其他会话'}任务${statusText}：${session.title}`, status === 'failed' ? 'error' : 'success', {
        actionLabel: '查看',
        onAction: () => openSession(session.id)
      });
    }
  }

  async function markSessionViewed(id) {
    const session = sessions.find(item => item.id === id);
    if (!session || !Array.isArray(session.data?.tasks)) return;
    let changed = false;
    session.data.tasks.forEach(task => {
      if (task.unseen) {
        task.unseen = false;
        changed = true;
      }
    });
    if (!changed) return;
    session.taskSummary = summarizeTasks(session.data.tasks);
    await putSession(session);
    renderSidebar();
  }

  function rehydrateCreationDom() {
    if (!el.aiChatStream) return;
    const sessionVideoTasks = activeSession?.type === 'creation' && Array.isArray(activeSession.data?.tasks)
      ? activeSession.data.tasks.filter(task => task?.taskId && (task.mediaType === 'video' || task.operation === 'video'))
      : [];
    sessionVideoTasks.forEach(savedTask => {
      if (document.getElementById(`task-card-${savedTask.taskId}`)) return;
      const task = state.activeTasks.find(item => item.taskId === savedTask.taskId)
        || state.taskHistory.find(item => item.taskId === savedTask.taskId)
        || savedTask;
      const aiBox = appendAiAssistantBubble(task.status === 'completed' ? '视频生成完成' : '视频生成任务');
      createChatGenCard(
        aiBox,
        task.taskId,
        task.prompt || '',
        task.model || DEFAULT_VIDEO_MODEL,
        task.options?.aspectRatio || '16:9',
        task.duration || 5,
        task.status || 'in_progress',
        task.progress || 0,
        task
      );
      pendingCreationDomMigrationSave = true;
    });
    el.aiChatStream.querySelectorAll('.task-item-card, .chat-image-generation-card').forEach(card => {
      const taskId = card.id?.replace(/^task-card-/, '');
      if (!taskId) return;
      const task = state.activeTasks.find(item => item.taskId === taskId) || state.taskHistory.find(item => item.taskId === taskId);
      if (!task) return;
      const target = card.querySelector(`[id$="target-${CSS.escape(taskId)}"]`);
      if (!target) return;
      if (task.mediaType === 'image') {
        if (task.status === 'completed' && (task.imageResultIds?.length || task.imageUrls?.length || task.imageResultId || task.imageUrl)) {
          void (async () => {
            const sources = await loadTaskImageSources(task);
            if (sources.length) await renderChatImageCardResult(card, task, sources);
            else await reconcileChatImageTask(task, card);
          })().catch(error => console.warn('Image task DOM restore failed:', error));
        } else if (['queued', 'in_progress', 'running', 'paused', 'reconciling', 'needs_review', 'completed'].includes(task.status)) {
          renderChatImageBatchProgress(task, card);
          void reconcileChatImageTask(task, card).catch(error => console.warn('Image task backend reconcile failed:', error));
        }
        return;
      }
      const needsCardUpgrade = !card.querySelector('[data-video-progress-track]')
        || !!card.querySelector('.task-status-badge')
        || !!target.querySelector('[data-resume-task]');
      upgradeChatVideoTaskCard(card, task);
      if (needsCardUpgrade) pendingCreationDomMigrationSave = true;
      if (['queued', 'in_progress', 'running', 'rendering', 'paused', 'reconciling', 'needs_review'].includes(task.status)) {
        task.status = 'in_progress';
        if (target.querySelector('[data-resume-task]') || /页面刷新后任务查询已暂停/.test(target.textContent || '')) target.replaceChildren();
        if (!hasPoller(taskId)) {
          window.queueMicrotask(() => {
            if (!hasPoller(taskId) && !isTaskCanceled(taskId)) {
              startChatCardPoller(taskId, card, task.prompt || '', task.model || state.apiConfig.model);
            }
          });
        }
        void trackTask(task).catch(error => console.warn('Creation video task auto-resume save failed:', error));
        return;
      }
      if (task.status === 'completed' && task.videoUrl) {
        target.innerHTML = renderCompletedChatVideoTarget(task);
      }
    });
    observeManagedVideos(el.aiChatStream);
  }

  function resumeTask(taskId) {
    const task = state.activeTasks.find(item => item.taskId === taskId);
    if (!task) return;
    if (task.mediaType === 'image') {
      task.status = 'in_progress';
      const card = document.getElementById(`task-card-${taskId}`);
      void reconcileChatImageTask(task, card).catch(error => {
        console.warn('Image task resume failed:', error);
        showToast(`图片任务恢复失败：${error.message}`, 'error');
      });
      void trackTask(task).catch(error => console.warn('Resumed image task session save failed:', error));
      return;
    }
    canceledTaskIds.delete(taskId);
    task.status = task.source === 'canvas' ? 'rendering' : 'queued';
    if (task.source === 'canvas') {
      resumeCanvasVideoTask(task);
    } else {
      const card = document.getElementById(`task-card-${taskId}`);
      if (card) startChatCardPoller(taskId, card, task.prompt || '', task.model || state.apiConfig.model);
    }
    void trackTask(task).catch(error => console.warn('Resumed task session save failed:', error));
    scheduleSave();
  }

  function bindUi() {
    document.getElementById('btnOpenCreationHistory')?.addEventListener('click', openCreationHistory);
    document.getElementById('btnToggleSessionBatchEdit')?.addEventListener('click', () => setSessionBatchMode(!sessionBatchMode));
    document.getElementById('btnSessionBatchSelectAll')?.addEventListener('click', toggleSelectAllSessions);
    document.getElementById('btnSessionBatchDelete')?.addEventListener('click', () => void batchMoveSessionsToTrash());
    document.getElementById('btnSessionBatchCancel')?.addEventListener('click', () => setSessionBatchMode(false));
    document.getElementById('btnCreationHistoryListView')?.addEventListener('click', () => setHistoryView('list'));
    document.getElementById('btnCreationHistoryGridView')?.addEventListener('click', () => setHistoryView('grid'));
    document.getElementById('btnOpenSessionTrash')?.addEventListener('click', openTrash);
    document.getElementById('btnToggleTrashBatchEdit')?.addEventListener('click', () => setTrashBatchMode(!trashBatchMode));
    document.getElementById('btnTrashBatchSelectAll')?.addEventListener('click', toggleSelectAllTrashSessions);
    document.getElementById('btnTrashBatchDelete')?.addEventListener('click', () => void batchPermanentlyDeleteTrash());
    document.getElementById('btnTrashBatchCancel')?.addEventListener('click', () => setTrashBatchMode(false));
    document.getElementById('btnCloseSessionTrash')?.addEventListener('click', closeTrash);
    document.getElementById('sessionTrashModal')?.addEventListener('click', event => {
      if (event.target.id === 'sessionTrashModal') closeTrash();
    });
    document.getElementById('sessionHistoryList')?.addEventListener('click', event => {
      if (sessionBatchMode) {
        const row = event.target.closest('[data-session-id]');
        if (!row) return;
        const checkbox = event.target.closest('[data-session-select]');
        const checked = checkbox ? checkbox.checked : !sessionBatchSelected.has(row.dataset.sessionId);
        toggleSessionBatchSelection(row.dataset.sessionId, checked);
        return;
      }
      const menuButton = event.target.closest('[data-session-menu]');
      if (menuButton) {
        event.stopPropagation();
        openContextMenu(menuButton.dataset.sessionMenu, menuButton);
        return;
      }
      const row = event.target.closest('[data-session-id]');
      if (row) openSession(row.dataset.sessionId);
    });
    document.getElementById('sessionTrashList')?.addEventListener('click', event => {
      if (trashBatchMode) {
        const row = event.target.closest('[data-session-id]');
        if (!row) return;
        const checkbox = event.target.closest('[data-trash-select]');
        const checked = checkbox ? checkbox.checked : !trashBatchSelected.has(row.dataset.sessionId);
        toggleTrashBatchSelection(row.dataset.sessionId, checked);
        return;
      }
      const action = event.target.closest('[data-trash-action]')?.dataset.trashAction;
      const id = event.target.closest('[data-session-id]')?.dataset.sessionId;
      if (action === 'restore') restoreFromTrash(id);
      else if (action === 'permanent') permanentlyDelete(id);
    });
    document.getElementById('creationHistoryContent')?.addEventListener('click', event => {
      if (event.target.closest('[data-history-load-more]')) {
        historyVisibleCount += HISTORY_MEDIA_PAGE_SIZE;
        renderCreationHistory();
        return;
      }
      const sessionButton = event.target.closest('[data-open-history-session]');
      if (sessionButton) {
        void openSession(sessionButton.dataset.openHistorySession);
        return;
      }
      const previewButton = event.target.closest('[data-preview-task]');
      if (!previewButton) return;
      const item = getAllSessionMedia().find(media => media.sessionId === previewButton.dataset.sessionId
        && String(media.taskId || media.imageResultId || media.videoUrl || '') === previewButton.dataset.previewTask);
      if (item) void openMediaPreview(item);
    });
    document.getElementById('btnCloseCreationMediaPreview')?.addEventListener('click', closeMediaPreview);
    document.getElementById('creationMediaPreviewModal')?.addEventListener('click', event => {
      if (event.target.id === 'creationMediaPreviewModal') closeMediaPreview();
    });
    document.getElementById('btnDownloadCreationMedia')?.addEventListener('click', () => void downloadPreviewMedia());
    document.getElementById('btnOpenCreationMediaSession')?.addEventListener('click', () => {
      if (previewMediaItem?.sessionType === 'multi-angle') {
        closeMediaPreview();
        switchView('multiAngle');
        initMultiAngleCreator();
        return;
      }
      const sessionId = previewMediaItem?.sessionId;
      closeMediaPreview();
      if (sessionId) void openSession(sessionId);
    });
    document.addEventListener('click', event => {
      if (contextMenu && !event.target.closest('.session-context-menu') && !event.target.closest('[data-session-menu]')) closeContextMenu();
      const cancelButton = event.target.closest('[data-cancel-task]');
      if (cancelButton) cancelTask(cancelButton.dataset.cancelTask);
      const resumeButton = event.target.closest('[data-resume-task]');
      if (resumeButton) resumeTask(resumeButton.dataset.resumeTask);
      const saveVideoButton = event.target.closest('[data-save-video-task]');
      if (saveVideoButton) saveCompletedVideoTaskToKnowledgeBase(saveVideoButton.dataset.saveVideoTask);
    });
    document.addEventListener('click', event => { if (event.target.closest('#viewAdmin')) handleAdminAction(event); });
    document.addEventListener('submit', event => { if (event.target.closest('#viewAdmin')) handleAdminFormSubmit(event); });
    document.addEventListener('input', event => { if (event.target.closest('.admin-model-editor-form')) handleAdminModelEditorInput(event); });
    document.addEventListener('change', event => { if (event.target.closest('.admin-model-editor-form')) handleAdminModelEditorInput(event); });
  document.addEventListener('input', event => {
      if (event.target.closest('#viewVideoGen, #viewCanvasMode, #viewLongScriptGen')) scheduleSave();
    });
    document.addEventListener('change', event => {
      if (event.target.closest('#viewVideoGen, #viewCanvasMode, #viewLongScriptGen')) scheduleSave();
    });
    window.addEventListener('beforeunload', () => { if (initialized) void saveNow(); });
    document.addEventListener('visibilitychange', () => {
      if (!initialized) return;
      if (document.visibilityState === 'hidden') {
        releaseManagedVideos(document, { force: true });
        unobserveManagedVideos(document);
        void saveNow();
      } else {
        observeManagedVideos(document);
        if (BackendClient.isAuthenticated()) void reconcileBackendGenerationTasks();
      }
    });
    window.addEventListener('pagehide', () => { if (initialized) void saveNow(); });
    if (el.aiChatStream && typeof MutationObserver === 'function') {
      mutationObserver = new MutationObserver(records => {
        records.forEach(record => record.addedNodes?.forEach(node => {
          if (node instanceof HTMLVideoElement || node instanceof HTMLElement) observeManagedVideos(node);
        }));
        const runtimeOnly = records.length > 0 && records.every(record => record.type === 'attributes'
          && record.target instanceof HTMLVideoElement
          && ['src', 'preload', 'data-managed-video-active', 'data-managed-video-interaction-bound'].includes(record.attributeName));
        if (!runtimeOnly) scheduleSave();
      });
      mutationObserver.observe(el.aiChatStream, { childList: true, subtree: true, attributes: true, characterData: true });
    }
  }

  async function init() {
    initialCreationHtml = el.aiChatStream?.innerHTML || '';
    db = await openDatabase();
    sessions = await getAllSessions();
    await migrateLegacySessions();
    sessions = await getAllSessions();
    const interruptedAt = Date.now();
    const interruptedSessions = sessions.filter(session => !session.deletedAt && session.type === 'long-script' && session.data?.longScriptRun?.status === 'running');
    for (const session of interruptedSessions) {
      const errorMessage = '上一次 AI 请求因页面刷新或关闭而中断，请重新发送。';
      session.data.history = [...(session.data.history || []), { role: 'assistant', content: errorMessage }];
      session.data.longScriptRun = { ...session.data.longScriptRun, status: 'interrupted', error: errorMessage, finishedAt: interruptedAt };
      await putSession(session);
    }
    initialized = true;
    bindUi();
    renderSidebar();
  }

  function getActive() { return activeSession; }
  function isApplying() { return applying; }
  function isInitialized() { return initialized; }
  function getTypeForView(viewName) {
    return Object.keys(TYPE_VIEW).find(type => TYPE_VIEW[type] === viewName) || null;
  }

  return {
    init,
    openInitial,
    openSession,
    openType,
    startDraft,
    createNew,
    ensureActivePersisted,
    updateSessionData,
    saveNow,
    scheduleSave,
    getActive,
    getTypeForView,
    isApplying,
    isInitialized,
    reconcileBackendGenerationTasks,
    assignTask,
    trackTask,
    handleTaskFinished,
    registerPoller,
    unregisterPoller,
    hasPoller,
    isTaskCanceled,
    cancelTask,
    cancelSessionTasks,
    registerPendingRequest,
    unregisterPendingRequest,
    renderSidebar,
    renderCreationHistory,
    getSessionsSnapshot: () => clone(sessions)
  };
})();

window.SessionSystem = SessionSystem;
window.createNewSession = (type, options) => SessionSystem.createNew(type, options);
window.openSession = id => SessionSystem.openSession(id);

document.addEventListener('DOMContentLoaded', async () => {

  document.body.classList.add('privacy-ephemeral-mode');
  await window.privacyReady;
  updateAuthUi();

  // 自动迁移已淘汰的视频模型偏好；最终可用模型仍由服务端模型配置决定。
  if (!localStorage.getItem('api_model') || ['c1', 'seedance-2.0-720p', 'seedance-2.5-per-second', 'sora-v3-933-pro'].includes(localStorage.getItem('api_model'))) {
    localStorage.setItem('api_model', DEFAULT_VIDEO_MODEL);
    localStorage.setItem('api_duration', '5');
    if (state.apiConfig) {
      state.apiConfig.model = DEFAULT_VIDEO_MODEL;
      state.apiConfig.duration = 5;
    }
  }

  
  localStorage.removeItem('api_apiKey');
  localStorage.removeItem('api_llmKey');
  localStorage.removeItem('api_imageApiKey');
  localStorage.removeItem('api_baseUrl');
  localStorage.removeItem('api_llmBaseUrl');
  localStorage.removeItem('api_imageBaseUrl');

  initElements();
  initChatPromptEditor();

  // 会话历史必须优先初始化，避免其他可选 UI 模块报错时阻断 IndexedDB 会话读取与侧栏渲染。
  try {
    await SessionSystem.init();
  } catch (error) {
    console.error('Session history initialization failed:', error);
    const saveStatus = document.getElementById('sessionSaveStatus');
    if (saveStatus) {
      saveStatus.textContent = '会话存储不可用';
      saveStatus.classList.add('error');
    }
  }

  initCustomDropdowns();
  initAppleControls();
  applyApiConfigToChatUI();
  updateLongScriptModelBadge();
  bindEvents();
  initScriptGenModule();
  initBearLoginSystem();
  await BackendClient.restore();
  updateAuthUi();
  if (!window.PRIVACY_EPHEMERAL_MODE) {
    await loadLibraryData();
    if (SessionSystem.isInitialized()) await SessionSystem.reconcileBackendGenerationTasks();
    initCreditHoverCard();
  } else {
    state.promptTemplates = [];
    state.assets = [];
    state.uploadedResources = [];
  }
  await loadServerModels();
  updateStatusIndicators(); // 零延迟秒级刷新生成历史角标

  try {
    if (SessionSystem.isInitialized()) await SessionSystem.openInitial();
  } catch (error) {
    console.error('Initial session restore failed:', error);
    if (typeof switchView === 'function') switchView('videoGen');
  }
  try {
    await loadPrompts();
  } catch (err) {
    console.error('loadPrompts error:', err);
  }
  updateStatusIndicators();
  if (!window.PRIVACY_EPHEMERAL_MODE) startTaskQueuePoller();
});

function initElements() {
  el = {
    searchInput: document.getElementById('searchInput'),
    clearSearch: document.getElementById('clearSearch'),
    
    dropdownShotSize: document.getElementById('dropdownShotSize'),
    dropdownMovement: document.getElementById('dropdownMovement'),
    dropdownAngle: document.getElementById('dropdownAngle'),
    dropdownCategory: document.getElementById('dropdownCategory'),
    btnResetFilters: document.getElementById('btnResetFilters'),
    
    formDropdownShotSize: document.getElementById('formDropdownShotSize'),
    formDropdownMovement: document.getElementById('formDropdownMovement'),
    formDropdownAngle: document.getElementById('formDropdownAngle'),
    formDropdownCategory: document.getElementById('formDropdownCategory'),
    
    sidebarCount: document.getElementById('sidebarCount'),
    tableBody: document.getElementById('tableBody'),
    emptyState: document.getElementById('emptyState'),
    itemsCountBadge: document.getElementById('itemsCountBadge'),
    
    btnNewPrompt: document.getElementById('btnNewPrompt'),
    btnEmptyAdd: document.getElementById('btnEmptyAdd'),
    btnSeedData: document.getElementById('btnSeedData'),
    btnExportData: document.getElementById('btnExportData'),
    btnImportData: document.getElementById('btnImportData'),
    importFileInput: document.getElementById('importFileInput'),
    
    // Navigation & Page Views & Submenus
    btnToggleSidebar: document.getElementById('btnToggleSidebar'),
    btnExpandSidebar: document.getElementById('btnExpandSidebar'),
    sidebar: document.querySelector('.sidebar'),

    // AI 视频生成手风琴
    navVideoGen: document.getElementById('navVideoGen'),
    menuGroupVideoGen: document.getElementById('menuGroupVideoGen'),
    navCreate: document.getElementById('navCreate'),
    navCanvasMode: document.getElementById('navCanvasMode'),
    navSubQueue: document.getElementById('navSubQueue'),
    navSubHistory: document.getElementById('navSubHistory'),
    queueSpinIcon: document.getElementById('queueSpinIcon'),
    queueDotIcon: document.getElementById('queueDotIcon'),
    subQueueCount: document.getElementById('subQueueCount'),
    subHistoryDot: document.getElementById('subHistoryDot'),
    subHistoryCount: document.getElementById('subHistoryCount'),

    // 灵感中心手风琴
    navInspirationHub: document.getElementById('navInspirationHub'),
    menuGroupInspiration: document.getElementById('menuGroupInspiration'),
    navScriptGen: document.getElementById('navScriptGen'),
    navLongScriptGen: document.getElementById('navLongScriptGen'),
    navMultiAngle: document.getElementById('navMultiAngle'),
    navShowcase: document.getElementById('navShowcase'),

    // 知识库管理手风琴
    navKbGroup: document.getElementById('navKbGroup'),
    menuGroupKb: document.getElementById('menuGroupKb'),
    navCanvasKb: document.getElementById('navCanvasKb'),
    navLensKb: document.getElementById('navLensKb'),
    navPromptKb: document.getElementById('navPromptKb'),
    navAssetKb: document.getElementById('navAssetKb'),
    navAdmin: document.getElementById('navAdmin'),
    menuGroupAdmin: document.getElementById('menuGroupAdmin'),
    navAdminOverview: document.getElementById('navAdminOverview'),
    navAdminUsers: document.getElementById('navAdminUsers'),
    navAdminModels: document.getElementById('navAdminModels'),
    navAdminProviders: document.getElementById('navAdminProviders'),
    navAdminTasks: document.getElementById('navAdminTasks'),
    navAdminLedger: document.getElementById('navAdminLedger'),
    navAdminAudit: document.getElementById('navAdminAudit'),

    viewVideoGen: document.getElementById('viewVideoGen'),
    viewTaskQueue: document.getElementById('viewTaskQueue'),
    viewHistoryLog: document.getElementById('viewHistoryLog'),
    viewCreationHistory: document.getElementById('viewCreationHistory'),
    viewLensKb: document.getElementById('viewLensKb'),
    viewScriptGen: document.getElementById('viewScriptGen'),
    viewLongScriptGen: document.getElementById('viewLongScriptGen'),
    viewMultiAngle: document.getElementById('viewMultiAngle'),
    viewPromptKb: document.getElementById('viewPromptKb'),
    viewAssetKb: document.getElementById('viewAssetKb'),
    viewShowcase: document.getElementById('viewShowcase'),
    viewAdmin: document.getElementById('viewAdmin'),
    adminViewTitle: document.getElementById('adminViewTitle'),
    adminViewSubtitle: document.getElementById('adminViewSubtitle'),
    adminViewBody: document.getElementById('adminViewBody'),
    btnAdminRefresh: document.getElementById('btnAdminRefresh'),
    promptKbFilterTabs: document.getElementById('promptKbFilterTabs'),
    promptKbGridContainer: document.getElementById('promptKbGridContainer'),
    assetCategoryTabs: document.getElementById('assetCategoryTabs'),
    
    // Asset Library Modals & Form
    btnNewAsset: document.getElementById('btnNewAsset'),
    assetModal: document.getElementById('assetModal'),
    assetModalTitle: document.getElementById('assetModalTitle'),
    btnCloseAssetModal: document.getElementById('btnCloseAssetModal'),
    btnCancelAssetForm: document.getElementById('btnCancelAssetForm'),
    assetForm: document.getElementById('assetForm'),
    assetFormId: document.getElementById('assetFormId'),
    assetFormName: document.getElementById('assetFormName'),
    assetFormDesc: document.getElementById('assetFormDesc'),
    assetFormImgUrl: document.getElementById('assetFormImgUrl'),
    assetFormImgInput: document.getElementById('assetFormImgInput'),
    assetFormImgPreview: document.getElementById('assetFormImgPreview'),
    btnUploadAssetImg: document.getElementById('btnUploadAssetImg'),
    assetFormCategorySeg: document.getElementById('assetFormCategorySeg'),
    assetFormCategory: document.getElementById('assetFormCategory'),
    assetGridContainer: document.getElementById('assetGridContainer'),
    uploadedResourceContainer: document.getElementById('uploadedResourceContainer'),
    bindResourceModal: document.getElementById('bindResourceModal'),
    btnCloseBindModal: document.getElementById('btnCloseBindModal'),
    btnCancelBindModal: document.getElementById('btnCancelBindModal'),
    bindResourceForm: document.getElementById('bindResourceForm'),
    bindResourceId: document.getElementById('bindResourceId'),
    bindResourcePreviewImg: document.getElementById('bindResourcePreviewImg'),
    bindAssetName: document.getElementById('bindAssetName'),
    bindAssetDesc: document.getElementById('bindAssetDesc'),
    bindCategorySeg: document.getElementById('bindCategorySeg'),
    bindCategoryInput: document.getElementById('bindCategoryInput'),
    scriptInputText: document.getElementById('scriptInputText'),
    scriptTypeSelect: document.getElementById('scriptTypeSelect'),
    scriptToneSelect: document.getElementById('scriptToneSelect'),
    btnGenerateScript: document.getElementById('btnGenerateScript'),
    scriptGenBtnIcon: document.getElementById('scriptGenBtnIcon'),
    scriptGenBtnText: document.getElementById('scriptGenBtnText'),
    btnResetScriptForm: document.getElementById('btnResetScriptForm'),
    scriptPresetChips: document.getElementById('scriptPresetChips'),
    scriptTitleInput: document.getElementById('scriptTitleInput'),
    btnCopyScriptText: document.getElementById('btnCopyScriptText'),
    btnApplyScriptToVideo: document.getElementById('btnApplyScriptToVideo'),
    scriptShotsContainer: document.getElementById('scriptShotsContainer'),
    taskQueuePageCount: document.getElementById('taskQueuePageCount'),
    topbarTitle: document.getElementById('topbarTitle'),
    topbarSub: document.getElementById('topbarSub'),
    searchContainer: document.getElementById('searchContainer'),
    kbActionGroup: document.getElementById('kbActionGroup'),

    // Xiaoyunque AI Chat Engine & Multi-Image Reference
    aiChatStream: document.getElementById('aiChatStream'),
    aiChatForm: document.getElementById('aiChatForm'),
    aiChatTextarea: document.getElementById('aiChatTextarea'),
    btnSubmitAiChat: document.getElementById('btnSubmitAiChat'),
    chatGenerationMode: document.getElementById('chatGenerationMode'),
    chatGenerationModeSegment: document.getElementById('chatGenerationModeSegment'),
    chatModelSelect: document.getElementById('chatModelSelect'),
    chatAspectSelect: document.getElementById('chatAspectSelect'),
    chatImageAspectSelect: document.getElementById('chatImageAspectSelect'),
    chatImageCountInput: document.getElementById('chatImageCountInput'),
    chatImageCountGroup: document.getElementById('chatImageCountGroup'),
    btnChatImageCountDown: document.getElementById('btnChatImageCountDown'),
    btnChatImageCountUp: document.getElementById('btnChatImageCountUp'),
    chatDurationSelect: document.getElementById('chatDurationSelect'),
    chatCustomDurationInput: document.getElementById('chatCustomDurationInput'),
    chatCustomDurationRange: document.getElementById('chatCustomDurationRange'),
    chatVideoModelGroup: document.getElementById('chatVideoModelGroup'),
    chatImageModelGroup: document.getElementById('chatImageModelGroup'),
    chatImageModelDisplay: document.getElementById('chatImageModelDisplay'),
    chatVideoAspectGroup: document.getElementById('chatVideoAspectGroup'),
    chatImageAspectGroup: document.getElementById('chatImageAspectGroup'),
    chatDurationGroup: document.getElementById('chatDurationGroup'),
    chatDurationSegment: document.getElementById('chatDurationSegment'),
    chatImageAspectSegment: document.getElementById('chatImageAspectSegment'),
    creationPricePreview: document.getElementById('creationPricePreview'),
    chatUploadMediaLabel: document.getElementById('chatUploadMediaLabel'),
    chatSubmitButtonLabel: document.getElementById('chatSubmitButtonLabel'),
    chatDragOverlayTitle: document.getElementById('chatDragOverlayTitle'),
    chatDragOverlayHint: document.getElementById('chatDragOverlayHint'),
    btnUploadChatMedia: document.getElementById('btnUploadChatMedia'),
    chatMediaInput: document.getElementById('chatMediaInput'),
    aiRefMediaBox: document.getElementById('aiRefMediaBox'),
    aiRefMediaList: document.getElementById('aiRefMediaList'),
    btnClearAllChatMedia: document.getElementById('btnClearAllChatMedia'),
    atMenuPopover: document.getElementById('atMenuPopover'),
    atMenuList: document.getElementById('atMenuList'),
    navCanvasMode: document.getElementById('navCanvasMode'),
    viewCanvasMode: document.getElementById('viewCanvasMode'),
    navCanvasKb: document.getElementById('navCanvasKb'),
    viewCanvasKb: document.getElementById('viewCanvasKb'),
    canvasKbCount: document.getElementById('canvasKbCount'),
    btnNewCanvasProject: document.getElementById('btnNewCanvasProject'),
    btnImportCanvasKbJson: document.getElementById('btnImportCanvasKbJson'),
    canvasKbFileInput: document.getElementById('canvasKbFileInput'),
    canvasGridContainer: document.getElementById('canvasGridContainer'),
    btnCanvasAddTextNode: document.getElementById('btnCanvasAddTextNode'),
    btnCanvasAddAssetNode: document.getElementById('btnCanvasAddAssetNode'),
    btnCanvasAddVideoNode: document.getElementById('btnCanvasAddVideoNode'),
    btnCanvasAddAudioNode: document.getElementById('btnCanvasAddAudioNode'),
    btnCanvasToggleDrawer: document.getElementById('btnCanvasToggleDrawer'),
    btnCanvasLoadPreset: document.getElementById('btnCanvasLoadPreset'),
    btnCanvasClear: document.getElementById('btnCanvasClear'),
    btnCanvasSave: document.getElementById('btnCanvasSave'),
    canvasWorkspace: document.getElementById('canvasWorkspace'),
    canvasSvgLayer: document.getElementById('canvasSvgLayer'),
    canvasNodesContainer: document.getElementById('canvasNodesContainer'),
    canvasDrawer: document.getElementById('canvasDrawer'),
    btnCloseCanvasDrawer: document.getElementById('btnCloseCanvasDrawer'),
    canvasDrawerTabs: document.getElementById('canvasDrawerTabs'),
    canvasDrawerContent: document.getElementById('canvasDrawerContent'),

    // Task Queue
    btnTaskQueue: document.getElementById('btnTaskQueue'),
    taskQueueCount: document.getElementById('taskQueueCount'),
    
    // Generation History Log
    btnHistoryLog: document.getElementById('btnHistoryLog'),
    historyCount: document.getElementById('historyCount'),
    historyListContainer: document.getElementById('historyListContainer'),
    historyFilterTabs: document.getElementById('historyFilterTabs'),
    
    apiConfigModal: document.getElementById('apiConfigModal'),
    btnCloseApiModal: document.getElementById('btnCloseApiModal'),
    cfgApiBaseUrl: document.getElementById('cfgApiBaseUrl'),
    cfgApiKey: document.getElementById('cfgApiKey'),
    cfgDefaultModel: document.getElementById('cfgDefaultModel'),
    cfgDefaultDuration: document.getElementById('cfgDefaultDuration'),
    cfgLlmBaseUrl: document.getElementById('cfgLlmBaseUrl'),
    cfgLlmApiKey: document.getElementById('cfgLlmApiKey'),
    cfgLlmModelName: document.getElementById('cfgLlmModelName'),
    cfgImageBaseUrl: document.getElementById('cfgImageBaseUrl'),
    cfgImageApiKey: document.getElementById('cfgImageApiKey'),
    cfgImageModel: document.getElementById('cfgImageModel'),
    cfgImage2BaseUrl: document.getElementById('cfgImage2BaseUrl'),
    cfgImage2ApiKey: document.getElementById('cfgImage2ApiKey'),
    cfgImage2Models: document.getElementById('cfgImage2Models'),
    cfgNanoImageBaseUrl: document.getElementById('cfgNanoImageBaseUrl'),
    cfgNanoImageApiKey: document.getElementById('cfgNanoImageApiKey'),
    cfgNanoImageModels: document.getElementById('cfgNanoImageModels'),
    btnSaveApiConfig: document.getElementById('btnSaveApiConfig'),
    btnClearStoredApiConfig: document.getElementById('btnClearStoredApiConfig'),
    apiTestResult: document.getElementById('apiTestResult'),
    
    taskListContainer: document.getElementById('taskListContainer'),
    
    btnGenerateDetail: document.getElementById('btnGenerateDetail'),
    btnGenerateInForm: document.getElementById('btnGenerateInForm'),
    
    // Modal Form
    promptModal: document.getElementById('promptModal'),
    modalTitle: document.getElementById('modalTitle'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    btnCancelForm: document.getElementById('btnCancelForm'),
    promptForm: document.getElementById('promptForm'),
    editItemId: document.getElementById('editItemId'),
    
    dropZone: document.getElementById('dropZone'),
    dropZoneContent: document.getElementById('dropZoneContent'),
    videoFileInput: document.getElementById('videoFileInput'),
    videoPreviewContainer: document.getElementById('videoPreviewContainer'),
    formVideoPreview: document.getElementById('formVideoPreview'),
    btnRemoveVideo: document.getElementById('btnRemoveVideo'),
    videoUrlInput: document.getElementById('videoUrlInput'),
    
    inputTitle: document.getElementById('inputTitle'),
    inputPrompt: document.getElementById('inputPrompt'),
    inputMotion: document.getElementById('inputMotion'),
    inputLighting: document.getElementById('inputLighting'),
    
    // Modal Detail Lightbox
    detailModal: document.getElementById('detailModal'),
    btnCloseDetail: document.getElementById('btnCloseDetail'),
    detailHeading: document.getElementById('detailHeading'),
    detailPills: document.getElementById('detailPills'),
    detailVideoPlayer: document.getElementById('detailVideoPlayer'),
    detailPromptText: document.getElementById('detailPromptText'),
    btnCopyPromptDetail: document.getElementById('btnCopyPromptDetail'),
    
    detailShotSizeVal: document.getElementById('detailShotSizeVal'),
    detailMovementVal: document.getElementById('detailMovementVal'),
    detailAngleVal: document.getElementById('detailAngleVal'),
    detailCategoryVal: document.getElementById('detailCategoryVal'),
    
    btnEditDetail: document.getElementById('btnEditDetail'),
    btnDeleteDetail: document.getElementById('btnDeleteDetail'),
    
    toastContainer: document.getElementById('toastContainer')
  };
}

// --- 4. Custom Dropdown 组件交互 ---
function initCustomDropdowns() {
  const dropdowns = document.querySelectorAll('.custom-dropdown');

  dropdowns.forEach(dropdown => {
    const trigger = dropdown.querySelector('.dropdown-trigger');
    const items = dropdown.querySelectorAll('.dropdown-item');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdowns.forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
      });
      dropdown.classList.toggle('open');
    });

    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = item.dataset.value;
        const text = item.textContent.trim();

        dropdown.dataset.value = value;
        dropdown.querySelector('.dropdown-label').textContent = text;

        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        dropdown.classList.remove('open');
        onDropdownChange(dropdown.id, value);
      });
    });
  });

  document.addEventListener('click', () => {
    dropdowns.forEach(d => d.classList.remove('open'));
  });
}

function onDropdownChange(dropdownId, val) {
  if (dropdownId === 'dropdownShotSize') {
    state.filterShotSize = val;
    renderTable();
  } else if (dropdownId === 'dropdownMovement') {
    state.filterMovement = val;
    renderTable();
  } else if (dropdownId === 'dropdownAngle') {
    state.filterAngle = val;
    renderTable();
  } else if (dropdownId === 'dropdownCategory') {
    state.filterCategory = val;
    renderTable();
  }
}

const CHAT_IMAGE_SIZE_BY_ASPECT = Object.freeze({
  '16:9': '1280x720',
  '9:16': '720x1280',
  '1:1': '1024x1024',
  '4:3': '1024x768'
});

function clampVideoDuration(value, min = 4, max = 30, fallback = 5) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function syncChatDurationControl(model, requestedDuration) {
  const isCustomDurationModel = isCustomDurationVideoModel(model);
  const durationSegment = document.getElementById('chatDurationSegment');
  const customControl = document.getElementById('chatCustomDurationControl');
  const customInput = document.getElementById('chatCustomDurationInput');
  const hiddenInput = document.getElementById('chatDurationSelect');
  let duration = parseInt(requestedDuration, 10);

  if (isCustomDurationModel) {
    duration = clampVideoDuration(duration, 4, 30, 5);
    if (durationSegment) durationSegment.classList.add('hidden');
    if (customControl) customControl.classList.remove('hidden');
    if (customInput) customInput.value = String(duration);
    const customRange = document.getElementById('chatCustomDurationRange');
    if (customRange) customRange.value = String(duration);
  } else {
    duration = [5, 10, 15].includes(duration) ? duration : 15;
    if (durationSegment) {
      durationSegment.classList.remove('hidden');
      durationSegment.dataset.value = String(duration);
      durationSegment.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === String(duration));
      });
    }
    if (customControl) customControl.classList.add('hidden');
  }
  if (hiddenInput) hiddenInput.value = String(duration);
  return duration;
}

function getChatGenerationMode() {
  return el.chatGenerationMode?.value === 'image' ? 'image' : 'video';
}

function getChatImageSize(aspectRatio) {
  return CHAT_IMAGE_SIZE_BY_ASPECT[aspectRatio] || CHAT_IMAGE_SIZE_BY_ASPECT['1:1'];
}

function clampImageCount(value, fallback = 1) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(10, Math.max(1, parsed));
}

function syncChatImageCount(value, options = {}) {
  const next = clampImageCount(value, state.chatImageCount || 1);
  state.chatImageCount = next;
  if (el.chatImageCountInput) el.chatImageCountInput.value = String(next);
  if (options.persist !== false) localStorage.setItem('chat_image_count', String(next));
  updateCreationPricePreview();
  return next;
}

function getServerModels(mode, operation) {
  return (state.serverModels || []).filter(item => item.mode === mode && item.operation === operation && item.is_active !== false);
}

function getPreferredServerModel(mode, operation, preferred = '') {
  const models = getServerModels(mode, operation);
  if (!models.length) return '';
  const preferredValue = String(preferred || '').trim();
  const preferredModel = models.find(item => item.model === preferredValue)?.model;
  if (preferredModel) return preferredModel;
  return models.find(item => item.metadata?.isDefault === true)?.model || models[0].model;
}

function getModelDisplayName(item) {
  return String(item?.display_name || item?.model || '').trim();
}

function getServerModelLabel(mode, operation, model) {
  const item = getServerModels(mode, operation).find(candidate => candidate.model === model);
  return getModelDisplayName(item) || String(model || '');
}

function getCanvasVideoModelOptionsHtml(node) {
  return getCanvasNodeModelOptionsHtml(node, 'video');
}

function getCanvasNodeModelOptionsHtml(node, operation) {
  const models = getServerModels('canvas', operation);
  const operationLabel = operation === 'image' ? '图片' : operation === 'llm' ? '语言' : '视频';
  if (!models.length) return `<div class="canvas-video-model-option disabled"><strong>暂无可用模型</strong><small>请先在 API 设置中配置${operationLabel}模型</small></div>`;
  const selected = getPreferredServerModel('canvas', operation, node?.model);
  return models.map(item => {
    const description = item.metadata?.description || item.provider_name || item.model;
    return `<button type="button" class="canvas-video-model-option ${item.model === selected ? 'active' : ''}" data-model="${escapeHTML(item.model)}" onclick="selectCanvasNodeModelEncoded('${escapeHTML(node.id)}', '${operation}', '${encodeURIComponent(item.model)}', event)"><strong>${escapeHTML(getModelDisplayName(item))}</strong><small>${escapeHTML(description)}</small></button>`;
  }).join('');
}

function renderCanvasNodeModelPicker(node, operation) {
  const selected = getPreferredServerModel('canvas', operation, node?.model);
  const operationLabel = operation === 'image' ? '图片' : operation === 'llm' ? '语言' : '视频';
  const label = getServerModelLabel('canvas', operation, selected) || `暂无可用${operationLabel}模型`;
  return `<div class="canvas-video-model-dropdown canvas-inline-model-picker is-${operation}" data-node-id="${escapeHTML(node.id)}" data-operation="${operation}">
    <button type="button" class="canvas-video-model-trigger" aria-label="${operationLabel}模型" aria-expanded="false" title="选择${operationLabel}模型" onclick="toggleCanvasVideoModelDropdown('${escapeHTML(node.id)}', event, '${operation}')">
      <span class="canvas-video-model-dot"></span><span class="canvas-video-model-label">${escapeHTML(label)}</span><span class="canvas-video-model-chevron">⌄</span>
    </button>
    <div class="canvas-video-model-menu">${getCanvasNodeModelOptionsHtml(node, operation)}</div>
  </div>`;
}

function renderChatVideoModelOptions() {
  const dropdown = document.getElementById('chatModelDropdown');
  if (!dropdown) return;
  const models = getServerModels('creation', 'video');
  const preferred = getPreferredServerModel('creation', 'video', state.apiConfig?.model || dropdown.dataset.value);
  dropdown.dataset.value = preferred;
  const label = dropdown.querySelector('.pill-label');
  const menu = dropdown.querySelector('.pill-menu');
  const hiddenInput = dropdown.querySelector('input[type="hidden"]');
  if (!models.length) {
    if (label) label.textContent = '暂无可用视频模型';
    if (menu) menu.innerHTML = '<div class="pill-option disabled">暂无已启用的视频模型</div>';
    if (hiddenInput) hiddenInput.value = '';
    return;
  }
  if (label) label.textContent = getModelDisplayName(models.find(item => item.model === preferred));
  if (hiddenInput) hiddenInput.value = preferred;
  if (menu) {
    menu.innerHTML = models.map(item => `<div class="pill-option ${item.model === preferred ? 'active' : ''}" data-value="${escapeHTML(item.model)}"><span class="opt-name">${escapeHTML(getModelDisplayName(item))}</span><span class="opt-sub">${escapeHTML(item.metadata?.description || item.provider_name || item.model)}</span></div>`).join('');
    menu.querySelectorAll('.pill-option').forEach(option => {
      option.addEventListener('click', event => {
        event.stopPropagation();
        dropdown.dataset.value = option.dataset.value;
        if (label) label.textContent = option.querySelector('.opt-name')?.textContent || option.dataset.value;
        if (hiddenInput) hiddenInput.value = option.dataset.value;
        menu.querySelectorAll('.pill-option').forEach(item => item.classList.toggle('active', item === option));
        syncChatDurationControl(option.dataset.value, document.getElementById('chatDurationSelect')?.value || 15);
        dropdown.classList.remove('open');
        updateCreationPricePreview();
      });
    });
  }
  if (state.apiConfig) state.apiConfig.model = preferred;
  localStorage.setItem('api_model', preferred);
  syncChatDurationControl(preferred, document.getElementById('chatDurationSelect')?.value || state.apiConfig?.duration || 15);
}

function renderChatImageModel() {
  const models = getServerModels('creation', 'image');
  const preferred = getPreferredServerModel('creation', 'image', state.apiConfig?.imageModel);
  const dropdown = document.getElementById('chatImageModelDropdown');
  const menu = dropdown?.querySelector('.pill-menu');
  const hiddenInput = document.getElementById('chatImageModelSelect');
  if (preferred && state.apiConfig) {
    state.apiConfig.imageModel = preferred;
    localStorage.setItem('api_imageModel', preferred);
  }
  if (!dropdown || !menu || !el.chatImageModelDisplay) return;
  dropdown.dataset.value = preferred;
  el.chatImageModelDisplay.textContent = preferred ? getModelDisplayName(models.find(item => item.model === preferred)) : '暂无可用图片模型';
  if (hiddenInput) hiddenInput.value = preferred;
  menu.innerHTML = models.length
    ? models.map(item => `<div class="pill-option ${item.model === preferred ? 'active' : ''}" data-value="${escapeHTML(item.model)}"><span class="opt-name">${escapeHTML(getModelDisplayName(item))}</span><span class="opt-sub">${escapeHTML(item.metadata?.description || item.provider_name || item.model)}</span></div>`).join('')
    : '<div class="pill-option disabled">暂无已启用的图片模型</div>';
  menu.querySelectorAll('.pill-option[data-value]').forEach(option => {
    option.addEventListener('click', event => {
      event.stopPropagation();
      const model = option.dataset.value;
      dropdown.dataset.value = model;
      el.chatImageModelDisplay.textContent = option.querySelector('.opt-name')?.textContent || model;
      if (hiddenInput) hiddenInput.value = model;
      menu.querySelectorAll('.pill-option').forEach(item => item.classList.toggle('active', item === option));
      state.apiConfig.imageModel = model;
      localStorage.setItem('api_imageModel', model);
      BackendClient.saveConfig?.({ image: { model } });
      dropdown.classList.remove('open');
      renderMultiAngleModel();
      updateCreationPricePreview();
    });
  });
}

function renderLongScriptModelSelector() {
  const picker = document.getElementById('longScriptModelBadge');
  const select = document.getElementById('longScriptModelSelect');
  if (!picker || !select) return;
  const models = getServerModels('long-script', 'long-script');
  const preferred = getPreferredServerModel('long-script', 'long-script', state.apiConfig?.llmModelName);
  picker.classList.toggle('is-empty', !models.length);
  select.innerHTML = models.length
    ? models.map(item => `<option value="${escapeHTML(item.model)}" ${item.model === preferred ? 'selected' : ''}>${escapeHTML(getModelDisplayName(item))}</option>`).join('')
    : '<option value="">暂无可用长剧本模型</option>';
  select.disabled = !models.length;
  if (preferred && state.apiConfig) {
    state.apiConfig.llmModelName = preferred;
    localStorage.setItem('api_llmModelName', preferred);
  }
}

function applyServerModelsToUi(models) {
  state.serverModels = Array.isArray(models) ? models : [];
  renderChatVideoModelOptions();
  renderChatImageModel();
  renderLongScriptModelSelector();
  renderMultiAngleModel();
  renderApiConfigVideoModelOptions();
  updateLongScriptModelBadge();
  if (typeof renderCanvasNodesAndLines === 'function' && canvasState?.nodes) renderCanvasNodesAndLines();
  updateCreationPricePreview();
}

function renderApiConfigVideoModelOptions() {
  if (!el.cfgDefaultModel) return;
  const models = getServerModels('creation', 'video');
  const preferred = getPreferredServerModel('creation', 'video', state.apiConfig?.model || el.cfgDefaultModel.value);
  el.cfgDefaultModel.innerHTML = models.length
    ? models.map(item => `<option value="${escapeHTML(item.model)}" ${item.model === preferred ? 'selected' : ''}>${escapeHTML(getModelDisplayName(item))} · ${escapeHTML(item.model)}</option>`).join('')
    : '<option value="">暂无已启用的视频模型</option>';
  el.cfgDefaultModel.disabled = !models.length;
}

async function loadServerModels() {
  if (!BackendClient.isAuthenticated()) return [];
  try {
    const models = await BackendClient.getModels();
    applyServerModelsToUi(models);
    return models;
  } catch (error) {
    console.warn('读取服务端模型失败:', error.message);
    applyServerModelsToUi([]);
    if (el.creationPricePreview) {
    el.creationPricePreview.textContent = '--';
    el.creationPricePreview.title = `无法读取模型配置：${error.message}`;
    el.creationPricePreview.classList.add('is-error');
  }
    return [];
  }
}

function getCreationPricingPayload() {
  const generationMode = getChatGenerationMode();
  if (generationMode === 'image') {
    const model = getPreferredServerModel('creation', 'image', state.apiConfig?.imageModel);
    return model ? { mode: 'creation', operation: 'image', model, count: clampImageCount(el.chatImageCountInput?.value || state.chatImageCount || 1) } : null;
  }
  const model = getPreferredServerModel('creation', 'video', document.getElementById('chatModelSelect')?.value || state.apiConfig?.model);
  const duration = parseInt(document.getElementById('chatDurationSelect')?.value || state.apiConfig?.duration || 15, 10);
  return model ? { mode: 'creation', operation: 'video', model, duration } : null;
}

async function updateCreationPricePreview() {
  void updateAuxiliaryPricePreviews();
  const target = el.creationPricePreview || document.getElementById('creationPricePreview');
  if (!target) return;
  const payload = getCreationPricingPayload();
  const requestId = ++state.pricingPreviewRequestId;
  if (!payload) {
    target.textContent = '--';
    target.title = '暂无可用模型';
    target.classList.add('is-error');
    return;
  }
  target.classList.remove('is-error');
  target.textContent = '--';
  target.title = '正在读取实际积分';
  try {
    const pricing = await BackendClient.previewPricing(payload);
    if (requestId !== state.pricingPreviewRequestId) return;
    target.innerHTML = `<strong>${pricing.credits} 积分</strong>`;
    target.title = `实际消耗：${pricing.credits} 积分`;
  } catch (error) {
    if (requestId !== state.pricingPreviewRequestId) return;
    target.textContent = '--';
    target.title = `暂不可用：${error.message}`;
    target.classList.add('is-error');
  }
}

async function updateCanvasPricePreviews() {
  if (!Array.isArray(canvasState?.nodes)) return;
  await Promise.all(canvasState.nodes.map(async node => {
    if (node.type === 'video') {
      const model = getPreferredServerModel('canvas', 'video', node.model);
      await previewPriceBadge(`canvas-video-price-${node.id}`, model ? { mode: 'canvas', operation: 'video', model, duration: Number(node.duration) || 15 } : null);
    } else if (node.type === 'asset') {
      const model = getPreferredServerModel('canvas', 'image', node.model);
      await previewPriceBadge(`canvas-image-price-${node.id}`, model ? { mode: 'canvas', operation: 'image', model, count: 1 } : null);
    } else if (node.type === 'agent') {
      const model = getPreferredServerModel('canvas', 'llm');
      await previewPriceBadge(`canvas-agent-price-${node.id}`, model ? { mode: 'canvas', operation: 'llm', model } : null);
    }
  }));
}

function setPriceBadge(id, pricing, error = '') {
  const target = document.getElementById(id);
  if (!target) return;
  target.classList.toggle('is-error', !!error);
  if (error) {
    target.textContent = '积分预算：--';
    target.title = error;
    return;
  }
  if (!pricing) {
    target.textContent = '积分预算：--';
    return;
  }
  const unit = pricing.unit === 'second' ? '积分/秒' : pricing.unit === 'image' ? '积分/张' : '积分/次';
  target.textContent = `✦ ${pricing.credits} 积分`;
  target.title = `实际价格：${pricing.multiplier} × ${pricing.unitCredits} ${unit}`;
}

async function previewPriceBadge(id, payload) {
  if (!state.priceBadgeRequestIds) state.priceBadgeRequestIds = {};
  const requestId = Number(state.priceBadgeRequestIds[id] || 0) + 1;
  state.priceBadgeRequestIds[id] = requestId;
  if (!payload) return setPriceBadge(id, null, '暂无可用模型');
  setPriceBadge(id, null);
  try {
    const pricing = await BackendClient.previewPricing(payload);
    if (state.priceBadgeRequestIds[id] !== requestId) return;
    setPriceBadge(id, pricing);
  } catch (error) {
    if (state.priceBadgeRequestIds[id] !== requestId) return;
    setPriceBadge(id, null, error.message || '价格读取失败');
  }
}

async function updateAuxiliaryPricePreviews() {
  const longScriptModel = getPreferredServerModel('long-script', 'long-script', state.apiConfig?.llmModelName);
  const scriptModel = getPreferredServerModel('long-script', 'long-script', state.apiConfig?.llmModelName);
  await Promise.all([
    previewPriceBadge('longScriptPricePreview', longScriptModel ? { mode: 'long-script', operation: 'long-script', model: longScriptModel } : null),
    previewPriceBadge('scriptPricePreview', scriptModel ? { mode: 'long-script', operation: 'long-script', model: scriptModel } : null),
    previewPriceBadge('formVideoPricePreview', getCreationPricingPayload()),
    previewPriceBadge('detailVideoPricePreview', getCreationPricingPayload())
  ]);
}

function syncChatGenerationMode(mode, options = {}) {
  const normalizedMode = mode === 'image' ? 'image' : 'video';
  const persist = options.persist !== false;
  const updatePrice = options.price !== false;
  state.chatGenerationMode = normalizedMode;
  if (el.chatGenerationMode) el.chatGenerationMode.value = normalizedMode;
  if (el.chatGenerationModeSegment) {
    el.chatGenerationModeSegment.dataset.value = normalizedMode;
    el.chatGenerationModeSegment.querySelectorAll('.segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === normalizedMode);
    });
  }

  const isImageMode = normalizedMode === 'image';
  el.chatVideoModelGroup?.classList.toggle('hidden', isImageMode);
  el.chatVideoAspectGroup?.classList.toggle('hidden', isImageMode);
  el.chatDurationGroup?.classList.toggle('hidden', isImageMode);
  el.chatImageModelGroup?.classList.toggle('hidden', !isImageMode);
  el.chatImageAspectGroup?.classList.toggle('hidden', !isImageMode);
  el.chatImageCountGroup?.classList.toggle('hidden', !isImageMode);

  renderChatImageModel();
  if (el.chatMediaInput) el.chatMediaInput.accept = isImageMode ? 'image/*' : 'image/*,video/*,audio/*';
  if (el.btnUploadChatMedia) el.btnUploadChatMedia.title = isImageMode ? '支持选择多张参考图' : '支持选择参考图片、视频或音频';
  if (el.chatUploadMediaLabel) el.chatUploadMediaLabel.textContent = isImageMode ? '上传参考图' : '上传参考媒体';
  if (el.chatDragOverlayTitle) el.chatDragOverlayTitle.textContent = isImageMode ? '释放鼠标，即刻上传参考图片' : '释放鼠标，即刻上传图片 / 视频 / 音频';
  if (el.chatDragOverlayHint) el.chatDragOverlayHint.textContent = isImageMode ? '支持常见图片格式' : '支持常见图片、视频和音频格式';
  if (el.aiChatTextarea) {
    el.aiChatTextarea.placeholder = isImageMode
      ? '描述你想要生成的图片画面（例如：产品广告主视觉、人物海报、场景概念图...）'
      : '描述你想要生成的视频画面（例如：一条在森林清澈溪流中游动的锦鲤，阳光穿透水面...）';
  }
  if (el.chatSubmitButtonLabel) {
    el.chatSubmitButtonLabel.setAttribute('aria-label', isImageMode ? '生成图片' : '生成视频');
  }
  if (el.btnSubmitAiChat) {
    el.btnSubmitAiChat.setAttribute('aria-label', isImageMode ? '生成图片' : '生成视频');
  }
  if (updatePrice) updateCreationPricePreview();

  if (isImageMode) {
    const removedCount = state.chatRefMediaList.filter(item => item.type !== 'image').length;
    if (removedCount > 0) {
      state.chatRefMediaList = state.chatRefMediaList.filter(item => item.type === 'image');
      renderChatRefMediaList();
      showToast(`图片模式仅支持参考图，已移除 ${removedCount} 个其他媒体`);
    }
  }
  if (persist) localStorage.setItem('chat_generation_mode', normalizedMode);
  syncCreationSubmitButtonState();
  return normalizedMode;
}

function initAppleControls() {
  // 1. Apple Segment Controls
  document.querySelectorAll('.apple-segment-control').forEach(segment => {
    const hiddenInput = segment.querySelector('input[type="hidden"]');
    const btns = segment.querySelectorAll('.segment-btn');

    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.value;
        segment.dataset.value = val;
        if (hiddenInput) hiddenInput.value = val;
        if (segment.id === 'chatDurationSegment') {
          const chatDurationInput = document.getElementById('chatDurationSelect');
          if (chatDurationInput) chatDurationInput.value = val;
          if (state.apiConfig) state.apiConfig.duration = parseInt(val, 10);
          localStorage.setItem('api_duration', val);
          updateCreationPricePreview();
        } else if (segment.id === 'chatGenerationModeSegment') {
          syncChatGenerationMode(val);
        } else if (segment.id === 'chatImageAspectSegment') {
          state.chatImageAspect = val;
          localStorage.setItem('chat_image_aspect', val);
          updateCreationPricePreview();
        }
      });
    });
  });

  const imageCountInput = document.getElementById('chatImageCountInput');
  imageCountInput?.addEventListener('input', event => syncChatImageCount(event.target.value));
  imageCountInput?.addEventListener('change', event => { event.target.value = String(syncChatImageCount(event.target.value)); });
  document.getElementById('btnChatImageCountDown')?.addEventListener('click', () => syncChatImageCount((state.chatImageCount || 1) - 1));
  document.getElementById('btnChatImageCountUp')?.addEventListener('click', () => syncChatImageCount((state.chatImageCount || 1) + 1));

  // 2. Apple Pill Dropdowns
  document.querySelectorAll('.apple-pill-dropdown').forEach(dropdown => {
    const trigger = dropdown.querySelector('.pill-trigger');
    const labelSpan = dropdown.querySelector('.pill-label');
    const hiddenInput = dropdown.querySelector('input[type="hidden"]');
    const options = dropdown.querySelectorAll('.pill-option');

    if (trigger) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.apple-pill-dropdown').forEach(d => {
          if (d !== dropdown) d.classList.remove('open');
        });
        dropdown.classList.toggle('open');
      });
    }

    options.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        options.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        const val = opt.dataset.value;
        const name = opt.querySelector('.opt-name') ? opt.querySelector('.opt-name').textContent : val;
        dropdown.dataset.value = val;
        if (labelSpan) labelSpan.textContent = name;
        if (hiddenInput) hiddenInput.value = val;
        if (dropdown.id === 'chatModelDropdown') {
          const currentDuration = document.getElementById('chatDurationSelect')?.value || 5;
          syncChatDurationControl(val, currentDuration);
        }
        dropdown.classList.remove('open');
      });
    });
  });

  const customDurationInput = document.getElementById('chatCustomDurationInput');
  const customDurationRange = document.getElementById('chatCustomDurationRange');
  const applyCustomDuration = (source, shouldClamp = true) => {
    const rawValue = source?.value;
    if (!shouldClamp && source === customDurationInput) {
      if (rawValue === '') return;
      const parsed = parseInt(rawValue, 10);
      if (!Number.isFinite(parsed) || parsed < 4 || parsed > 30) return;
    }
    const value = clampVideoDuration(rawValue, 4, 30, 5);
    if (customDurationInput) customDurationInput.value = String(value);
    if (customDurationRange) customDurationRange.value = String(value);
    const hiddenInput = document.getElementById('chatDurationSelect');
    if (hiddenInput) hiddenInput.value = String(value);
  };
  if (customDurationInput) {
    customDurationInput.addEventListener('input', () => {
      applyCustomDuration(customDurationInput, false);
      updateCreationPricePreview();
    });
    customDurationInput.addEventListener('blur', () => {
      applyCustomDuration(customDurationInput, true);
      updateCreationPricePreview();
    });
    customDurationInput.addEventListener('change', () => {
      applyCustomDuration(customDurationInput, true);
      updateCreationPricePreview();
    });
  }
  if (customDurationRange) {
    customDurationRange.addEventListener('input', () => {
      applyCustomDuration(customDurationRange, true);
      updateCreationPricePreview();
    });
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.apple-pill-dropdown').forEach(d => d.classList.remove('open'));
  });
}

function setCustomDropdownValue(dropdownEl, value) {
  if (!dropdownEl) return;
  dropdownEl.dataset.value = value;
  const items = dropdownEl.querySelectorAll('.dropdown-item');
  let matchedText = '';

  items.forEach(item => {
    if (item.dataset.value === value) {
      item.classList.add('active');
      matchedText = item.textContent.trim();
    } else {
      item.classList.remove('active');
    }
  });

  if (matchedText) {
    dropdownEl.querySelector('.dropdown-label').textContent = matchedText;
  }
}

let chatInlineMediaPreview = null;
let chatAtInsertionRange = null;
let chatPromptLastSelectionRange = null;

function getChatRefMediaByTag(tag) {
  return (state.chatRefMediaList || []).find(item => item.tag === tag) || null;
}

function createChatInlineMediaRef(item) {
  if (!item) return null;
  const ref = document.createElement('span');
  ref.className = `chat-inline-media-ref${item.type === 'video' ? ' is-video' : item.type === 'audio' ? ' is-audio' : ''}`;
  ref.contentEditable = 'false';
  ref.tabIndex = 0;
  ref.dataset.tag = item.tag || '';
  ref.dataset.mediaId = item.id || '';
  ref.setAttribute('aria-label', `${item.fileName || '参考图'}，悬停放大预览`);
  ref.title = '悬停放大预览';

  const media = document.createElement(item.type === 'video' || item.type === 'audio' ? 'span' : 'img');
  if (item.type === 'video') {
    media.className = 'chat-inline-video-thumb';
    media.textContent = '▶';
  } else if (item.type === 'audio') {
    media.className = 'chat-inline-audio-thumb';
    media.textContent = '♫';
  } else {
    media.src = item.url || '';
    media.alt = item.fileName || '参考图';
  }
  ref.appendChild(media);
  return ref;
}

function serializeChatPromptNode(node) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';
  if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('chat-inline-media-ref')) {
    return node.dataset.tag || '';
  }
  if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') return '\n';

  let text = '';
  node.childNodes.forEach(child => { text += serializeChatPromptNode(child); });
  if (node.nodeType === Node.ELEMENT_NODE && /^(DIV|P)$/.test(node.tagName) && text && !text.endsWith('\n')) text += '\n';
  return text;
}

function getChatPromptEditorValue(editor = el.aiChatTextarea) {
  if (!editor) return '';
  if (!editor.isContentEditable) return editor.value || '';
  return serializeChatPromptNode(editor).replace(/\n$/, '');
}

function setChatPromptEditorValue(editor, value) {
  if (!editor || !editor.isContentEditable) {
    if (editor) editor.value = value == null ? '' : String(value);
    return;
  }
  const text = value == null ? '' : String(value);
  const fragment = document.createDocumentFragment();
  const tagRegex = /@图\d+/g;
  let lastIndex = 0;
  let match;
  while ((match = tagRegex.exec(text))) {
    if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    const item = getChatRefMediaByTag(match[0]);
    fragment.appendChild(item ? createChatInlineMediaRef(item) : document.createTextNode(match[0]));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  editor.replaceChildren(fragment);
  chatPromptLastSelectionRange = null;
}

function refreshChatPromptEditorMediaRefs() {
  const editor = el.aiChatTextarea;
  if (!editor?.isContentEditable) return;
  editor.querySelectorAll('.chat-inline-media-ref').forEach(ref => {
    const item = (state.chatRefMediaList || []).find(media => media.id === ref.dataset.mediaId) || getChatRefMediaByTag(ref.dataset.tag);
    if (!item) {
      ref.replaceWith(document.createTextNode(ref.dataset.tag || ''));
      return;
    }
    ref.dataset.tag = item.tag || ref.dataset.tag || '';
    ref.dataset.mediaId = item.id || '';
    ref.setAttribute('aria-label', `${item.fileName || '参考图'}，悬停放大预览`);
    const media = ref.querySelector('img');
    if (item.type === 'image' && media && media.src !== item.url) media.src = item.url || '';
  });
}

function getChatEditorTextBeforeCaret(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return '';
  const activeRange = selection.getRangeAt(0);
  if (!editor.contains(activeRange.startContainer)) return '';
  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(editor);
  prefixRange.setEnd(activeRange.startContainer, activeRange.startOffset);
  return serializeChatPromptNode(prefixRange.cloneContents());
}

function isRangeInsideChatPromptEditor(range, editor = el.aiChatTextarea) {
  if (!range || !editor || !range.startContainer?.isConnected || !range.endContainer?.isConnected) return false;
  return editor.contains(range.startContainer) && editor.contains(range.endContainer);
}

function rememberChatPromptSelection(editor = el.aiChatTextarea) {
  if (!editor?.isContentEditable) return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!isRangeInsideChatPromptEditor(range, editor)) return null;
  chatPromptLastSelectionRange = range.cloneRange();
  return chatPromptLastSelectionRange;
}

function placeCaretAtChatEditorEnd(editor) {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
}

function removeAtSymbolBeforeChatRange(range, editor) {
  const container = range.startContainer;
  const offset = range.startOffset;
  if (container.nodeType === Node.TEXT_NODE && offset > 0 && container.nodeValue?.charAt(offset - 1) === '@') {
    container.deleteData(offset - 1, 1);
    range.setStart(container, offset - 1);
    range.collapse(true);
    return;
  }
  if (container.nodeType === Node.ELEMENT_NODE && offset > 0) {
    const previous = container.childNodes[offset - 1];
    if (previous?.nodeType === Node.TEXT_NODE && previous.nodeValue?.endsWith('@')) {
      previous.deleteData(previous.nodeValue.length - 1, 1);
      range.setStartAfter(previous);
      range.collapse(true);
      return;
    }
  }
  if (container === editor && offset === 0) range.collapse(true);
}

function insertChatInlineMediaRef(editor, tag, replacingAtSymbol = false) {
  const item = getChatRefMediaByTag(tag);
  if (!item) return false;
  const selection = window.getSelection();
  const liveRange = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
  let range = replacingAtSymbol && chatAtInsertionRange
    ? chatAtInsertionRange.cloneRange()
    : (isRangeInsideChatPromptEditor(liveRange, editor)
      ? liveRange.cloneRange()
      : (isRangeInsideChatPromptEditor(chatPromptLastSelectionRange, editor) ? chatPromptLastSelectionRange.cloneRange() : null));

  editor.focus({ preventScroll: true });
  if (!range) range = placeCaretAtChatEditorEnd(editor);
  if (!range.collapsed) range.deleteContents();
  if (replacingAtSymbol) removeAtSymbolBeforeChatRange(range, editor);

  const ref = createChatInlineMediaRef(item);
  const spacer = document.createTextNode(' ');
  const fragment = document.createDocumentFragment();
  fragment.append(ref, spacer);
  range.insertNode(fragment);
  range.setStartAfter(spacer);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  chatPromptLastSelectionRange = range.cloneRange();
  chatAtInsertionRange = null;
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

function hideChatInlineMediaPreview() {
  if (!chatInlineMediaPreview) return;
  chatInlineMediaPreview.remove();
  chatInlineMediaPreview = null;
}

function showChatInlineMediaPreview(ref) {
  const item = (state.chatRefMediaList || []).find(media => media.id === ref.dataset.mediaId) || getChatRefMediaByTag(ref.dataset.tag);
  if (!item?.url) return;
  hideChatInlineMediaPreview();

  const preview = document.createElement('div');
  preview.className = 'chat-inline-media-hover-preview';
  const media = document.createElement(item.type === 'video' ? 'div' : item.type === 'audio' ? 'audio' : 'img');
  if (item.type === 'video') {
    media.className = 'chat-inline-video-hover-placeholder';
    media.textContent = '▶ 视频参考仅在点击播放后加载';
  } else if (item.type === 'audio') {
    media.src = item.url;
    media.controls = true;
  } else {
    media.src = item.url;
    media.alt = item.fileName || '参考图预览';
  }
  const title = document.createElement('div');
  title.className = 'chat-inline-media-hover-preview-title';
  title.textContent = item.fileName || '参考图预览';
  preview.append(media, title);
  document.body.appendChild(preview);

  const anchorRect = ref.getBoundingClientRect();
  const previewWidth = 280;
  const left = Math.max(12, Math.min(anchorRect.left + anchorRect.width / 2 - previewWidth / 2, window.innerWidth - previewWidth - 12));
  const measuredHeight = preview.offsetHeight || 220;
  const top = anchorRect.top > measuredHeight + 16
    ? anchorRect.top - measuredHeight - 10
    : Math.min(anchorRect.bottom + 10, window.innerHeight - measuredHeight - 12);
  preview.style.left = `${left}px`;
  preview.style.top = `${Math.max(12, top)}px`;
  chatInlineMediaPreview = preview;
  requestAnimationFrame(() => preview.classList.add('visible'));
}

function getClipboardImageFiles(event) {
  const itemFiles = [...(event.clipboardData?.items || [])]
    .filter(item => item.kind === 'file' && String(item.type || '').startsWith('image/'))
    .map((item, index) => {
      const file = item.getAsFile();
      if (!file) return null;
      const extension = String(file.type || 'image/png').split('/')[1] || 'png';
      return file.name ? file : new File([file], `粘贴图片-${Date.now()}-${index + 1}.${extension}`, { type: file.type || 'image/png' });
    })
    .filter(Boolean);
  if (itemFiles.length) return itemFiles;
  return [...(event.clipboardData?.files || [])].filter(file => String(file.type || '').startsWith('image/'));
}

function insertPlainTextIntoChatEditor(editor, text) {
  const selection = window.getSelection();
  let range = selection && selection.rangeCount ? selection.getRangeAt(0) : placeCaretAtChatEditorEnd(editor);
  if (!editor.contains(range.startContainer)) range = placeCaretAtChatEditorEnd(editor);
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  chatPromptLastSelectionRange = range.cloneRange();
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function initChatPromptEditor() {
  const editor = el.aiChatTextarea;
  if (!editor?.isContentEditable || editor.dataset.inlineMediaReady === '1') return;
  editor.dataset.inlineMediaReady = '1';
  Object.defineProperty(editor, 'value', {
    configurable: true,
    get() { return getChatPromptEditorValue(editor); },
    set(value) { setChatPromptEditorValue(editor, value); }
  });
  Object.defineProperty(editor, 'placeholder', {
    configurable: true,
    get() { return editor.dataset.placeholder || ''; },
    set(value) { editor.dataset.placeholder = value == null ? '' : String(value); }
  });
  editor.addEventListener('mouseover', event => {
    const ref = event.target.closest('.chat-inline-media-ref');
    if (ref && !ref.contains(event.relatedTarget)) showChatInlineMediaPreview(ref);
  });
  editor.addEventListener('mouseout', event => {
    const ref = event.target.closest('.chat-inline-media-ref');
    if (ref && !ref.contains(event.relatedTarget)) hideChatInlineMediaPreview();
  });
  editor.addEventListener('focusout', event => {
    if (event.target.closest('.chat-inline-media-ref')) hideChatInlineMediaPreview();
  });
  ['input', 'keyup', 'mouseup', 'focus'].forEach(eventType => {
    editor.addEventListener(eventType, () => rememberChatPromptSelection(editor));
  });
  editor.addEventListener('paste', event => {
    const files = getClipboardImageFiles(event);
    if (files.length) {
      event.preventDefault();
      void handleChatMediaSelect({ target: { files } }).then(count => {
        if (count > 0) showToast(`已从剪贴板添加 ${count} 张参考图`, 'success');
      });
      return;
    }
    event.preventDefault();
    insertPlainTextIntoChatEditor(editor, event.clipboardData?.getData('text/plain') || '');
  });
}

// 切换侧边栏手风琴展开/收起
function toggleSidebarAccordion(groupEl) {
  if (!groupEl) return;
  groupEl.classList.toggle('expanded');
}

// 绑定通用事件
function bindEvents() {
  // 手风琴菜单：点击父级展开/收起，并将当前一级菜单设为高亮
  const allParentNavs = [el.navVideoGen, el.navInspirationHub, el.navKbGroup, el.navAdmin].filter(Boolean);
  const allParentGroups = [el.menuGroupVideoGen, el.menuGroupInspiration, el.menuGroupKb, el.menuGroupAdmin].filter(Boolean);
  function activateParentMenu(activeNav, activeGroup) {
    allParentNavs.forEach(n => n.classList.remove('active'));
    allParentGroups.forEach(g => g.classList.remove('active'));
    if (activeNav) activeNav.classList.add('active');
    if (activeGroup) activeGroup.classList.add('active');
  }

  if (el.navVideoGen && el.menuGroupVideoGen) {
    el.navVideoGen.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSidebarAccordion(el.menuGroupVideoGen);
      activateParentMenu(el.navVideoGen, el.menuGroupVideoGen);
    });
  }
  if (el.navInspirationHub && el.menuGroupInspiration) {
    el.navInspirationHub.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSidebarAccordion(el.menuGroupInspiration);
      activateParentMenu(el.navInspirationHub, el.menuGroupInspiration);
    });
  }
  if (el.navKbGroup && el.menuGroupKb) {
    el.navKbGroup.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSidebarAccordion(el.menuGroupKb);
      activateParentMenu(el.navKbGroup, el.menuGroupKb);
    });
  }
  if (el.navAdmin && el.menuGroupAdmin) {
    el.navAdmin.addEventListener('click', (e) => {
      e.preventDefault();
      if (!BackendClient.isAdmin()) return showToast('需要管理员权限', 'warning');
      toggleSidebarAccordion(el.menuGroupAdmin);
      activateParentMenu(el.navAdmin, el.menuGroupAdmin);
    });
  }
  const adminNavMap = {
    navAdminOverview: 'overview', navAdminUsers: 'users', navAdminModels: 'models',
    navAdminProviders: 'providers', navAdminTasks: 'tasks', navAdminLedger: 'ledger', navAdminAudit: 'audit'
  };
  Object.entries(adminNavMap).forEach(([id, panel]) => {
    const button = el[id];
    if (button) button.addEventListener('click', event => { event.preventDefault(); switchView(`admin:${panel}`); });
  });

  // 子菜单：AI 视频生成
  if (el.navCreate) {
    el.navCreate.addEventListener('click', (e) => {
      e.preventDefault();
      if (SessionSystem.isInitialized()) SessionSystem.openType('creation');
      else switchView('videoGen');
    });
  }
  if (el.navCanvasMode) {
    el.navCanvasMode.addEventListener('click', (e) => {
      e.preventDefault();
      if (SessionSystem.isInitialized()) SessionSystem.openType('canvas');
      else switchView('canvasMode');
    });
  }
  if (el.navScriptGen) {
    el.navScriptGen.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('scriptGen');
    });
  }
  if (el.navLongScriptGen) {
    el.navLongScriptGen.addEventListener('click', (e) => {
      e.preventDefault();
      if (SessionSystem.isInitialized()) SessionSystem.openType('long-script');
      else switchView('longScriptGen');
    });
  }
  if (el.navMultiAngle) {
    el.navMultiAngle.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('multiAngle');
    });
  }
  if (el.navSubQueue) {
    el.navSubQueue.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('videoGen');
      openTaskQueueModal();
    });
  }
  if (el.navSubHistory) {
    el.navSubHistory.addEventListener('click', (e) => {
      e.preventDefault();
      openHistoryModal();
    });
  }

  // 子菜单：灵感中心
  if (el.navShowcase) {
    el.navShowcase.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('showcase');
    });
  }

  // 子菜单：知识库管理
  if (el.navCanvasKb) {
    el.navCanvasKb.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('canvasKb');
    });
  }
  if (el.navLensKb) {
    el.navLensKb.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('lensKb');
    });
  }
  if (el.navPromptKb) {
    el.navPromptKb.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('promptKb');
    });
  }
  if (el.navAssetKb) {
    el.navAssetKb.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('assetKb');
    });
  }

  const btnOpenScriptHist = document.getElementById('btnOpenScriptHistoryModal');
  if (btnOpenScriptHist) {
    btnOpenScriptHist.addEventListener('click', () => {
      openScriptHistoryModal();
    });
  }
  const btnCloseScriptHist = document.getElementById('btnCloseScriptHistoryModal');
  if (btnCloseScriptHist) {
    btnCloseScriptHist.addEventListener('click', () => {
      closeScriptHistoryModal();
    });
  }

  // 小云雀 Chat 预设 Chip 点击
  document.querySelectorAll('.xyq-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const p = chip.dataset.prompt;
      if (p) {
        el.aiChatTextarea.value = p;
        el.aiChatTextarea.focus();
      }
    });
  });

  // Chat 表单提交与回车发送
  el.aiChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAiChatSubmit();
  });

  el.aiChatTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el.aiChatForm.dispatchEvent(new Event('submit'));
    }
  });

  // 参考媒体上传与拖拽支持
  el.btnUploadChatMedia.addEventListener('click', () => el.chatMediaInput.click());
  el.chatMediaInput.addEventListener('change', handleChatMediaSelect);
  if (el.btnClearAllChatMedia) el.btnClearAllChatMedia.addEventListener('click', clearAllChatMediaRefs);
  if (el.aiChatTextarea) el.aiChatTextarea.addEventListener('input', handleChatTextareaInput);
  setupChatDragAndDrop();
  el.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    el.clearSearch.classList.toggle('hidden', !state.searchQuery);
    renderTable();
  });

  el.clearSearch.addEventListener('click', () => {
    el.searchInput.value = '';
    state.searchQuery = '';
    el.clearSearch.classList.add('hidden');
    renderTable();
  });

  el.btnResetFilters.addEventListener('click', () => {
    state.filterShotSize = '';
    state.filterMovement = '';
    state.filterAngle = '';
    state.filterCategory = '';
    state.searchQuery = '';
    
    setCustomDropdownValue(el.dropdownShotSize, '');
    setCustomDropdownValue(el.dropdownMovement, '');
    setCustomDropdownValue(el.dropdownAngle, '');
    setCustomDropdownValue(el.dropdownCategory, '');
    
    el.searchInput.value = '';
    el.clearSearch.classList.add('hidden');
    
    renderTable();
    showToast('已重置筛选条件');
  });

  el.btnNewPrompt.addEventListener('click', () => openFormModal());
  el.btnEmptyAdd.addEventListener('click', () => openFormModal());
  el.btnCloseModal.addEventListener('click', closeFormModal);
  el.btnCancelForm.addEventListener('click', closeFormModal);

  setupDropZone();
  el.btnRemoveVideo.addEventListener('click', removeUploadedVideo);
  el.promptForm.addEventListener('submit', handleFormSubmit);

  el.btnSeedData.addEventListener('click', seedSampleData);
  el.btnExportData.addEventListener('click', exportDataJSON);
  el.btnImportData.addEventListener('click', () => el.importFileInput.click());
  el.importFileInput.addEventListener('change', importDataJSON);

  el.btnCloseDetail.addEventListener('click', closeDetailModal);
  el.btnCopyPromptDetail.addEventListener('click', () => {
    if (state.activeDetailItem) {
      copyToClipboard(state.activeDetailItem.prompt);
    }
  });

  el.btnEditDetail.addEventListener('click', () => {
    const item = state.activeDetailItem;
    closeDetailModal();
    if (item) openFormModal(item);
  });

  el.btnDeleteDetail.addEventListener('click', async () => {
    if (!state.activeDetailItem) return;
    if (confirm(`确认要删除“${state.activeDetailItem.title}”记录吗？`)) {
      await PromptStore.delete(state.activeDetailItem.id);
      closeDetailModal();
      await loadPrompts();
      showToast('记录已删除');
    }
  });

  el.cfgDefaultModel?.addEventListener('change', () => {
    syncApiConfigDurationInput(el.cfgDefaultModel.value, el.cfgDefaultDuration?.value || state.apiConfig.duration);
  });
  el.btnCloseApiModal?.addEventListener('click', closeApiConfigModal);
  el.btnSaveApiConfig?.addEventListener('click', saveApiConfig);
  el.btnClearStoredApiConfig?.addEventListener('click', clearStoredApiConfig);
  if (el.btnAdminRefresh) el.btnAdminRefresh.addEventListener('click', () => {
    const active = document.querySelector('#submenuAdmin .submenu-item.active');
    const panel = active?.id?.replace('navAdmin', '').replace(/^./, char => char.toLowerCase()) || 'overview';
    renderAdminView(panel);
  });

  if (el.btnTaskQueue) el.btnTaskQueue.addEventListener('click', openTaskQueueModal);
  if (el.btnHistoryLog) el.btnHistoryLog.addEventListener('click', openHistoryModal);

  if (el.historyFilterTabs) {
    el.historyFilterTabs.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        el.historyFilterTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.historyFilter = btn.dataset.status;
        renderHistoryListUI();
      });
    });
  }

  const setSidebarCollapsed = (isCollapsed) => {
    if (!el.sidebar) return;
    el.sidebar.classList.toggle('collapsed', Boolean(isCollapsed));
    localStorage.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');
    if (el.btnToggleSidebar) {
      el.btnToggleSidebar.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      el.btnToggleSidebar.title = isCollapsed ? '打开侧边栏' : '收起侧边栏';
    }
  };
  if (el.btnToggleSidebar) {
    el.btnToggleSidebar.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      setSidebarCollapsed(!el.sidebar?.classList.contains('collapsed'));
    });
  }
  if (el.btnExpandSidebar) {
    el.btnExpandSidebar.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      setSidebarCollapsed(false);
    });
  }
  setSidebarCollapsed(localStorage.getItem('sidebar_collapsed') === 'true');

  const queueFilterTabs = document.getElementById('queueFilterTabs');
  if (queueFilterTabs) {
    queueFilterTabs.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        queueFilterTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.queueFilter = btn.dataset.status;
        updateTaskQueueUI();
      });
    });
  }

  el.btnGenerateDetail.addEventListener('click', () => {
    if (state.activeDetailItem) {
      triggerVideoGeneration(state.activeDetailItem.prompt, state.activeDetailItem);
      closeDetailModal();
    }
  });

  el.btnGenerateInForm.addEventListener('click', async () => {
    const promptText = el.inputPrompt.value.trim();
    if (!promptText) {
      alert('请先填写 ⚡ AI 视频生成提示词 (Prompt)！');
      return;
    }

    let uploadedMediaUrl = null;
    if (state.uploadedVideoBlob) {
      try {
        showToast('正在上传本地参考视频至对象存储...');
        const uploadRes = await apiUploadMedia(state.uploadedVideoBlob);
        uploadedMediaUrl = uploadRes.reference || uploadRes.url;
        showToast('✅ 参考视频上传成功！');
      } catch (err) {
        alert(`参考视频上传失败: ${err.message}`);
        return;
      }
    }

    const options = {};
    if (uploadedMediaUrl) {
      options.videos = [uploadedMediaUrl];
    } else if (el.videoUrlInput.value.trim()) {
      options.videos = [el.videoUrlInput.value.trim()];
    }

    triggerVideoGeneration(promptText, null, options);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeFormModal();
      closeDetailModal();
      closeApiConfigModal();
      closeTaskQueueModal();
    }
  });
}

function setupDropZone() {
  const dropZone = el.dropZone;
  dropZone.addEventListener('click', (e) => {
    if (e.target !== el.btnRemoveVideo && !el.videoPreviewContainer.contains(e.target)) {
      el.videoFileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleVideoFileSelect(files[0]);
    }
  });

  el.videoFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleVideoFileSelect(e.target.files[0]);
    }
  });

  el.videoUrlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url && !state.uploadedVideoBlob) {
      setVideoPreviewSrc(url);
    }
  });
}

function handleVideoFileSelect(file) {
  if (!file.type.startsWith('video/')) {
    alert('请上传有效的 MP4 或 WebM 视频文件！');
    return;
  }
  state.uploadedVideoBlob = file;
  const objectUrl = URL.createObjectURL(file);
  setVideoPreviewSrc(objectUrl);
}

function setVideoPreviewSrc(src) {
  el.formVideoPreview.src = src;
  el.dropZoneContent.classList.add('hidden');
  el.videoPreviewContainer.classList.remove('hidden');
}

function removeUploadedVideo() {
  state.uploadedVideoBlob = null;
  el.formVideoPreview.removeAttribute('src');
  el.formVideoPreview.load();
  el.videoFileInput.value = '';
  el.videoUrlInput.value = '';
  el.videoPreviewContainer.classList.add('hidden');
  el.dropZoneContent.classList.remove('hidden');
}

// --- 5. 数据加载与 ERP 表格渲染 ---
async function loadPrompts() {
  let items = await PromptStore.getAll();
  if (items.length === 0) {
    for (const seed of SEED_PROMPTS) {
      await PromptStore.save(seed);
    }
    items = await PromptStore.getAll();
  }
  state.prompts = items.sort((a, b) => b.createdAt - a.createdAt);
  if (el.sidebarCount) el.sidebarCount.textContent = state.prompts.length;
  renderTable();
}

function getFilteredItems() {
  return state.prompts.filter(item => {
    if (state.filterShotSize && item.shotSize !== state.filterShotSize) return false;
    if (state.filterMovement && item.movement !== state.filterMovement) return false;
    if (state.filterAngle && item.angle !== state.filterAngle) return false;
    if (state.filterCategory && item.category !== state.filterCategory) return false;
    if (state.searchQuery) {
      const q = state.searchQuery;
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchPrompt = (item.prompt || '').toLowerCase().includes(q);
      const matchShot = (item.shotSize || '').toLowerCase().includes(q);
      const matchMove = (item.movement || '').toLowerCase().includes(q);
      const matchAngle = (item.angle || '').toLowerCase().includes(q);
      const matchCat = (item.category || '').toLowerCase().includes(q);
      if (!matchTitle && !matchPrompt && !matchShot && !matchMove && !matchAngle && !matchCat) {
        return false;
      }
    }
    return true;
  });
}

function renderTable() {
  const items = getFilteredItems();
  el.itemsCountBadge.textContent = items.length;

  if (items.length === 0) {
    el.tableBody.innerHTML = '';
    el.emptyState.classList.remove('hidden');
    return;
  }

  el.emptyState.classList.add('hidden');
  el.tableBody.innerHTML = items.map((item, index) => createTableRowHTML(item, index + 1)).join('');

  items.forEach(item => {
    const rowEl = document.getElementById(`row-${item.id}`);
    if (!rowEl) return;

    const videoEl = rowEl.querySelector('video');
    if (videoEl && item.videoBlob) {
      videoEl.dataset.lazyVideoSrc = URL.createObjectURL(item.videoBlob);
    } else if (videoEl && item.videoUrl) {
      const source = safeMediaUrl(item.videoUrl);
      if (source) videoEl.dataset.lazyVideoSrc = source;
    }
    if (videoEl) observeManagedVideos(videoEl);

    const videoCell = rowEl.querySelector('.video-cell');
    if (videoCell) {
      videoCell.addEventListener('click', event => {
        event.stopPropagation();
        if (!videoEl) return;
        if (videoEl.dataset.managedVideoActive === '1' && !videoEl.paused) {
          videoEl.pause();
          return;
        }
        activateManagedVideo(videoEl, { play: true, preload: 'auto' });
      });
    }

    // 🎯 整行智能点击进入详情
    rowEl.addEventListener('click', (e) => {
      if (e.target.closest('.btn-copy') || e.target.closest('.btn-edit') || e.target.closest('.btn-delete') || e.target.closest('.btn-ai-gen')) {
        return;
      }
      openDetailModal(item);
    });

    const btnAiGen = rowEl.querySelector('.btn-ai-gen');
    if (btnAiGen) {
      btnAiGen.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerVideoGeneration(item.prompt, item);
      });
    }

    const btnCopy = rowEl.querySelector('.btn-copy');
    if (btnCopy) {
      btnCopy.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(item.prompt);
      });
    }

    const btnEdit = rowEl.querySelector('.btn-edit');
    if (btnEdit) {
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        openFormModal(item);
      });
    }

    const btnDelete = rowEl.querySelector('.btn-delete');
    if (btnDelete) {
      btnDelete.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`确认要删除镜头“${item.title}”吗？`)) {
          await PromptStore.delete(item.id);
          await loadPrompts();
          showToast('镜头数据已成功删除');
        }
      });
    }
  });
}

function createTableRowHTML(item, index) {
  return `
    <tr id="row-${item.id}" title="点击任意位置展开镜头详情与放大视频">
      <td class="text-center font-mono" style="color: var(--text-muted); font-size: 0.75rem;">${index}</td>
      <td>
        <div class="video-cell">
          <video playsinline loop muted preload="metadata"></video>
          <div class="play-hover-overlay">▶</div>
        </div>
      </td>
      <td>
        <div class="cell-title">${escapeHTML(item.title)}</div>
      </td>
      <td>
        <div class="prompt-cell-box">
          <span class="prompt-text-snippet code-font">${escapeHTML(item.prompt)}</span>
          <button class="btn btn-copy" title="复制完整提示词">复制</button>
        </div>
      </td>
      <td><span class="badge badge-shot">${item.shotSize || '未指定'}</span></td>
      <td><span class="badge badge-movement">${item.movement || '静止镜头'}</span></td>
      <td><span class="badge badge-angle">${item.angle || '平视'}</span></td>
      <td><span class="badge badge-category">${item.category || '通用'}</span></td>
      <td class="text-center">
        <div class="table-actions">
          <button class="btn btn-primary btn-ai-gen" title="提交此 Prompt 调用在线 API 生成视频">⚡ AI生成</button>
          <button class="btn btn-secondary btn-ghost btn-edit">编辑</button>
          <button class="btn btn-danger btn-delete">删除</button>
        </div>
      </td>
    </tr>
  `;
}

// --- 6. Form Modal 控制 ---
function openFormModal(itemToEdit = null) {
  removeUploadedVideo();
  el.promptForm.reset();

  if (itemToEdit) {
    el.modalTitle.textContent = '编辑镜头提示词';
    el.editItemId.value = itemToEdit.id;
    el.inputTitle.value = itemToEdit.title || '';
    el.inputPrompt.value = itemToEdit.prompt || '';
    el.inputMotion.value = itemToEdit.motion || '中度 (4-6)';
    el.inputLighting.value = itemToEdit.lighting || '';

    setCustomDropdownValue(el.formDropdownShotSize, itemToEdit.shotSize || '特写');
    setCustomDropdownValue(el.formDropdownMovement, itemToEdit.movement || '推镜头');
    setCustomDropdownValue(el.formDropdownAngle, itemToEdit.angle || '平视角度');
    setCustomDropdownValue(el.formDropdownCategory, itemToEdit.category || '人物肖像');

    if (itemToEdit.videoBlob) {
      state.uploadedVideoBlob = itemToEdit.videoBlob;
      setVideoPreviewSrc(URL.createObjectURL(itemToEdit.videoBlob));
    } else if (itemToEdit.videoUrl) {
      const source = safeMediaUrl(itemToEdit.videoUrl);
      el.videoUrlInput.value = source;
      if (source) setVideoPreviewSrc(source);
    }
  } else {
    el.modalTitle.textContent = '新建镜头提示词';
    el.editItemId.value = '';

    setCustomDropdownValue(el.formDropdownShotSize, '特写');
    setCustomDropdownValue(el.formDropdownMovement, '推镜头');
    setCustomDropdownValue(el.formDropdownAngle, '平视角度');
    setCustomDropdownValue(el.formDropdownCategory, '人物肖像');
  }

  el.promptModal.classList.remove('hidden');
}

function closeFormModal() {
  el.promptModal.classList.add('hidden');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const id = el.editItemId.value || `prompt-${Date.now()}`;
  const requestedVideoUrl = el.videoUrlInput.value.trim();
  const videoUrl = requestedVideoUrl ? safeMediaUrl(requestedVideoUrl) : '';

  if (requestedVideoUrl && !videoUrl) {
    alert('视频 URL 无效或使用了不安全协议');
    return;
  }
  if (!state.uploadedVideoBlob && !videoUrl) {
    alert('请上传本地镜头视频或输入视频 URL！');
    return;
  }

  const existingItem = state.prompts.find(p => p.id === id);

  const item = {
    id,
    title: el.inputTitle.value.trim(),
    prompt: el.inputPrompt.value.trim(),
    shotSize: el.formDropdownShotSize.dataset.value || '特写',
    movement: el.formDropdownMovement.dataset.value || '推镜头',
    angle: el.formDropdownAngle.dataset.value || '平视角度',
    category: el.formDropdownCategory.dataset.value || '人物肖像',
    motion: el.inputMotion.value.trim(),
    lighting: el.inputLighting.value.trim(),
    videoBlob: state.uploadedVideoBlob || (existingItem ? existingItem.videoBlob : null),
    videoUrl: videoUrl,
    createdAt: existingItem ? existingItem.createdAt : Date.now(),
    updatedAt: Date.now()
  };

  await PromptStore.save(item);
  closeFormModal();
  await loadPrompts();
  showToast(existingItem ? '已修改保存' : '已保存到镜头库');
}

// --- 7. Detail Lightbox Modal ---
function openDetailModal(item) {
  state.activeDetailItem = item;
  el.detailHeading.textContent = item.title;
  el.detailPromptText.textContent = item.prompt;

  el.detailPills.innerHTML = `
    <span class="badge badge-shot">🔍 ${item.shotSize}</span>
    <span class="badge badge-movement">🎥 ${item.movement}</span>
    <span class="badge badge-angle">📐 ${item.angle}</span>
    <span class="badge badge-category">🏷️ ${item.category}</span>
  `;

  el.detailShotSizeVal.textContent = item.shotSize;
  el.detailMovementVal.textContent = item.movement;
  el.detailAngleVal.textContent = item.angle;
  el.detailCategoryVal.textContent = item.category;

  if (item.videoBlob) {
    el.detailVideoPlayer.src = URL.createObjectURL(item.videoBlob);
  } else if (item.videoUrl) {
    const source = safeMediaUrl(item.videoUrl);
    if (source) el.detailVideoPlayer.src = source;
    else el.detailVideoPlayer.removeAttribute('src');
  } else {
    el.detailVideoPlayer.removeAttribute('src');
  }

  el.detailModal.classList.remove('hidden');
}

function closeDetailModal() {
  el.detailModal.classList.add('hidden');
  el.detailVideoPlayer.pause();
  el.detailVideoPlayer.currentTime = 0;
  state.activeDetailItem = null;
}

// --- 8. 示例与导出逻辑 ---
async function seedSampleData() {
  for (const seed of SEED_PROMPTS) {
    await PromptStore.save(seed);
  }
  await loadPrompts();
  showToast('示例镜头数据已加载！');
}

async function exportDataJSON() {
  const exportItems = state.prompts.map(item => {
    const copy = { ...item };
    delete copy.videoBlob;
    return copy;
  });

  const blob = new Blob([JSON.stringify(exportItems, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PromptLens_ERP_Backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 JSON 备份文件');
}

async function importDataJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported)) {
        for (const item of imported) {
          if (item.id && item.prompt) {
            await PromptStore.save(item);
          }
        }
        await loadPrompts();
        showToast(`已成功录入 ${imported.length} 条镜头记录`);
      }
    } catch (err) {
      alert('导入失败：无效 JSON 文件');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// --- 9. 工具函数 ---
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('✨ 提示词已成功复制到剪贴板！');
  }).catch(() => {
    showToast('复制失败，请手动选择复制');
  });
}

function showToast(message, type = 'success', options = {}) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'error' ? '!' : (type === 'warning' ? '!' : '✓');
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${escapeHTML(message)}</span>${options.actionLabel ? `<button type="button" class="toast-action">${escapeHTML(options.actionLabel)}</button>` : ''}`;
  if (options.actionLabel && typeof options.onAction === 'function') {
    toast.querySelector('.toast-action')?.addEventListener('click', () => {
      options.onAction();
      toast.remove();
    });
  }
  el.toastContainer?.appendChild(toast);
  const timeoutId = setTimeout(() => toast.remove(), options.actionLabel ? 6000 : 2500);
  toast.addEventListener('remove', () => clearTimeout(timeoutId), { once: true });
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s.replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[match]));
}

function safeMediaUrl(value, options = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (options.allowDataImage && /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(raw)) return raw;
  try {
    const parsed = new URL(raw, window.location.href);
    const allowedProtocols = new Set(['https:', 'blob:']);
    const isLoopbackHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (!allowedProtocols.has(parsed.protocol) && !isLoopbackHttp) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function setSafeVideoResult(target, videoUrl, options = {}) {
  if (!target) return null;
  const source = safeMediaUrl(videoUrl);
  if (!source) {
    target.textContent = '视频地址无效或使用了不安全协议';
    target.className = 'task-error-message';
    return null;
  }
  target.replaceChildren();
  const video = document.createElement('video');
  video.className = options.videoClass || 'task-video-preview';
  video.dataset.lazyVideoSrc = source;
  video.dataset.clickVideoLoad = '1';
  video.controls = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'none';
  target.appendChild(video);
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
  const openLink = document.createElement('a');
  openLink.href = source;
  openLink.target = '_blank';
  openLink.rel = 'noopener noreferrer';
  openLink.className = 'btn btn-secondary';
  openLink.style.cssText = 'flex:1;justify-content:center;font-size:.75rem;';
  openLink.textContent = '🌐 展开大屏';
  actions.appendChild(openLink);
  if (options.onSave) {
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'btn btn-primary btn-save-kb';
    saveButton.style.cssText = 'flex:1;font-size:.75rem;';
    saveButton.textContent = '📥 快捷存入镜头库';
    saveButton.addEventListener('click', options.onSave);
    actions.appendChild(saveButton);
  }
  target.appendChild(actions);
  observeManagedVideos(target);
  return source;
}

// --- 10. AI 视频生成 API 对接引擎 (符合 api-integration-guide.md 规范) ---
function parseBaseDomain(inputUrl) {
  let urlStr = (inputUrl || '').trim();
  if (!urlStr) return 'https://ai666.live';
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = 'https://' + urlStr;
  }
  urlStr = urlStr.replace(/\/+$/, '');
  if (urlStr.endsWith('/v1/videos')) {
    urlStr = urlStr.slice(0, -'/v1/videos'.length);
  } else if (urlStr.endsWith('/v1')) {
    urlStr = urlStr.slice(0, -'/v1'.length);
  }
  return urlStr.replace(/\/+$/, '');
}

function syncApiConfigDurationInput(model, duration) {
  if (!el.cfgDefaultDuration) return;
  const isCustom = isCustomDurationVideoModel(model);
  el.cfgDefaultDuration.min = isCustom ? '4' : '5';
  el.cfgDefaultDuration.max = isCustom ? '30' : '15';
  el.cfgDefaultDuration.step = isCustom ? '1' : '5';
  el.cfgDefaultDuration.value = String(isCustom
    ? clampVideoDuration(duration, 4, 30, 15)
    : ([5, 10, 15].includes(parseInt(duration, 10)) ? parseInt(duration, 10) : 15));
  const hint = document.getElementById('cfgDefaultDurationHint');
  if (hint) hint.textContent = isCustom ? '按秒模型支持 4–30 秒任意整数' : '固定时长模型支持 5、10、15 秒';
}

function normalizedProviderMetadata(operation) {
  // 原样保留服务端已有的协议字段，避免管理员仅修改 Key 或计价时清空自定义路径。
  const metadata = state.apiConfig.providerMetadata?.[operation];
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { ...metadata } : {};
}

const API_PROVIDER_UI_META = {
  image: { label: '图片', listId: 'apiProfilesImage' },
  llm: { label: '语言', listId: 'apiProfilesLlm' },
  video: { label: '视频', listId: 'apiProfilesVideo' }
};
let apiProviderDraft = null;

function uniqueApiModels(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => String(value || '').trim()).filter(Boolean))];
}

function createEmptyApiProfile(name, index = 0) {
  return {
    id: `${name}-${Date.now()}-${index + 1}`,
    label: `${API_PROVIDER_UI_META[name]?.label || name} Key ${index + 1}`,
    baseUrl: '',
    apiKey: '',
    models: [],
    availableModels: [],
    testState: '',
    testMessage: ''
  };
}

function createApiProviderDraft() {
  const config = BackendClient.getConfig?.() || {};
  return Object.fromEntries(['image', 'llm', 'video'].map(name => {
    const provider = config[name] || {};
    let profiles = Array.isArray(provider.profiles) ? provider.profiles.map((profile, index) => ({
      id: profile.id || `${name}-${index + 1}`,
      label: profile.label || `${API_PROVIDER_UI_META[name].label} Key ${index + 1}`,
      baseUrl: profile.baseUrl || '',
      apiKey: profile.apiKey || '',
      models: uniqueApiModels(profile.models),
      availableModels: uniqueApiModels(profile.models),
      testState: '',
      testMessage: ''
    })) : [];
    if (!profiles.length && (provider.baseUrl || provider.apiKey)) {
      const models = uniqueApiModels(provider.models?.length ? provider.models : [provider.model]);
      profiles = [{ ...createEmptyApiProfile(name, 0), id: `${name}-primary`, baseUrl: provider.baseUrl || '', apiKey: provider.apiKey || '', models, availableModels: models }];
    }
    if (!profiles.length) profiles = [createEmptyApiProfile(name, 0)];
    return [name, { ...provider, profiles }];
  }));
}

function collectApiProviderDraftFromDom() {
  if (!apiProviderDraft) apiProviderDraft = createApiProviderDraft();
  Object.keys(API_PROVIDER_UI_META).forEach(name => {
    const list = document.getElementById(API_PROVIDER_UI_META[name].listId);
    if (!list) return;
    const existingById = new Map((apiProviderDraft[name]?.profiles || []).map(profile => [profile.id, profile]));
    const profiles = [...list.querySelectorAll('.api-key-card')].map((card, index) => {
      const previous = existingById.get(card.dataset.profileId) || createEmptyApiProfile(name, index);
      const allModels = [...card.querySelectorAll('input[data-api-model]')].map(input => input.value);
      const models = [...card.querySelectorAll('input[data-api-model]:checked')].map(input => input.value);
      return {
        ...previous,
        id: card.dataset.profileId,
        label: `${API_PROVIDER_UI_META[name].label} Key ${index + 1}`,
        baseUrl: card.querySelector('[data-api-base-url]')?.value.trim() || '',
        apiKey: card.querySelector('[data-api-key]')?.value.trim() || '',
        models: uniqueApiModels(models),
        availableModels: uniqueApiModels([...allModels, ...(previous.availableModels || [])])
      };
    });
    apiProviderDraft[name] = { ...(apiProviderDraft[name] || {}), profiles: profiles.length ? profiles : [createEmptyApiProfile(name, 0)] };
  });
  return apiProviderDraft;
}

function apiProfileModelsHtml(profile) {
  const availableModels = uniqueApiModels([...(profile.availableModels || []), ...(profile.models || [])]);
  if (!availableModels.length) return '<div class="api-model-empty">填写地址和 Key，然后点击“拉取模型”</div>';
  return `<div class="api-model-picker-head"><span>选择要启用的模型</span><span><button type="button" data-api-select-models="all">全选</button><button type="button" data-api-select-models="none">清空</button></span></div>
    <div class="api-model-check-grid">${availableModels.map(model => `<label class="api-model-check"><input type="checkbox" data-api-model value="${escapeHTML(model)}" ${(profile.models || []).includes(model) ? 'checked' : ''}><span>${escapeHTML(model)}</span></label>`).join('')}</div>`;
}

function renderApiProviderDraft() {
  if (!apiProviderDraft) apiProviderDraft = createApiProviderDraft();
  Object.entries(API_PROVIDER_UI_META).forEach(([name, meta]) => {
    const list = document.getElementById(meta.listId);
    if (!list) return;
    const profiles = apiProviderDraft[name]?.profiles || [createEmptyApiProfile(name, 0)];
    list.innerHTML = profiles.map((profile, index) => `
      <article class="api-key-card" data-provider="${name}" data-profile-id="${escapeHTML(profile.id)}">
        <div class="api-key-card-head"><span><b>${meta.label} Key ${index + 1}</b><small>${(profile.models || []).length ? `已启用 ${(profile.models || []).length} 个模型` : '尚未选择模型'}</small></span>${profiles.length > 1 ? '<button type="button" class="api-remove-key" data-api-remove-profile aria-label="删除这个 Key">删除</button>' : ''}</div>
        <div class="api-key-fields">
          <label><span>API 地址</span><input type="url" class="form-control code-font" data-api-base-url value="${escapeHTML(profile.baseUrl || '')}" placeholder="https://your-provider.example/v1" autocomplete="off"></label>
          <label><span>API Key</span><input type="password" class="form-control code-font" data-api-key value="${escapeHTML(profile.apiKey || '')}" placeholder="sk-..." autocomplete="new-password"></label>
        </div>
        <div class="api-key-actions"><button type="button" class="btn btn-secondary btn-sm" data-api-fetch-models ${profile.testState === 'loading' ? 'disabled' : ''}>${profile.testState === 'loading' ? '正在拉取…' : '拉取模型列表'}</button><span class="api-key-test-status ${escapeHTML(profile.testState || '')}">${escapeHTML(profile.testMessage || '')}</span></div>
        <div class="api-profile-models">${apiProfileModelsHtml(profile)}</div>
      </article>
    `).join('');

    list.querySelectorAll('[data-api-remove-profile]').forEach(button => button.addEventListener('click', () => {
      collectApiProviderDraftFromDom();
      const card = button.closest('.api-key-card');
      apiProviderDraft[name].profiles = apiProviderDraft[name].profiles.filter(profile => profile.id !== card.dataset.profileId);
      if (!apiProviderDraft[name].profiles.length) apiProviderDraft[name].profiles.push(createEmptyApiProfile(name, 0));
      renderApiProviderDraft();
    }));
    list.querySelectorAll('[data-api-select-models]').forEach(button => button.addEventListener('click', () => {
      const checked = button.dataset.apiSelectModels === 'all';
      button.closest('.api-key-card').querySelectorAll('input[data-api-model]').forEach(input => { input.checked = checked; });
      collectApiProviderDraftFromDom();
      renderApiProviderDraft();
    }));
    list.querySelectorAll('[data-api-fetch-models]').forEach(button => button.addEventListener('click', async () => {
      collectApiProviderDraftFromDom();
      const profileId = button.closest('.api-key-card').dataset.profileId;
      const profile = apiProviderDraft[name].profiles.find(item => item.id === profileId);
      if (!profile?.baseUrl || !profile?.apiKey) return showToast(`请先填写${meta.label} API 地址和 Key`, 'warning');
      profile.testState = 'loading';
      profile.testMessage = '正在连接…';
      renderApiProviderDraft();
      try {
        const result = await BackendClient.discoverProviderModels(name, profile);
        const models = uniqueApiModels(result.models);
        profile.availableModels = models;
        profile.models = uniqueApiModels(profile.models).filter(model => models.includes(model));
        if (!profile.models.length) profile.models = [...models];
        profile.testState = 'success';
        profile.testMessage = `已拉取 ${models.length} 个模型`;
      } catch (error) {
        profile.testState = 'error';
        profile.testMessage = error.message || '拉取失败';
      }
      renderApiProviderDraft();
    }));
  });
  document.querySelectorAll('[data-api-add-profile]').forEach(button => {
    button.onclick = () => {
      collectApiProviderDraftFromDom();
      const name = button.dataset.apiAddProfile;
      apiProviderDraft[name].profiles.push(createEmptyApiProfile(name, apiProviderDraft[name].profiles.length));
      renderApiProviderDraft();
    };
  });
}

async function openDynamicApiConfigModal() {
  apiProviderDraft = createApiProviderDraft();
  renderApiProviderDraft();
  el.apiConfigModal.classList.remove('hidden');
  el.apiTestResult.className = 'api-test-status success';
  el.apiTestResult.textContent = '配置按 Key 保存；模型会同步到全部创作入口。';
}

async function openApiConfigModal() {
  if (window.STANDALONE_MODE) return openDynamicApiConfigModal();
  renderApiConfigVideoModelOptions();
  const currentModel = getPreferredServerModel('creation', 'video', localStorage.getItem('api_model') || state.apiConfig.model || DEFAULT_VIDEO_MODEL);
  const currentDuration = localStorage.getItem('api_duration') || state.apiConfig.duration || 15;
  el.cfgDefaultModel.value = currentModel;
  syncApiConfigDurationInput(currentModel, currentDuration);
  if (el.cfgLlmModelName) el.cfgLlmModelName.value = state.apiConfig.llmModelName || 'gpt-5.6-sol';
  if (el.cfgImageModel) {
    const configured = getServerModels('creation', 'image').map(item => item.model).filter(model => model !== 'nano-banana-2');
    el.cfgImageModel.value = parseImageModelList(configured, DEFAULT_PRIMARY_IMAGE_MODELS).join(', ');
  }
  if (el.cfgNanoImageModels) {
    const configured = getServerModels('creation', 'image').map(item => item.model).filter(model => model === 'nano-banana-2');
    el.cfgNanoImageModels.value = parseImageModelList(configured, DEFAULT_NANO_IMAGE_MODELS).join(', ');
  }
  [
    el.cfgApiBaseUrl, el.cfgApiKey,
    el.cfgLlmBaseUrl, el.cfgLlmApiKey,
    el.cfgImageBaseUrl, el.cfgImageApiKey,
    el.cfgImage2BaseUrl, el.cfgImage2ApiKey,
    el.cfgNanoImageBaseUrl, el.cfgNanoImageApiKey
  ].forEach(input => {
    if (input) input.disabled = !BackendClient.isAdmin();
  });
  document.querySelectorAll('[data-admin-only]').forEach(node => node.classList.toggle('hidden', !BackendClient.isAdmin()));
  el.apiConfigModal.classList.remove('hidden');
  el.apiTestResult.className = 'api-test-status';
  el.apiTestResult.textContent = window.STANDALONE_MODE ? '正在读取本机 API 配置...' : '正在读取服务端模型与计价配置...';
  try {
    const pricing = await BackendClient.request('/api/pricing');
    const byKey = new Map(pricing.map(rule => [`${rule.mode || 'creation'}:${rule.operation}:${rule.model}`, rule]));
    const setCredits = (id, mode, operation, model) => {
      const input = document.getElementById(id);
      if (input) input.value = String(byKey.get(`${mode}:${operation}:${model}`)?.unitCredits ?? byKey.get(`${mode}:${operation}:${model}`)?.credits ?? 0);
    };
    setCredits('cfgVideoCredits', 'creation', 'video', currentModel);
    setCredits('cfgImageCredits', 'creation', 'image', state.apiConfig.imageModel || 'gpt-image-2');
    setCredits('cfgLlmCredits', 'creation', 'llm', state.apiConfig.llmModelName || 'gpt-5.6-sol');
    setCredits('cfgLongScriptCredits', 'long-script', 'long-script', state.apiConfig.llmModelName || 'gpt-5.6-sol');
    setCredits('cfgMultiAngleCredits', 'multi-angle', 'image', state.apiConfig.imageModel || 'gpt-image-2');
    if (BackendClient.isAdmin()) {
      const [providers, users] = await Promise.all([
        BackendClient.request('/api/admin/providers'),
        BackendClient.request('/api/admin/users')
      ]);
      const providerMap = new Map(providers.map(provider => [provider.name, provider]));
      const videoProvider = providerMap.get('video') || {};
      const llmProvider = providerMap.get('llm') || {};
      const imageProvider = providerMap.get('image') || {};
      state.apiConfig.providerMetadata = Object.fromEntries(
        ['video', 'llm', 'image'].map(name => {
          const metadata = providerMap.get(name)?.metadata;
          return [name, metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { ...metadata } : {}];
        })
      );
      if (el.cfgApiBaseUrl) el.cfgApiBaseUrl.value = videoProvider.base_url || '';
      if (el.cfgLlmBaseUrl) el.cfgLlmBaseUrl.value = llmProvider.base_url || '';
      const imageProfiles = Array.isArray(imageProvider.metadata?.profiles) ? imageProvider.metadata.profiles : [];
      const primaryProfile = imageProfiles.find(profile => profile.id === 'gpt-image') || imageProfiles[0] || {};
      const image2Profile = imageProfiles.find(profile => profile.id === 'gpt-image-2') || imageProfiles.find(profile => profile.models?.includes('gpt-image-2')) || {};
      const nanoProfile = imageProfiles.find(profile => profile.id === 'nano-banana') || imageProfiles.find(profile => profile.models?.includes('nano-banana-2')) || {};
      if (el.cfgImageBaseUrl) el.cfgImageBaseUrl.value = primaryProfile.baseUrl || imageProvider.base_url || '';
      if (el.cfgImageModel && primaryProfile.models?.length) el.cfgImageModel.value = primaryProfile.models.join(', ');
      if (el.cfgImage2BaseUrl) el.cfgImage2BaseUrl.value = image2Profile.baseUrl || imageProvider.base_url || '';
      if (el.cfgImage2Models && image2Profile.models?.length) el.cfgImage2Models.value = image2Profile.models.join(', ');
      if (el.cfgNanoImageBaseUrl) el.cfgNanoImageBaseUrl.value = nanoProfile.baseUrl || imageProvider.base_url || '';
      if (el.cfgNanoImageModels && nanoProfile.models?.length) el.cfgNanoImageModels.value = nanoProfile.models.join(', ');
      renderAdminUsers(users);
    }
    const wallet = BackendClient.getWallet();
    el.apiTestResult.className = 'api-test-status success';
    el.apiTestResult.textContent = window.STANDALONE_MODE ? 'API 配置只保存在当前浏览器；创作内容不会跨刷新保留。' : `后端已连接 · 可用 ${wallet?.balance ?? 0} 积分 · ${pricing.length} 条计价规则`;
  } catch (error) {
    el.apiTestResult.className = 'api-test-status error';
    el.apiTestResult.textContent = error.message;
  }
}

function closeApiConfigModal() {
  el.apiConfigModal.classList.add('hidden');
}

function clearStoredApiConfig() {
  if (!window.STANDALONE_MODE || typeof BackendClient.clearStoredConfig !== 'function') return;
  if (!window.confirm('确定清除这台浏览器保存的全部 API 地址、Key 和模型配置吗？')) return;
  BackendClient.clearStoredConfig();
  state.apiConfig = {
    ...state.apiConfig,
    model: DEFAULT_VIDEO_MODEL,
    duration: 5,
    llmModelName: 'gpt-5.6-sol',
    imageModel: DEFAULT_IMAGE_MODELS[0],
    imageModels: [...DEFAULT_IMAGE_MODELS]
  };
  apiProviderDraft = createApiProviderDraft();
  renderApiProviderDraft();
  void loadServerModels().then(() => applyApiConfigToChatUI());
  if (el.apiTestResult) {
    el.apiTestResult.className = 'api-test-status success';
    el.apiTestResult.textContent = '本机 API 配置已清除。';
  }
  showToast('本机 API 配置已清除', 'success');
}

function renderAdminUsers(users = []) {
  const panel = document.getElementById('adminUsersPanel');
  if (!panel) return;
  panel.innerHTML = `<div style="font-weight: 700; margin-bottom: 8px;">用户积分</div>${users.map(user => `
    <div class="admin-user-row" style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid #dbeafe;font-size:.8rem;">
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(user.username)} · ${user.balance} 可用 / ${user.reserved} 预扣</span>
      <input class="form-control admin-grant-input" data-user-id="${user.id}" type="number" min="1" step="1" placeholder="赠送" style="width:78px;padding:5px 7px;">
      <button type="button" class="btn btn-secondary btn-sm admin-grant-btn" data-user-id="${user.id}">赠送</button>
    </div>`).join('') || '<span style="color:var(--text-muted)">暂无用户</span>'}`;
  panel.querySelectorAll('.admin-grant-btn').forEach(button => button.addEventListener('click', async () => {
    const input = panel.querySelector(`.admin-grant-input[data-user-id="${button.dataset.userId}"]`);
    const amount = Number(input?.value || 0);
    if (!Number.isSafeInteger(amount) || amount <= 0) return showToast('请输入正整数积分', 'warning');
    try {
      await BackendClient.request('/api/admin/credits/grant', { method: 'POST', body: JSON.stringify({ userId: button.dataset.userId, amount, requestId: `grant_${button.dataset.userId}_${Date.now()}` }) });
      showToast('积分已赠送');
      await BackendClient.refreshWallet();
      await openApiConfigModal();
    } catch (error) { showToast(`赠送失败：${error.message}`, 'error'); }
  }));
}

async function saveDynamicApiConfig() {
  const draft = collectApiProviderDraftFromDom();
  const previousConfig = BackendClient.getConfig?.() || {};
  const nextConfig = {};
  try {
    Object.entries(API_PROVIDER_UI_META).forEach(([name, meta]) => {
      const profiles = (draft[name]?.profiles || []).filter(profile => profile.baseUrl || profile.apiKey).map((profile, index) => {
        if (!profile.baseUrl || !profile.apiKey) throw new Error(`${meta.label} Key ${index + 1} 的地址或 Key 未填写完整`);
        if (!profile.models.length) throw new Error(`${meta.label} Key ${index + 1} 尚未选择模型，请先拉取模型列表`);
        return {
          id: profile.id || `${name}-${index + 1}`,
          label: `${meta.label} Key ${index + 1}`,
          baseUrl: profile.baseUrl,
          apiKey: profile.apiKey,
          models: uniqueApiModels(profile.models)
        };
      });
      const owners = new Map();
      profiles.forEach((profile, index) => profile.models.forEach(model => {
        if (owners.has(model)) throw new Error(`${meta.label}模型“${model}”同时选在 Key ${owners.get(model) + 1} 和 Key ${index + 1}，请只保留一个`);
        owners.set(model, index);
      }));
      const models = uniqueApiModels(profiles.flatMap(profile => profile.models));
      const oldDefault = previousConfig[name]?.model;
      const model = models.includes(oldDefault) ? oldDefault : (models[0] || '');
      const defaultProfile = profiles.find(profile => profile.models.includes(model)) || profiles[0];
      nextConfig[name] = {
        ...(previousConfig[name] || {}),
        baseUrl: defaultProfile?.baseUrl || '',
        apiKey: defaultProfile?.apiKey || '',
        model,
        models,
        profiles
      };
    });

    BackendClient.saveConfig(nextConfig);
    const videoModel = nextConfig.video.model || '';
    const llmModel = nextConfig.llm.model || '';
    const imageModel = nextConfig.image.model || '';
    state.apiConfig = {
      ...state.apiConfig,
      model: videoModel,
      llmModelName: llmModel,
      imageModel,
      imageModels: nextConfig.image.models
    };
    localStorage.setItem('api_model', videoModel);
    localStorage.setItem('api_llmModelName', llmModel);
    localStorage.setItem('api_imageModel', imageModel);
    localStorage.setItem('api_imageModels', JSON.stringify(nextConfig.image.models));
    await loadServerModels();
    applyApiConfigToChatUI();
    closeApiConfigModal();
    showToast('API Key 与模型配置已保存，并同步到全部创作入口', 'success');
  } catch (error) {
    el.apiTestResult.className = 'api-test-status error';
    el.apiTestResult.textContent = error.message || '保存失败';
    showToast(`保存失败：${error.message}`, 'error');
  }
}

async function saveApiConfig() {
  if (window.STANDALONE_MODE) return saveDynamicApiConfig();
  const model = el.cfgDefaultModel.value;
  const requestedDuration = parseInt(el.cfgDefaultDuration?.value || state.apiConfig.duration || 15, 10);
  const duration = isCustomDurationVideoModel(model)
    ? clampVideoDuration(requestedDuration, 4, 30, 15)
    : ([5, 10, 15].includes(requestedDuration) ? requestedDuration : 15);
  const llmModelName = el.cfgLlmModelName?.value.trim() || 'gpt-5.6-sol';
  const primaryImageModels = parseImageModelList(el.cfgImageModel?.value, DEFAULT_PRIMARY_IMAGE_MODELS);
  const image2ImageModels = parseImageModelList(el.cfgImage2Models?.value, DEFAULT_IMAGE2_IMAGE_MODELS);
  const nanoImageModels = parseImageModelList(el.cfgNanoImageModels?.value, DEFAULT_NANO_IMAGE_MODELS);
  const imageModels = [...new Set([...image2ImageModels, ...primaryImageModels, ...nanoImageModels])];
  const imageModel = imageModels[0];
  state.apiConfig = { ...state.apiConfig, model, duration, llmModelName, imageModel, imageModels };
  localStorage.setItem('api_model', model);
  localStorage.setItem('api_duration', String(duration));
  localStorage.setItem('api_llmModelName', llmModelName);
  localStorage.setItem('api_imageModel', imageModel);
  localStorage.setItem('api_imageModels', JSON.stringify(imageModels));
  try {
    if (BackendClient.isAdmin()) {
      const imageProfiles = [
        {
          id: 'gpt-image',
          label: 'GPT Image 2.5',
          baseUrl: el.cfgImageBaseUrl?.value.trim(),
          apiKey: el.cfgImageApiKey?.value.trim(),
          models: primaryImageModels
        },
        {
          id: 'gpt-image-2',
          label: 'GPT Image 2',
          baseUrl: el.cfgImage2BaseUrl?.value.trim(),
          apiKey: el.cfgImage2ApiKey?.value.trim(),
          models: image2ImageModels
        },
        {
          id: 'nano-banana',
          label: 'Nano Banana',
          baseUrl: el.cfgNanoImageBaseUrl?.value.trim(),
          apiKey: el.cfgNanoImageApiKey?.value.trim(),
          models: nanoImageModels
        }
      ];
      const providers = [
        { name: 'video', baseUrl: el.cfgApiBaseUrl?.value.trim(), apiKey: el.cfgApiKey?.value.trim(), metadata: normalizedProviderMetadata('video') },
        { name: 'llm', baseUrl: el.cfgLlmBaseUrl?.value.trim(), apiKey: el.cfgLlmApiKey?.value.trim(), metadata: normalizedProviderMetadata('llm') },
        { name: 'image', baseUrl: el.cfgImageBaseUrl?.value.trim(), apiKey: el.cfgImageApiKey?.value.trim(), metadata: { ...normalizedProviderMetadata('image'), models: imageModels, profiles: imageProfiles } }
      ].filter(provider => provider.baseUrl);
      for (const provider of providers) {
        await BackendClient.request('/api/admin/providers', {
          method: 'POST',
          body: JSON.stringify({ ...provider, enabled: true })
        });
      }
      const imagePricing = ['creation', 'canvas', 'multi-angle'].flatMap(mode => imageModels.map(currentImageModel => ({
        mode,
        operation: 'image',
        model: currentImageModel,
        unit: 'image',
        credits: Number(document.getElementById(mode === 'multi-angle' ? 'cfgMultiAngleCredits' : 'cfgImageCredits')?.value || 0),
        metadata: { description: mode === 'multi-angle' ? '多角度创作图片' : '创作图片' }
      })));
      const pricing = [
        { mode: 'creation', operation: 'video', model, unit: 'second', credits: Number(document.getElementById('cfgVideoCredits')?.value || 0) },
        { mode: 'creation', operation: 'llm', model: llmModelName, unit: 'request', credits: Number(document.getElementById('cfgLlmCredits')?.value || 0) },
        { mode: 'long-script', operation: 'long-script', model: llmModelName, unit: 'request', credits: Number(document.getElementById('cfgLongScriptCredits')?.value || 0) },
        { mode: 'canvas', operation: 'video', model, unit: 'second', credits: Number(document.getElementById('cfgVideoCredits')?.value || 0), metadata: { description: '画布视频节点' } },
        ...imagePricing
      ];
      for (const rule of pricing) {
        await BackendClient.request('/api/admin/pricing', { method: 'PATCH', body: JSON.stringify(rule) });
      }
      const modelConfigs = [
        { mode: 'creation', operation: 'video', model, displayName: `${model} 视频生成`, providerName: 'video', isDefault: true },
        { mode: 'canvas', operation: 'video', model, displayName: `${model} 画布视频`, providerName: 'video', isDefault: true }
      ];
      ['creation', 'canvas', 'multi-angle'].forEach(imageMode => {
        imageModels.forEach(currentImageModel => modelConfigs.push({
          mode: imageMode,
          operation: 'image',
          model: currentImageModel,
          displayName: currentImageModel,
          providerName: 'image',
          isDefault: currentImageModel === imageModel
        }));
      });
      for (const modelConfig of modelConfigs) {
        await BackendClient.request('/api/admin/models', { method: 'POST', body: JSON.stringify({ ...modelConfig, isActive: true }) });
      }
      await loadServerModels();
    }
    applyApiConfigToChatUI();
    closeApiConfigModal();
    showToast(window.STANDALONE_MODE ? 'API 配置已保存到当前浏览器' : (BackendClient.isAdmin() ? '服务端配置与计价已保存' : '模型偏好已保存'));
  } catch (error) {
    showToast(`保存失败：${error.message}`, 'error');
  }
}

function applyApiConfigToChatUI() {
  const savedModel = localStorage.getItem('api_model') || (state.apiConfig && state.apiConfig.model) || DEFAULT_VIDEO_MODEL;
  const savedDuration = localStorage.getItem('api_duration') || ((state.apiConfig && state.apiConfig.duration) ? state.apiConfig.duration.toString() : '15');

  if (state.apiConfig) {
    state.apiConfig.model = savedModel;
    state.apiConfig.duration = parseInt(savedDuration, 10);
  }

  // 1. 同步更新聊天面板模型下拉控件
  const modelDropdown = document.getElementById('chatModelDropdown');
  const chatModelSelect = document.getElementById('chatModelSelect');

  if (modelDropdown) {
    modelDropdown.dataset.value = savedModel;
    const labelSpan = modelDropdown.querySelector('.pill-label');
    const options = modelDropdown.querySelectorAll('.pill-option');
    options.forEach(opt => {
      const isMatch = (opt.dataset.value === savedModel);
      opt.classList.toggle('active', isMatch);
      if (isMatch && labelSpan) {
        const nameNode = opt.querySelector('.opt-name');
        labelSpan.textContent = nameNode ? nameNode.textContent.trim() : savedModel;
      }
    });
  }
  if (chatModelSelect) chatModelSelect.value = savedModel;

  // 2. 根据模型切换固定时长或 4–30 秒自定义时长控件
  const normalizedDuration = syncChatDurationControl(savedModel, savedDuration);
  if (state.apiConfig) state.apiConfig.duration = normalizedDuration;

  const savedImageAspect = CHAT_IMAGE_SIZE_BY_ASPECT[state.chatImageAspect] ? state.chatImageAspect : '1:1';
  state.chatImageAspect = savedImageAspect;
  const imageAspectSegment = document.getElementById('chatImageAspectSegment');
  if (imageAspectSegment) {
    imageAspectSegment.dataset.value = savedImageAspect;
    imageAspectSegment.querySelectorAll('.segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === savedImageAspect);
    });
  }
  if (el.chatImageAspectSelect) el.chatImageAspectSelect.value = savedImageAspect;
  syncChatImageCount(state.chatImageCount, { persist: false });
  syncChatGenerationMode(state.chatGenerationMode, { persist: false });

  // 同步更新长剧本页面模型标签
  updateLongScriptModelBadge();
}

async function apiTestConnection() {
  el.apiTestResult.className = 'api-test-status';
  el.apiTestResult.classList.remove('hidden');
  el.apiTestResult.textContent = '正在测试后端、账号、钱包与计价服务...';
  try {
    const [health, wallet, pricing] = await Promise.all([
      fetch(`${BackendClient.baseUrl}/health`).then(response => response.json()),
      BackendClient.refreshWallet(),
      BackendClient.request('/api/pricing')
    ]);
    el.apiTestResult.className = 'api-test-status success';
    el.apiTestResult.textContent = `后端正常 · ${health.data.providerMode === 'real' ? '真实供应商模式' : '生成已禁用（禁止模拟生成）'} · 可用 ${wallet.balance} 积分 · ${pricing.length} 条计价规则`;
  } catch (error) {
    el.apiTestResult.className = 'api-test-status error';
    el.apiTestResult.textContent = `后端连接失败：${error.message}`;
  }
}

async function apiCallLlmExpandPrompt(rawPrompt, onChunk = null) {
  const systemPrompt = `你是一个顶级的电影导演与 AI 视频 Prompt 专家。请将用户的简单描述进行专业级别的视频画质、面部微表情、肢体动作、环境细节、光影质感和镜头语言扩写。保持原始意图，直接输出最终 Prompt。`;
  try {
    const result = await backendGenerateText({
      model: state.apiConfig.llmModelName,
      prompt: rawPrompt,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawPrompt }
      ]
    });
    const expanded = result.trim();
    if (!expanded) throw new Error('API 未返回有效扩写结果');
    if (onChunk) onChunk(expanded);
    return expanded;
  } catch (error) {
    console.warn('服务端 LLM 扩写失败:', error.message);
    throw error;
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

async function apiUploadMedia(file, onProgress = null) {
  if (!file) throw new Error('请选择要上传的文件');
  if (window.STANDALONE_MODE && typeof BackendClient.uploadReferenceMedia === 'function') {
    return BackendClient.uploadReferenceMedia(file, onProgress);
  }
  if (!BackendClient.isAuthenticated()) throw new Error('请先登录后再上传文件');
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const endpoint = `${BackendClient.baseUrl}/api/reference-media/uploads?filename=${encodeURIComponent(file.name || 'reference-media')}`;
    request.open('POST', endpoint, true);
    request.timeout = 120000;
    request.setRequestHeader('Authorization', `Bearer ${BackendClient.getToken()}`);
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    request.upload.onprogress = event => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error('媒体上传连接失败'));
    request.ontimeout = () => reject(new Error('媒体上传超时，请检查网络后重试'));
    request.onabort = () => reject(new DOMException('上传已取消', 'AbortError'));
    request.onload = () => {
      let payload = null;
      try { payload = request.responseText ? JSON.parse(request.responseText) : null; } catch (error) {}
      if (request.status < 200 || request.status >= 300) {
        return reject(new Error(payload?.error?.message || request.responseText || `媒体上传失败 (HTTP ${request.status})`));
      }
      const result = payload?.data || payload;
      if (!result?.reference || !result?.url) return reject(new Error('媒体上传成功，但服务器没有返回引用地址'));
      resolve({
        ...result,
        url: /^https?:\/\//i.test(result.url) ? result.url : `${BackendClient.baseUrl}${result.url}`
      });
    };
    request.send(file);
  });
}

function extractVideoTaskId(response) {
  const taskId = response?.task?.id
    || response?.id
    || response?.task_id
    || response?.taskId
    || response?.data?.id
    || response?.data?.task_id
    || response?.data?.taskId;
  return typeof taskId === 'string' && taskId.trim() ? taskId.trim() : null;
}

async function apiSubmitVideo(prompt, options = {}) {
  const mode = options.mode || 'creation';
  const model = options.model || state.apiConfig.model || DEFAULT_VIDEO_MODEL;
  const requestedDuration = parseInt(options.duration || state.apiConfig.duration || '15', 10);
  const duration = isCustomDurationVideoModel(model)
    ? clampVideoDuration(requestedDuration, 4, 30, 5)
    : requestedDuration;
  const input = {
    duration,
    resolution: options.resolution || '720p',
    n: 1,
    ...(mode === 'canvas' ? {
      client_context: {
        session_id: options.sessionId || undefined,
        node_id: options.canvasNodeId || undefined
      }
    } : {}),
    metadata: {
      aspect_ratio: options.aspectRatio || '16:9',
      client_session_id: options.sessionId || undefined
    }
  };
  if (options.images?.length) input.images = options.images;
  if (options.videos?.length) input.videos = options.videos;
  if (options.audios?.length) input.audios = options.audios;
  const result = await BackendClient.createGeneration({
      mode,
      operation: 'video',
    model,
    prompt,
    input,
    duration,
    signal: options.signal
  });
  return { ...result.task, task: result.task, pricing: result.pricing, duplicate: result.duplicate };
}


function parseVideoTaskResponse(info, startTime = Date.now()) {
  if (!info) return { status: 'in_progress', progress: 10, videoUrl: null, errorMsg: null };

  const rawStatus = (info.status || info.task_status || info.state || (info.data && info.data.status) || 'in_progress').toString().toLowerCase();
  
  let normalizedStatus = 'in_progress';
  if (['completed', 'success', 'successful', 'succeeded', 'done', 'finished'].includes(rawStatus)) {
    normalizedStatus = 'completed';
  } else if (rawStatus === 'refunded') {
    normalizedStatus = 'refunded';
  } else if (rawStatus === 'reconciling') {
    normalizedStatus = 'reconciling';
  } else if (rawStatus === 'needs_review') {
    normalizedStatus = 'needs_review';
  } else if (['failed', 'error', 'canceled', 'cancelled'].includes(rawStatus)) {
    normalizedStatus = rawStatus.startsWith('cancel') ? 'canceled' : 'failed';
  } else if (['queued', 'pending', 'waiting'].includes(rawStatus)) {
    normalizedStatus = 'queued';
  }

  let videoUrl = null;
  if (info.metadata && info.metadata.url) videoUrl = info.metadata.url;
  else if (info.video_url) videoUrl = info.video_url;
  else if (info.url) videoUrl = info.url;
  else if (info.output?.url || info.output?.video_url) videoUrl = info.output.url || info.output.video_url;
  else if (typeof info.output === 'string') videoUrl = info.output;
  else if (info.data && (info.data.url || info.data.video_url)) videoUrl = info.data.url || info.data.video_url;
  else if (Array.isArray(info.videos) && info.videos[0]) videoUrl = typeof info.videos[0] === 'string' ? info.videos[0] : (info.videos[0].url || info.videos[0].video_url);
  if (videoUrl) videoUrl = safeMediaUrl(videoUrl) || null;

  if (videoUrl && normalizedStatus !== 'failed') {
    normalizedStatus = 'completed';
  }

  let progress = 0;
  let rawProgress = info.progress !== undefined ? info.progress : (info.task_progress || info.percentage || (info.data && info.data.progress));
  if (typeof rawProgress === 'string') {
    rawProgress = parseInt(rawProgress.replace('%', ''), 10) || 0;
  }
  if (typeof rawProgress === 'number') {
    if (rawProgress > 0 && rawProgress <= 1) {
      progress = Math.round(rawProgress * 100);
    } else {
      progress = Math.min(100, Math.max(0, Math.round(rawProgress)));
    }
  }

  if (normalizedStatus === 'completed') {
    progress = 100;
  } else if (!['failed', 'refunded', 'canceled'].includes(normalizedStatus)) {
    const elapsedSec = (Date.now() - startTime) / 1000;
    const estimatedProgress = Math.min(92, Math.round(8 + (elapsedSec / 45) * 84));
    progress = Math.max(progress, estimatedProgress);
  }

  let errorMsg = (info.error && (info.error.message || info.error)) || info.message || (typeof info.error === 'string' ? info.error : null);

  return { status: normalizedStatus, progress, videoUrl, errorMsg };
}

async function apiPollVideo(taskId) {
  const task = await BackendClient.getGeneration(taskId);
  const providerProgress = task.output?.progress ?? task.progress ?? null;
  return {
    ...task,
    ...(task.output || {}),
    status: task.status,
    progress: task.status === 'completed'
      ? 100
      : (providerProgress === null ? 0 : Number(providerProgress)),
    error: task.errorMessage ? { message: task.errorMessage } : null
  };
}

async function triggerVideoGeneration(promptText, promptItem = null, options = {}) {
  showToast('🚀 已提交 AI 视频生成任务，正在发起 API 请求...');

  const originSession = SessionSystem.getActive();
  const originSessionId = originSession?.type === 'creation' ? originSession.id : null;
  const requestOptions = { ...options };
  const model = requestOptions.model || state.apiConfig.model || 'c1';
  const duration = requestOptions.duration || state.apiConfig.duration || 5;
  const controller = new AbortController();
  if (originSessionId) SessionSystem.registerPendingRequest(originSessionId, controller);

  try {
    const res = await apiSubmitVideo(promptText, { ...requestOptions, sessionId: originSessionId, signal: controller.signal });
    if (controller.signal.aborted) return;
    const taskId = extractVideoTaskId(res);
    const newTask = SessionSystem.assignTask({
      source: 'chat',
      mediaType: 'video',
      taskId,
      prompt: promptText,
      model,
      duration,
      options: requestOptions,
      status: res.status || 'queued',
      progress: res.progress || 0,
      reservedCredits: res.reservedCredits || res.pricing?.credits || 0,
      consumedCredits: res.consumedCredits || 0,
      pricing: res.pricing || null,
      createdAt: Date.now(),
      targetPromptId: promptItem ? promptItem.id : null,
      videoUrl: null,
      errorMsg: null,
      sessionId: originSessionId,
      sessionType: 'creation'
    }, 'creation');

    state.activeTasks.unshift(newTask);
    try {
      await SessionSystem.trackTask(newTask);
    } catch (error) {
      console.warn('Queued video task session save failed:', error);
    }
    SessionSystem.scheduleSave();
    updateTaskQueueUI();
    updateStatusIndicators();
    showToast(`⚡ 视频生成任务已进入队列 [ID: ${taskId.slice(0, 10)}...]`);
    openTaskQueueModal();
  } catch (err) {
    if (controller.signal.aborted) return;
    const failedTask = SessionSystem.assignTask({
      source: 'chat',
      mediaType: 'video',
      taskId: `fail_${Date.now()}`,
      prompt: promptText,
      model,
      duration,
      options: requestOptions,
      status: 'failed',
      progress: 100,
      createdAt: Date.now(),
      errorMsg: err.message,
      videoUrl: null,
      sessionId: originSessionId,
      sessionType: 'creation'
    }, 'creation');
    saveTaskToHistory(failedTask);
    void SessionSystem.handleTaskFinished(failedTask, 'failed').catch(error => console.warn('Failed video task session save failed:', error));
    alert(`AI 视频生成提交失败: ${err.message}`);
  } finally {
    if (originSessionId) SessionSystem.unregisterPendingRequest(originSessionId, controller);
  }
}

function openTaskQueueModal() {
    updateTaskQueueUI();
    syncCreationSubmitButtonState();
  }

function closeTaskQueueModal() {}

function updateTaskQueueUI() {
  if (el.taskQueueCount) el.taskQueueCount.textContent = state.activeTasks.length;
  if (el.taskQueuePageCount) el.taskQueuePageCount.textContent = state.activeTasks.length;
  if (!el.taskListContainer) return;

  const filter = state.queueFilter || 'all';
  let filteredTasks = state.activeTasks;
  if (filter !== 'all') {
    filteredTasks = state.activeTasks.filter(t => t.status === filter);
  }

  if (filteredTasks.length === 0) {
    el.taskListContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 60px 16px; font-size: 0.9rem;">暂无匹配的生成任务</div>';
    return;
  }

  el.taskListContainer.innerHTML = `
    <div class="apple-grid-layout">
      ${filteredTasks.map(t => {
        const progressVal = Math.max(t.progress || 0, 5);
        return `
          <div class="apple-queue-card queue-card-item" data-taskid="${t.taskId}" data-prompt="${escapeHTML(t.prompt)}" title="点击跳转至对话界面">
            <div class="apple-card-header">
              <span class="apple-id-pill">ID: ${t.taskId.slice(0, 14)}...</span>
              <span class="apple-status-badge ${t.status}">${renderStatusText(t.status)}</span>
            </div>

            <div class="apple-prompt-box">
              ⚡ ${escapeHTML(t.prompt)}
            </div>

            <div class="apple-progress-section">
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
                <span>渲染进度</span>
                <span style="font-weight: 700; color: var(--primary);">${t.progress || 0}%</span>
              </div>
              <div class="apple-progress-track">
                <div class="apple-progress-bar" style="width: ${progressVal}%;"></div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="apple-meta-pills">
                <span class="apple-meta-pill">🤖 ${t.model || 'c1'}</span>
                <span class="apple-meta-pill">⏱️ ${t.duration || 5}s</span>
                ${t.options && t.options.aspectRatio ? `<span class="apple-meta-pill">📐 ${t.options.aspectRatio}</span>` : ''}
              </div>
              <button type="button" class="btn btn-secondary btn-sm btn-jump-chat-q" data-taskid="${t.taskId}" data-prompt="${escapeHTML(t.prompt)}" style="font-size: 0.75rem; padding: 4px 10px;">💬 跳转对话</button>
            </div>
            ${renderTaskCreditBreakdown(t)}
          </div>
        `;
      }).join('')}
    </div>
  `;

  el.taskListContainer.querySelectorAll('.queue-card-item').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
      jumpToTaskInChat(card.dataset.taskid, card.dataset.prompt);
    });
  });

  el.taskListContainer.querySelectorAll('.btn-jump-chat-q').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      jumpToTaskInChat(btn.dataset.taskid, btn.dataset.prompt);
    });
  });
}

function renderStatusText(status) {
  switch (status) {
    case 'queued': return '<span class="dot-status gray" style="margin-right: 4px;"></span>⏳ 排队中';
    case 'in_progress':
    case 'running': return '<span class="spin-icon" style="margin-right: 4px;">🔄</span>⚡ 生成中';
    case 'reconciling': return '<span class="spin-icon" style="margin-right: 4px;">🔄</span>网络波动，自动恢复中';
    case 'needs_review': return '<span class="dot-status gray" style="margin-right: 4px;"></span>等待供应商状态确认';
    case 'completed': return '<span class="dot-status green" style="margin-right: 4px;"></span>✅ 生成完成';
    case 'refunded': return '<span class="dot-status red" style="margin-right: 4px;"></span>↩ 已退款';
    case 'failed': return '<span class="dot-status red" style="margin-right: 4px;"></span>❌ 生成失败';
    default: return status;
  }
}

function applyBackendTaskBilling(target, backendTask, pricing = null) {
  if (!target || !backendTask) return target;
  target.backendTaskId = backendTask.id || target.backendTaskId || target.taskId;
  target.reservedCredits = Number(backendTask.reservedCredits ?? pricing?.credits ?? target.reservedCredits ?? 0);
  target.consumedCredits = Number(backendTask.consumedCredits ?? target.consumedCredits ?? 0);
  target.pricing = pricing || target.pricing || null;
  target.mode = backendTask.mode || target.mode || target.sessionType || 'creation';
  target.operation = backendTask.operation || target.operation || target.mediaType || 'video';
  return target;
}

function renderTaskCreditBreakdown(task) {
  const reserved = Number(task?.reservedCredits || 0);
  const consumed = Number(task?.consumedCredits || 0);
  const status = task?.status;
  if (!reserved && !consumed) return '';
  let settlement = `<span>预扣 <strong>${reserved}</strong> 积分</span>`;
  if (status === 'completed') settlement += `<span class="credit-consumed">已结算 <strong>${consumed || reserved}</strong> 积分</span>`;
  else if (status === 'failed' || status === 'refunded' || status === 'canceled') settlement += `<span class="credit-refunded">已释放/退回 <strong>${reserved}</strong> 积分</span>`;
  else settlement += '<span class="credit-pending">等待结算</span>';
  return `<div class="task-credit-breakdown">${settlement}</div>`;
}

function updateStatusIndicators() {
  // 1. 队列状态与旋转图标
  const pendingTasks = state.activeTasks.filter(t => ['queued', 'in_progress', 'running', 'rendering', 'paused', 'reconciling', 'needs_review'].includes(t.status));
  const isPending = pendingTasks.length > 0;

  if (el.queueSpinIcon) {
    el.queueSpinIcon.classList.toggle('hidden', !isPending);
  }
  if (el.queueDotIcon) {
    el.queueDotIcon.classList.toggle('hidden', isPending);
  }
  if (el.subQueueCount) {
    el.subQueueCount.textContent = pendingTasks.length;
  }
  if (el.taskQueueCount) {
    el.taskQueueCount.textContent = pendingTasks.length;
  }

  // 2. 历史最新状态点提示 (绿点/红点)
  if (el.subHistoryCount) {
    el.subHistoryCount.textContent = state.taskHistory.length;
  }
  if (el.historyCount) {
    el.historyCount.textContent = state.taskHistory.length;
  }

  if (el.subHistoryDot) {
    if (state.latestFinishedStatus === 'completed') {
      el.subHistoryDot.className = 'dot-status green';
      el.subHistoryDot.title = '最新视频生成成功 (绿点提示)';
    } else if (state.latestFinishedStatus === 'failed') {
      el.subHistoryDot.className = 'dot-status red';
      el.subHistoryDot.title = '最新视频生成失败 (红点提示)';
    } else {
      el.subHistoryDot.className = 'dot-status gray';
      el.subHistoryDot.title = '暂无生成记录';
    }
  }
}

function completeTask(taskId, status, videoUrl = null, errorMsg = null, fallbackPrompt = '', fallbackModel = 'c1', backendTask = null) {
  // 1. 查找在 activeTasks 或 taskHistory 中的既有任务信息
  let task = state.activeTasks.find(t => t.taskId === taskId) || state.taskHistory.find(h => h.taskId === taskId);
  
  if (!task) {
    task = {
      taskId: taskId,
      prompt: fallbackPrompt,
      model: fallbackModel,
      duration: 5,
      createdAt: Date.now()
    };
  }

  // 2. 更新任务对象字段
  const normalizedVideoUrl = videoUrl ? safeMediaUrl(videoUrl) : '';
  if (status === 'completed' && videoUrl && !normalizedVideoUrl) {
    status = 'failed';
    errorMsg = '供应商返回了不安全的视频地址';
  }
  task.status = status;
  task.progress = 100;
  if (normalizedVideoUrl) task.videoUrl = normalizedVideoUrl;
  else if (status === 'failed') delete task.videoUrl;
  if (errorMsg) task.errorMsg = errorMsg;
  if (backendTask) applyBackendTaskBilling(task, backendTask);

  // 3. 从 activeTasks 队列中移除
  state.activeTasks = state.activeTasks.filter(t => t.taskId !== taskId);

  // 4. 保存移入 taskHistory
  const idx = state.taskHistory.findIndex(h => h.taskId === taskId);
  const now = Date.now();
  if (idx >= 0) {
    state.taskHistory[idx] = { ...state.taskHistory[idx], ...task, updatedAt: now };
  } else {
    state.taskHistory.unshift({ ...task, createdAt: task.createdAt || now, updatedAt: now });
  }

  // 5. 最多持久化存储 300 条完整日志
  state.taskHistory = state.taskHistory.slice(0, 300);
  state.latestFinishedStatus = status;
  localStorage.setItem('api_latest_status', status);
  localStorage.setItem('api_task_history', JSON.stringify(state.taskHistory));

  // 6. 实时刷新 UI
  updateTaskQueueUI();
  updateStatusIndicators();
  void SessionSystem.handleTaskFinished(task, status).catch(error => console.warn('Finished task session save failed:', error));
  syncCreationSubmitButtonState();
  return task;
}

function startTaskQueuePoller() {
  setInterval(async () => {
    const runningStatuses = new Set(['queued', 'in_progress', 'running', 'rendering', 'paused', 'reconciling', 'needs_review']);
    const pendingTasks = [...state.activeTasks.filter(task => runningStatuses.has(task.status))];
    updateStatusIndicators();
    if (pendingTasks.length === 0) return;

    for (const task of pendingTasks) {
      if (SessionSystem.isTaskCanceled(task.taskId)) continue;
      // 图片任务由 submitChatImageGeneration 负责保存结果和更新会话卡片。
      // 这里按视频逻辑完成图片任务会提前移除规范任务对象，导致图片结果无法持久化。
      if (task.mediaType === 'image' || task.operation === 'image') continue;
      // 正常卡片轮询存在时不重复请求；若轮询丢失且卡片可见，立即重建卡片轮询。
      if (SessionSystem.hasPoller(task.taskId)) continue;
      const liveCard = document.getElementById(`task-card-${task.taskId}`);
      if (liveCard && task.source !== 'canvas') {
        startChatCardPoller(task.taskId, liveCard, task.prompt || '', task.model || state.apiConfig.model);
        continue;
      }
      // 必须用后端 UUID 查询，前端 taskId（image_xxx/video_xxx）会导致后端 500
      const pollId = task.backendTaskId || task.taskId;
      if (!pollId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pollId)) continue;
      try {
        const info = await apiPollVideo(pollId);
        if (SessionSystem.isTaskCanceled(task.taskId)) continue;
        const parsed = parseVideoTaskResponse(info, Number(task.createdAt || Date.now()));
        task.status = parsed.status || task.status;
        task.progress = ['completed', 'failed', 'refunded', 'canceled'].includes(parsed.status)
          ? parsed.progress
          : Math.max(Number(task.progress || 0), Number(parsed.progress || 0));
        applyBackendTaskBilling(task, info);

        if (parsed.status === 'completed') {
          completeTask(task.taskId, 'completed', parsed.videoUrl, null, task.prompt, task.model, info);
          showToast(`🎉 视频生成完成 [ID: ${task.taskId.slice(0, 8)}...]`);

          if (task.targetPromptId) {
            const item = state.prompts.find(p => p.id === task.targetPromptId);
            if (item) {
              item.videoUrl = parsed.videoUrl;
              item.updatedAt = Date.now();
              await PromptStore.save(item);
              renderTable();
            }
          }
          await SessionSystem.reconcileBackendGenerationTasks();
        } else if (['failed', 'refunded', 'canceled'].includes(parsed.status)) {
          const errMsg = parsed.errorMsg || (parsed.status === 'canceled' ? '任务已取消' : '生成失败，积分已退回');
          completeTask(task.taskId, parsed.status, null, errMsg, task.prompt, task.model, info);
          showToast(`❌ 任务失败: ${errMsg}`);
          await SessionSystem.reconcileBackendGenerationTasks();
        } else {
          void SessionSystem.trackTask(task).catch(error => console.warn('Fallback task state save failed:', error));
        }
      } catch (err) {
        console.error('Task poll error:', err);
      }
    }
    updateTaskQueueUI();
    updateStatusIndicators();
  }, 3500);
}

// --- 12. 全量生成历史持久化与 UI 控制 ---
function saveTaskToHistory(task) {
  const idx = state.taskHistory.findIndex(h => h.taskId === task.taskId);
  const now = Date.now();
  if (idx >= 0) {
    state.taskHistory[idx] = { ...state.taskHistory[idx], ...task, updatedAt: now };
  } else {
    state.taskHistory.unshift({ ...task, createdAt: task.createdAt || now, updatedAt: now });
  }

  // 若任务已结束，更新最新生成状态
  if (['completed', 'failed', 'refunded', 'canceled'].includes(task.status)) {
    state.latestFinishedStatus = task.status;
    localStorage.setItem('api_latest_status', task.status);
  }

  // 最多持久化存储 300 条完整日志
  state.taskHistory = state.taskHistory.slice(0, 300);
  localStorage.setItem('api_task_history', JSON.stringify(state.taskHistory));
  updateStatusIndicators();

  if (el.viewHistoryLog && !el.viewHistoryLog.classList.contains('hidden')) {
    renderHistoryListUI();
  }
}

function updateHistoryCountBadge() {
  updateStatusIndicators();
}

function openHistoryModal() {
  renderHistoryListUI();
}

function closeHistoryModal() {}

function collectImageResultIds(value, target = new Set(), seen = new WeakSet()) {
  if (typeof value === 'string') {
    if (value.includes('data-image-result-id') && typeof DOMParser === 'function') {
      try {
        const documentFragment = new DOMParser().parseFromString(value, 'text/html');
        documentFragment.querySelectorAll('[data-image-result-id]').forEach(node => {
          const id = node.getAttribute('data-image-result-id');
          if (id) target.add(id);
        });
      } catch (error) {
        console.warn('Stored HTML image reference scan failed:', error);
      }
    }
    return target;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return target;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach(item => collectImageResultIds(item, target, seen));
    return target;
  }
  Object.entries(value).forEach(([key, nestedValue]) => {
    if (key === 'imageResultId' && typeof nestedValue === 'string' && nestedValue) target.add(nestedValue);
    if (key === 'imageResultIds' && Array.isArray(nestedValue)) {
      nestedValue.filter(id => typeof id === 'string' && id).forEach(id => target.add(id));
    }
    collectImageResultIds(nestedValue, target, seen);
  });
  return target;
}

function parseStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`Stored media reference scan skipped ${key}:`, error);
    return fallback;
  }
}

function collectLiveImageResultIds(options = {}) {
  const references = new Set();
  const sessions = options.sessions || SessionSystem.getSessionsSnapshot?.() || [];
  const sources = [
    sessions,
    state.activeTasks || [],
    state.taskHistory || [],
    state.assets || [],
    state.uploadedResources || [],
    state.promptTemplates || [],
    typeof canvasState === 'object' ? canvasState.savedLibrary : [],
    parseStoredJson('api_task_history', []),
    parseStoredJson('vkb_assets', []),
    parseStoredJson('vkb_uploaded_resources', []),
    parseStoredJson('vkb_prompt_templates', []),
    parseStoredJson('vkb_canvas_library', []),
    parseStoredJson('vkb_canvas_state', null),
    parseStoredJson('video_prompt_kb_long_script_state', null),
    parseStoredJson('vkb_current_script', null),
    parseStoredJson('vkb_script_history', [])
  ];
  sources.forEach(source => collectImageResultIds(source, references));
  return references;
}

async function cleanupUnreferencedImageResultIds(ids, options = {}) {
  const candidates = [...new Set((ids || []).filter(Boolean))];
  if (!candidates.length) return [];
  const cleanup = async () => {
    const deleted = [];
    for (const id of candidates) {
      const liveReferences = collectLiveImageResultIds(options);
      if (liveReferences.has(id)) continue;
      await deleteImageResultData(id);
      deleted.push(id);
    }
    return deleted;
  };
  if (navigator.locks?.request) return navigator.locks.request('vkb-image-result-gc', cleanup);
  return cleanup();
}

async function cleanupUnreferencedImageResults(items) {
  const ids = [...collectImageResultIds(items || [])];
  try {
    return await cleanupUnreferencedImageResultIds(ids);
  } catch (error) {
    console.warn('Image result cleanup failed:', error);
    return [];
  }
}

async function clearAllTaskHistory() {
  if (confirm('确认要清空全部历史生成记录日志吗？（包含已成功和已失败的全部记录）')) {
    const removedItems = [...state.taskHistory];
    state.taskHistory = [];
    state.latestFinishedStatus = 'none';
    localStorage.removeItem('api_task_history');
    localStorage.removeItem('api_latest_status');
    await cleanupUnreferencedImageResults(removedItems);
    updateStatusIndicators();
    renderHistoryListUI();
    showToast('已成功清空全部生成历史日志');
  }
}

function renderHistoryHeaderActions() {
  const container = document.getElementById('historyHeaderActions');
  if (!container) return;

  if (!state.isBatchSelectingHistory) {
    container.innerHTML = `
      <button id="btnToggleBatchHistory" class="btn btn-secondary btn-sm" title="进入批量选择模式">☑️ 选择</button>
    `;
    const btn = document.getElementById('btnToggleBatchHistory');
    if (btn) {
      btn.addEventListener('click', () => {
        state.isBatchSelectingHistory = true;
        state.selectedHistoryIds.clear();
        renderHistoryListUI();
      });
    }
  } else {
    const totalCount = state.taskHistory.length;
    const selectedCount = state.selectedHistoryIds.size;
    const isAllSelected = totalCount > 0 && selectedCount === totalCount;

    container.innerHTML = `
      <span style="font-size: 0.775rem; font-weight: 600; color: var(--primary); margin-right: 4px;">已选 ${selectedCount} 项</span>
      <button id="btnSelectAllHistory" class="btn btn-secondary btn-sm">${isAllSelected ? '取消全选' : '全选'}</button>
      <button id="btnBatchDownloadHistory" class="btn btn-secondary btn-sm" ${selectedCount === 0 ? 'disabled style="opacity: 0.5;"' : ''}>📥 批量下载</button>
      <button id="btnBatchDeleteHistory" class="btn btn-danger btn-sm" style="background: #ef4444; color: #fff; border: none;" ${selectedCount === 0 ? 'disabled style="opacity: 0.5;"' : ''}>🗑️ 批量删除</button>
      <button id="btnCancelBatchHistory" class="btn btn-ghost btn-sm">取消</button>
    `;

    document.getElementById('btnSelectAllHistory').addEventListener('click', () => {
      if (isAllSelected) {
        state.selectedHistoryIds.clear();
      } else {
        state.taskHistory.forEach(t => state.selectedHistoryIds.add(t.taskId));
      }
      renderHistoryListUI();
    });

    document.getElementById('btnBatchDownloadHistory').addEventListener('click', batchDownloadSelectedHistory);
    document.getElementById('btnBatchDeleteHistory').addEventListener('click', batchDeleteSelectedHistory);
    document.getElementById('btnCancelBatchHistory').addEventListener('click', () => {
      state.isBatchSelectingHistory = false;
      state.selectedHistoryIds.clear();
      renderHistoryListUI();
    });
  }
}

async function batchDownloadSelectedHistory() {
  const selectedIds = Array.from(state.selectedHistoryIds);
  const itemsToDownload = state.taskHistory.filter(item => selectedIds.includes(item.taskId) && (item.videoUrl || item.imageResultIds?.length || item.imageUrls?.length || item.imageResultId || item.imageUrl));
  if (itemsToDownload.length === 0) {
    alert('所选历史记录中没有可下载的图片或视频！');
    return;
  }

  const mediaCount = itemsToDownload.reduce((total, item) => total + (item.mediaType === 'image' ? getTaskImageEntries(item).length : 1), 0);
  showToast(`开始批量下载 ${mediaCount} 个生成结果...`);
  for (let i = 0; i < itemsToDownload.length; i++) {
    const item = itemsToDownload[i];
    if (item.mediaType === 'image' && (item.imageResultIds?.length || item.imageUrls?.length || item.imageResultId || item.imageUrl)) {
      const sources = await loadTaskImageSources(item);
      for (const source of sources) {
        await downloadGeneratedImage(source, item);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } else if (item.videoUrl) {
      const source = safeMediaUrl(item.videoUrl);
      if (!source) continue;
      const a = document.createElement('a');
      a.href = source;
      a.download = `video_${item.taskId.slice(0, 8)}.mp4`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  showToast(`已触发 ${mediaCount} 个生成结果下载`);
}

async function batchDeleteSelectedHistory() {
  const selectedIds = Array.from(state.selectedHistoryIds);
  if (selectedIds.length === 0) return;
  if (!confirm(`确认要删除选中的 ${selectedIds.length} 条历史记录吗？`)) return;

  const removedItems = state.taskHistory.filter(item => selectedIds.includes(item.taskId));
  state.taskHistory = state.taskHistory.filter(item => !selectedIds.includes(item.taskId));
  localStorage.setItem('api_task_history', JSON.stringify(state.taskHistory));
  await cleanupUnreferencedImageResults(removedItems);
  state.selectedHistoryIds.clear();
  state.isBatchSelectingHistory = false;
  updateStatusIndicators();
  renderHistoryListUI();
  showToast(`已从历史中删除 ${selectedIds.length} 条记录`);
}

function renderHistoryListUI() {
  updateStatusIndicators();
  if (!el.historyListContainer) return;
  releaseManagedVideos(el.historyListContainer, { force: true });
  unobserveManagedVideos(el.historyListContainer);
  renderHistoryHeaderActions();

  const filter = state.historyFilter || 'all';
  let filtered = state.taskHistory;

  if (filter !== 'all') {
    filtered = state.taskHistory.filter(t => t.status === filter);
  }

  if (filtered.length === 0) {
    el.historyListContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 60px 16px; font-size: 0.9rem;">暂无生成历史记录</div>';
    return;
  }

  el.historyListContainer.innerHTML = `
    <div class="apple-grid-layout" style="grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));">
      ${filtered.map(t => {
        const timeStr = new Date(t.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const isFailed = t.status === 'failed';
        const isCompleted = t.status === 'completed';
        const isSelected = state.selectedHistoryIds.has(t.taskId);
        const isImage = t.mediaType === 'image';
        const imageEntries = isImage ? getTaskImageEntries(t) : [];
        const safeVideoUrl = isImage ? '' : safeMediaUrl(t.videoUrl);

        return `
          <div class="apple-history-card history-card-item ${isSelected ? 'selected-card' : ''}" data-taskid="${t.taskId}" data-prompt="${escapeHTML(t.prompt)}" style="position: relative;" title="${state.isBatchSelectingHistory ? '点击选择该项' : '点击跳转至对话界面'}">
            ${state.isBatchSelectingHistory ? `
              <div class="apple-card-select-checkbox ${isSelected ? 'checked' : ''}">
                ${isSelected ? '✓' : ''}
              </div>
            ` : ''}

            <div class="apple-card-header">
              <div>
                <span class="apple-id-pill">ID: ${t.taskId.slice(0, 14)}...</span>
                <span style="font-size: 0.725rem; color: var(--text-muted); margin-left: 8px;">⏱️ ${timeStr}</span>
              </div>
              <span class="apple-status-badge ${t.status}">${renderStatusText(t.status)} ${t.progress ? `(${t.progress}%)` : ''}</span>
            </div>

            <div class="apple-prompt-box">
              ⚡ ${escapeHTML(t.prompt)}
            </div>

            <div class="apple-meta-pills">
              <span class="apple-meta-pill">${isImage ? '图片' : '视频'} · ${t.model || 'c1'}</span>
              ${isImage
                ? `<span class="apple-meta-pill">${t.options?.aspectRatio || '1:1'} · ${t.imageSize || t.options?.size || ''}</span>`
                : `<span class="apple-meta-pill">${t.duration || 5}s</span>${t.options && t.options.aspectRatio ? `<span class="apple-meta-pill">${t.options.aspectRatio}</span>` : ''}`}
            </div>

            ${isCompleted && isImage && imageEntries.length ? `
              <div class="apple-history-image-grid ${imageEntries.length === 1 ? 'is-single' : ''}">
                ${imageEntries.map((entry, index) => `
                  <div class="apple-image-container">
                    <img class="apple-image-player" src="${escapeHTML(entry.imageUrl || '')}" ${entry.imageResultId ? `data-image-result-id="${escapeHTML(entry.imageResultId)}"` : ''} alt="AI 生成图片 ${index + 1}">
                  </div>
                `).join('')}
              </div>
              <div class="apple-card-actions">
                ${t.source === 'multi-angle'
                  ? `<button type="button" class="btn btn-secondary btn-sm btn-jump-multi-angle">返回多角度创作</button>`
                  : `<button type="button" class="btn btn-secondary btn-sm btn-jump-chat" data-taskid="${t.taskId}" data-prompt="${escapeHTML(t.prompt)}">跳转对话</button>`}
                <button type="button" class="btn btn-secondary btn-sm btn-download-image-hist" data-taskid="${t.taskId}">${imageEntries.length > 1 ? `下载全部（${imageEntries.length}）` : '下载图片'}</button>
                <button type="button" class="btn btn-primary btn-sm btn-save-image-asset-hist" data-taskid="${t.taskId}">${imageEntries.length > 1 ? `全部存入资产库（${imageEntries.length}）` : '存入资产库'}</button>
              </div>
            ` : (isCompleted && safeVideoUrl ? `
              <div class="apple-video-container">
                <video class="apple-video-player" data-lazy-video-src="${escapeHTML(safeVideoUrl)}" data-click-video-load="1" controls loop muted playsinline preload="none"></video>
              </div>
              <div class="apple-card-actions">
                ${(t.source === 'canvas' || (t.taskId && t.taskId.includes('canvas'))) ? `
                  <button type="button" class="btn btn-secondary btn-sm btn-jump-canvas" data-taskid="${t.taskId}">🎨 跳转画布</button>
                ` : `
                  <button type="button" class="btn btn-secondary btn-sm btn-jump-chat" data-taskid="${t.taskId}" data-prompt="${escapeHTML(t.prompt)}">💬 跳转对话</button>
                `}
                <a href="${escapeHTML(safeVideoUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" onclick="event.stopPropagation();">🌐 大屏</a>
                <button type="button" class="btn btn-primary btn-sm btn-save-kb-hist" data-prompt="${escapeHTML(t.prompt)}" data-url="${escapeHTML(safeVideoUrl)}" onclick="event.stopPropagation();">📥 存入镜头库</button>
              </div>
            ` : '')}

            ${isFailed ? `
              <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 10px 12px; font-size: 0.775rem; color: #dc2626; line-height: 1.4;">
                <strong>❌ 失败原因：</strong> ${escapeHTML(t.errorMsg || '接口响应失败')}
              </div>
              <div class="apple-card-actions">
                ${(t.source === 'canvas' || (t.taskId && t.taskId.includes('canvas'))) ? `
                  <button type="button" class="btn btn-secondary btn-sm btn-jump-canvas" data-taskid="${t.taskId}">🎨 跳转画布</button>
                ` : `
                  <button type="button" class="btn btn-secondary btn-sm btn-jump-chat" data-taskid="${t.taskId}" data-prompt="${escapeHTML(t.prompt)}">💬 跳转对话</button>
                `}
                <button type="button" class="btn btn-primary btn-sm btn-retry-hist" data-taskid="${t.taskId}" onclick="event.stopPropagation();">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6"></path>
                    <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16"></path>
                  </svg>
                  重新提交
                </button>
              </div>
            ` : ''}

            ${!isCompleted && !isFailed ? `
              <div class="apple-card-actions">
                ${(t.source === 'canvas' || (t.taskId && t.taskId.includes('canvas'))) ? `
                  <button type="button" class="btn btn-secondary btn-sm btn-jump-canvas" data-taskid="${t.taskId}">🎨 跳转画布</button>
                ` : `
                  <button type="button" class="btn btn-secondary btn-sm btn-jump-chat" data-taskid="${t.taskId}" data-prompt="${escapeHTML(t.prompt)}">💬 跳转对话</button>
                `}
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
  hydrateStoredImageElements(el.historyListContainer);
  observeManagedVideos(el.historyListContainer);

  // 绑定历史卡片中的点击事件
  el.historyListContainer.querySelectorAll('.history-card-item').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'VIDEO') return;
      const taskId = card.dataset.taskid;
      if (state.isBatchSelectingHistory) {
        if (state.selectedHistoryIds.has(taskId)) {
          state.selectedHistoryIds.delete(taskId);
        } else {
          state.selectedHistoryIds.add(taskId);
        }
        renderHistoryListUI();
      } else {
        const historyTask = state.taskHistory.find(item => item.taskId === taskId);
        if (historyTask?.source === 'multi-angle') {
          closeHistoryModal();
          switchView('multiAngle');
          initMultiAngleCreator();
        } else {
          jumpToTaskInChat(taskId, card.dataset.prompt);
        }
      }
    });
  });

  el.historyListContainer.querySelectorAll('.btn-jump-chat').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      jumpToTaskInChat(btn.dataset.taskid, btn.dataset.prompt);
    });
  });

  el.historyListContainer.querySelectorAll('.btn-jump-multi-angle').forEach(btn => {
    btn.addEventListener('click', event => {
      event.stopPropagation();
      closeHistoryModal();
      switchView('multiAngle');
      initMultiAngleCreator();
    });
  });

  el.historyListContainer.querySelectorAll('.btn-jump-canvas').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      jumpToCanvasNode(btn.dataset.taskid);
    });
  });

  el.historyListContainer.querySelectorAll('.btn-download-image-hist').forEach(btn => {
    btn.addEventListener('click', async event => {
      event.stopPropagation();
      const task = state.taskHistory.find(item => item.taskId === btn.dataset.taskid);
      if (!task) return;
      const sources = await loadTaskImageSources(task);
      for (let index = 0; index < sources.length; index += 1) {
        await downloadGeneratedImage(sources[index], { ...task, imageIndex: index });
        if (index < sources.length - 1) await new Promise(resolve => setTimeout(resolve, 200));
      }
    });
  });

  el.historyListContainer.querySelectorAll('.btn-save-image-asset-hist').forEach(btn => {
    btn.addEventListener('click', async event => {
      event.stopPropagation();
      const task = state.taskHistory.find(item => item.taskId === btn.dataset.taskid);
      if (!task) return;
      const sources = await loadTaskImageSources(task);
      for (let index = 0; index < sources.length; index += 1) {
        await saveGeneratedImageToAssetLibrary(sources[index], { ...task, imageIndex: index });
      }
    });
  });

  el.historyListContainer.querySelectorAll('.btn-save-kb-hist').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const promptText = btn.dataset.prompt;
      const videoUrl = btn.dataset.url;
      const newItem = {
        id: `prompt-${Date.now()}`,
        title: promptText.slice(0, 20) + (promptText.length > 20 ? '...' : ''),
        prompt: promptText,
        shotSize: '特写',
        movement: '推镜头',
        angle: '平视角度',
        category: '人物肖像',
        videoUrl: videoUrl,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await PromptStore.save(newItem);
      await loadPrompts();
      showToast('✅ 已存入镜头库！');
    });
  });

  el.historyListContainer.querySelectorAll('.btn-retry-hist').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskid;
      const historyItem = state.taskHistory.find(h => h.taskId === taskId) || state.activeTasks.find(a => a.taskId === taskId);
      
      if (historyItem) {
        const promptText = historyItem.prompt;
        const origOptions = historyItem.options || {
          model: historyItem.model || DEFAULT_VIDEO_MODEL,
          duration: historyItem.duration || 15,
          aspectRatio: (historyItem.options && historyItem.options.aspectRatio) || '16:9',
          images: (historyItem.options && historyItem.options.images) || []
        };
        
        if (historyItem.mediaType === 'image') {
          syncChatGenerationMode('image');
          if (historyItem.model && state.apiConfig) {
            state.apiConfig.imageModel = historyItem.model;
            renderChatImageModel();
          }
          syncChatImageCount(historyItem.count || historyItem.options?.count || 1);
          if (el.aiChatTextarea) el.aiChatTextarea.value = promptText;
          switchView('videoGen');
          showToast('图片提示词和模式已恢复，请检查参考图后重新发送');
        } else if (historyItem.source === 'canvas' || (taskId && taskId.includes('canvas'))) {
          if (typeof jumpToCanvasNode === 'function') await jumpToCanvasNode(taskId);
          const node = canvasState.nodes.find(n => n.taskId === taskId || n.id === taskId);
          if (node && typeof runCanvasVideoGeneration === 'function') {
            runCanvasVideoGeneration(node.id);
          } else if (typeof triggerVideoGeneration === 'function') {
            triggerVideoGeneration(promptText, null, origOptions);
          }
        } else if (typeof triggerVideoGeneration === 'function') {
          triggerVideoGeneration(promptText, null, origOptions);
        }
      }
    });
  });
}

async function jumpToTaskInChat(taskId, promptText) {
  closeTaskQueueModal();
  closeHistoryModal();
  const historyTask = state.taskHistory.find(item => item.taskId === taskId)
    || state.activeTasks.find(item => item.taskId === taskId)
    || { taskId, prompt: promptText, status: 'completed', progress: 100 };
  if (historyTask.sessionId && SessionSystem.getActive()?.id !== historyTask.sessionId) {
    await SessionSystem.openSession(historyTask.sessionId);
    if (SessionSystem.getActive()?.id !== historyTask.sessionId) {
      showToast('任务来源会话已删除或不可用', 'warning');
      return;
    }
  } else {
    switchView('videoGen');
  }
  if (historyTask.sessionType && historyTask.sessionType !== 'creation') {
    showToast('该任务属于画布会话，已打开来源会话', 'info');
    return;
  }

  let chatCard = document.getElementById(`task-card-${taskId}`) || document.getElementById(`chat-target-${taskId}`);
  
  if (!chatCard) {
    appendAiUserBubble(promptText, null);
    const taskStatus = historyTask.status || 'completed';
    const taskProgress = historyTask.progress !== undefined ? historyTask.progress : (taskStatus === 'completed' ? 100 : 0);

    const isImageTask = historyTask.mediaType === 'image';
    const statusTip = taskStatus === 'completed'
      ? `已为您调取历史已完成${isImageTask ? '图片' : '视频'}记录`
      : (taskStatus === 'failed' ? '已为您调取历史生成日志' : `已为您调取任务 [ID: ${taskId.slice(0, 10)}...]`);
    const aiBox = appendAiAssistantBubble(statusTip);

    if (isImageTask) {
      chatCard = createChatImageResultCard(aiBox, taskId, promptText, historyTask.model || 'gpt-image-2', historyTask.options?.aspectRatio || '1:1', historyTask.count || historyTask.options?.count || 1);
      if (taskStatus === 'completed' && (historyTask.imageResultIds?.length || historyTask.imageUrls?.length || historyTask.imageResultId || historyTask.imageUrl)) {
        const imageSources = await loadTaskImageSources(historyTask);
        await renderChatImageCardResult(chatCard, historyTask, imageSources);
      } else if (['failed', 'refunded', 'canceled'].includes(taskStatus)) {
        await renderChatImageCardResult(chatCard, historyTask, []);
      }
    } else {
      chatCard = createChatGenCard(aiBox, taskId, promptText, historyTask.model || 'c1', '16:9', historyTask.duration || 5, taskStatus, taskProgress);
    }
    
    if (!isImageTask && historyTask.videoUrl) {
      const targetArea = chatCard.querySelector(`#chat-target-${taskId}`);
      if (targetArea) {
        setSafeVideoResult(targetArea, historyTask.videoUrl, {
          onSave: async () => {
            const newItem = {
              id: `prompt-${Date.now()}`,
              title: promptText.slice(0, 20) + (promptText.length > 20 ? '...' : ''),
              prompt: promptText,
              shotSize: '特写',
              movement: '推镜头',
              angle: '平视角度',
              category: '人物肖像',
              videoUrl: safeMediaUrl(historyTask.videoUrl),
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            await PromptStore.save(newItem);
            await loadPrompts();
            showToast('✅ 已成功保存到镜头库！');
          }
        });
      }
    } else if (!isImageTask && historyTask.errorMsg && taskStatus === 'failed') {
      const targetArea = chatCard.querySelector(`#chat-target-${taskId}`);
      if (targetArea) {
        targetArea.innerHTML = `<div style="color: #dc2626; background: rgba(254, 226, 226, 0.6); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 10px 14px; font-size: 0.8rem; line-height: 1.5; text-align: left; margin-top: 4px;"><strong>视频渲染日志:</strong> ${escapeHTML(historyTask.errorMsg)}</div>`;
      }
    }
  }

  if (chatCard) {
    chatCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    chatCard.classList.add('chat-card-highlight');
    setTimeout(() => chatCard.classList.remove('chat-card-highlight'), 3500);
  }
}

// --- 11. 视图切换与小云雀 AI 视频生成对话引擎 ---
function adminModeLabel(mode) {
  return ({ creation: '创作', canvas: '画布', 'long-script': '长剧本', 'multi-angle': '多角度' })[mode] || mode;
}

function adminEscape(value) {
  return escapeHTML(value === null || value === undefined ? '' : String(value));
}

function adminDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? adminEscape(value) : date.toLocaleString('zh-CN', { hour12: false });
}

function adminStatusLabel(status) {
  return ({ pending: '待处理', processing: '处理中', reconciling: '自动恢复中', needs_review: '等待确认', completed: '已完成', failed: '失败', refunded: '已退款', canceled: '已取消' })[status] || status || '-';
}

function adminOperationLabel(operation) {
  return ({ video: '视频生成', image: '图片生成', llm: '智能体/扩写', 'long-script': '长剧本' })[operation] || operation || '-';
}

function adminLedgerLabel(type) {
  return ({ grant: '赠送', reserve: '预扣', consume: '结算', release: '释放', refund: '退款', adjustment: '调整' })[type] || type || '-';
}

function adminUnitLabel(unit) {
  return ({ second: '积分 / 秒', image: '积分 / 张', request: '积分 / 次', token: '积分 / Token' })[unit] || unit || '-';
}

const ADMIN_MODE_CATALOG = [
  {
    id: 'creation',
    label: '创作',
    icon: '✦',
    description: '创作页面中的图片和视频生成',
    capabilities: [
      { operation: 'image', label: '图片生成', description: '创作页面生成图片', provider: 'image', unit: 'image' },
      { operation: 'video', label: '视频生成', description: '创作页面生成视频', provider: 'video', unit: 'second' }
    ]
  },
  {
    id: 'canvas',
    label: '画布',
    icon: '▦',
    description: '画布节点中的智能体、图片和视频生成',
    capabilities: [
      { operation: 'llm', label: '智能体节点', description: '节点内扩写、改写和文本处理', provider: 'llm', unit: 'request' },
      { operation: 'image', label: '图片节点', description: '画布图片节点生成', provider: 'image', unit: 'image' },
      { operation: 'video', label: '视频节点', description: '画布视频节点生成', provider: 'video', unit: 'second' }
    ]
  },
  {
    id: 'long-script',
    label: '长剧本',
    icon: '▤',
    description: '长剧本创作中心的剧本生成与续写',
    capabilities: [
      { operation: 'long-script', label: '长剧本对话', description: '生成、续写和修改长剧本', provider: 'llm', unit: 'request' }
    ]
  },
  {
    id: 'multi-angle',
    label: '多角度',
    icon: '◉',
    description: '多角度创作中的视角图片生成',
    capabilities: [
      { operation: 'image', label: '多角度图片', description: '每个选定角度生成一张图片', provider: 'image', unit: 'image' }
    ]
  }
];

function adminModeDefinition(mode) {
  return ADMIN_MODE_CATALOG.find(item => item.id === mode) || ADMIN_MODE_CATALOG[0];
}

function adminOperationOptions(mode) {
  return adminModeDefinition(mode).capabilities.map(capability => `<option value="${capability.operation}">${capability.label}</option>`).join('');
}

function adminModelIsEnabled(item) {
  return item?.is_active !== false && item?.pricing_active !== false;
}

function adminCapabilityModels(models, mode, operation) {
  return models.filter(item => item.mode === mode && item.operation === operation);
}

function adminSelectedModel(models) {
  const active = models.filter(adminModelIsEnabled);
  return active.find(item => item.metadata?.isDefault === true) || active[0] || models[0] || null;
}

function adminCapabilityIsReady(models, providers, mode, capability) {
  const candidates = adminCapabilityModels(models, mode, capability.operation);
  const active = candidates.filter(adminModelIsEnabled);
  const selected = adminSelectedModel(candidates);
  const provider = providers.find(item => item.name === (selected?.provider_name || capability.provider));
  const hasUnambiguousDefault = active.length <= 1 || active.some(item => item.metadata?.isDefault === true);
  return Boolean(selected && adminModelIsEnabled(selected) && selected.provider_name && selected.credits !== null && selected.credits !== undefined && provider?.enabled && hasUnambiguousDefault);
}

function adminPricingExample(item) {
  if (!item || item.credits === null || item.credits === undefined) return '尚未设置积分';
  const credits = Number(item.credits);
  if (item.unit === 'second') return `例如：生成 10 秒需要 ${credits * 10} 积分`;
  if (item.unit === 'image') return `例如：生成 1 张需要 ${credits} 积分`;
  if (item.unit === 'token') return `按 Token 结算，单位价格 ${credits} 积分`;
  return `每次提交需要 ${credits} 积分`;
}

function adminModelPayload(item) {
  return encodeURIComponent(JSON.stringify(item || {}));
}

function adminModelEditorMarkup() {
  return `<div class="admin-model-editor-backdrop hidden" data-admin-action="close-model-editor"></div><aside class="admin-model-editor hidden" aria-label="模型与计费编辑"><div class="admin-model-editor-header"><div><span class="admin-editor-eyebrow">模型与计费</span><h3 id="adminModelEditorTitle">编辑配置</h3><p id="adminModelEditorSubtitle">修改后会立即应用到对应业务模式</p></div><button type="button" class="admin-editor-close" data-admin-action="close-model-editor" aria-label="关闭">×</button></div><form class="admin-model-editor-form" data-admin-form="model"><div class="admin-editor-section"><h4>使用位置</h4><div class="admin-editor-grid"><label>业务模式<select name="mode" required>${ADMIN_MODE_CATALOG.map(item => `<option value="${item.id}">${item.label}</option>`).join('')}</select></label><label>功能<select name="operation" required>${adminOperationOptions('creation')}</select></label></div></div><div class="admin-editor-section"><h4>模型信息</h4><label>模型显示名称<input name="displayName" required placeholder="用户在前端看到的名称"></label><label>供应商模型 ID<input name="model" required placeholder="例如：gpt-image-2"></label><label>使用的 API<select name="providerName"><option value="llm">文本 API</option><option value="image">图片 API</option><option value="video">视频 API</option></select></label></div><div class="admin-editor-section"><h4>积分价格</h4><div class="admin-editor-grid"><label>扣费方式<select name="unit"><option value="request">每次</option><option value="image">每张</option><option value="second">每秒</option><option value="token">每 Token</option></select></label><label>单位积分<input name="credits" type="number" min="0" step="1" value="1" required></label></div><div class="admin-price-live-example" data-admin-price-example>每次提交需要 1 积分</div></div><div class="admin-editor-section admin-editor-switches"><label><input name="isActive" type="checkbox" checked><span><b>对用户启用</b><small>关闭后前端不再提供此模型</small></span></label><label><input name="isDefault" type="checkbox"><span><b>设为默认模型</b><small>该模式的此项功能优先使用它</small></span></label></div><div class="admin-editor-note" data-admin-editor-note>新增模型后会同时创建对应的积分规则。</div><div class="admin-editor-footer"><button type="button" class="btn btn-secondary" data-admin-action="close-model-editor">取消</button><button class="btn btn-primary" type="submit">保存配置</button></div></form></aside>`;
}

function updateAdminPriceExample(form) {
  const target = form?.querySelector('[data-admin-price-example]');
  if (!target) return;
  const credits = Math.max(0, Number(form.elements.namedItem('credits')?.value || 0));
  const unit = form.elements.namedItem('unit')?.value || 'request';
  target.textContent = adminPricingExample({ credits, unit });
}

function openAdminModelEditor(item = {}) {
  const editor = el.adminViewBody?.querySelector('.admin-model-editor');
  const backdrop = el.adminViewBody?.querySelector('.admin-model-editor-backdrop');
  const form = editor?.querySelector('[data-admin-form="model"]');
  if (!editor || !backdrop || !form) return;
  const editing = Boolean(item.model);
  const mode = item.mode || state.adminModelMode || 'creation';
  const operation = item.operation || adminModeDefinition(mode).capabilities[0]?.operation || 'llm';
  const expected = adminModeDefinition(mode).capabilities.find(capability => capability.operation === operation);
  form.dataset.editMode = editing ? 'true' : 'false';
  form.dataset.modelMode = mode;
  form.dataset.modelOperation = operation;
  form.dataset.modelId = item.model || '';
  form.elements.namedItem('mode').value = mode;
  form.elements.namedItem('operation').innerHTML = adminOperationOptions(mode);
  form.elements.namedItem('operation').value = operation;
  form.elements.namedItem('model').value = item.model || '';
  form.elements.namedItem('displayName').value = item.display_name || item.displayName || '';
  form.elements.namedItem('providerName').value = item.provider_name || item.providerName || expected?.provider || 'llm';
  form.elements.namedItem('unit').value = item.unit || expected?.unit || 'request';
  form.elements.namedItem('credits').value = item.credits ?? 1;
  form.elements.namedItem('isActive').checked = item.is_active !== false;
  form.elements.namedItem('isDefault').checked = item.metadata?.isDefault === true;
  form.elements.namedItem('mode').disabled = editing;
  form.elements.namedItem('operation').disabled = editing;
  form.elements.namedItem('model').readOnly = editing;
  const title = editor.querySelector('#adminModelEditorTitle');
  const subtitle = editor.querySelector('#adminModelEditorSubtitle');
  const note = editor.querySelector('[data-admin-editor-note]');
  if (title) title.textContent = editing ? `编辑 ${item.display_name || item.model}` : '新增模型配置';
  if (subtitle) subtitle.textContent = editing ? `${adminModeLabel(mode)} · ${adminOperationLabel(operation)}` : '选择使用位置并填写模型与积分';
  if (note) note.textContent = editing ? '业务模式、功能和模型 ID 是此配置的唯一标识。如需更换模型，请新增一条配置并将旧模型停用。' : '新增模型后会同时创建对应的积分规则。';
  updateAdminPriceExample(form);
  backdrop.classList.remove('hidden');
  editor.classList.remove('hidden');
  requestAnimationFrame(() => editor.classList.add('is-open'));
}

function closeAdminModelEditor() {
  const editor = el.adminViewBody?.querySelector('.admin-model-editor');
  const backdrop = el.adminViewBody?.querySelector('.admin-model-editor-backdrop');
  if (!editor || !backdrop) return;
  editor.classList.remove('is-open');
  backdrop.classList.add('hidden');
  editor.classList.add('hidden');
}

function handleAdminModelEditorInput(event) {
  const form = event.target.closest('.admin-model-editor-form');
  if (!form) return;
  if (event.target.name === 'mode' && form.dataset.editMode !== 'true') {
    const operationField = form.elements.namedItem('operation');
    operationField.innerHTML = adminOperationOptions(event.target.value);
    operationField.value = adminModeDefinition(event.target.value).capabilities[0]?.operation || 'image';
  }
  if ((event.target.name === 'operation' || event.target.name === 'mode') && form.dataset.editMode !== 'true') {
    const operation = form.elements.namedItem('operation').value;
    const defaults = operation === 'video'
      ? { provider: 'video', unit: 'second' }
      : operation === 'image'
        ? { provider: 'image', unit: 'image' }
        : { provider: 'llm', unit: 'request' };
    form.elements.namedItem('providerName').value = defaults.provider;
    form.elements.namedItem('unit').value = defaults.unit;
  }
  updateAdminPriceExample(form);
}

function bindAdminTableFilter(inputId, tableId) {
  const input = document.getElementById(inputId);
  const table = document.getElementById(tableId);
  if (!input || !table) return;
  input.addEventListener('input', () => {
    const keyword = input.value.trim().toLowerCase();
    table.querySelectorAll('tbody tr').forEach(row => {
      row.hidden = keyword && !row.textContent.toLowerCase().includes(keyword);
    });
  });
}

async function renderAdminView(panel = 'overview') {
  if (!BackendClient.isAdmin() || !el.adminViewBody) return;
  const body = el.adminViewBody;
  body.innerHTML = '<div class="admin-loading">正在读取管理数据...</div>';
  const titleMap = { overview: ['运营总览', '查看账号、任务和积分运行状态'], users: ['账号管理', '新增账号、停用/启用、重置密码和赠送积分'], models: ['模型与计费', '按模式调整每个模型的积分'], providers: ['API 配置', '管理服务端供应商和协议参数'], tasks: ['生成任务', '查看所有用户的生成任务和结算状态'], ledger: ['积分流水', '查看预扣、结算、释放和赠送记录'], audit: ['审计日志', '查看管理员和用户关键操作'] };
  const [title, subtitle] = titleMap[panel] || titleMap.overview;
  if (el.adminViewTitle) el.adminViewTitle.textContent = title;
  if (el.adminViewSubtitle) el.adminViewSubtitle.textContent = subtitle;
  try {
    if (panel === 'overview') {
      const data = await BackendClient.request('/api/admin/overview');
      const taskTotal = (data.taskStatuses || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
      const completed = Number((data.taskStatuses || []).find(item => item.status === 'completed')?.count || 0);
      const refunded = Number((data.taskStatuses || []).find(item => item.status === 'refunded')?.count || 0);
      const statuses = (data.taskStatuses || []).map(item => `<span class="admin-stat-chip"><b>${adminStatusLabel(item.status)}</b><span>${item.count} 个</span></span>`).join('') || '<span class="admin-empty">暂无任务</span>';
      const ledger = (data.ledgerTotals || []).map(item => `<span class="admin-stat-chip"><b>${adminLedgerLabel(item.entry_type)}</b><span class="${Number(item.total) >= 0 ? 'credit-positive' : 'credit-negative'}">${item.total > 0 ? '+' : ''}${item.total} 积分</span></span>`).join('') || '<span class="admin-empty">暂无流水</span>';
      const successRate = taskTotal ? `${Math.round(completed / taskTotal * 100)}%` : '-';
      body.innerHTML = `<div class="admin-stat-grid"><div class="admin-stat-card"><strong>${data.userCount ?? 0}</strong><span>账号总数</span><small>含管理员和普通用户</small></div><div class="admin-stat-card"><strong>${taskTotal}</strong><span>生成任务</span><small>${completed} 个已完成</small></div><div class="admin-stat-card"><strong>${successRate}</strong><span>任务完成率</span><small>${refunded} 个已退款</small></div><div class="admin-stat-card"><strong>${(data.ledgerTotals || []).filter(item => ['consume', 'reserve'].includes(item.entry_type)).reduce((sum, item) => sum + Math.abs(Number(item.total || 0)), 0)}</strong><span>累计消耗/预扣</span><small>来自积分流水汇总</small></div></div><div class="admin-dashboard-grid"><div class="admin-panel"><div class="admin-panel-heading"><div><h3>任务状态</h3><p>快速判断生成链路是否正常</p></div><button class="btn btn-secondary btn-sm" data-admin-action="go-tasks">查看任务</button></div><div class="admin-chip-row">${statuses}</div></div><div class="admin-panel"><div class="admin-panel-heading"><div><h3>积分账务</h3><p>预扣、结算、释放和赠送汇总</p></div><button class="btn btn-secondary btn-sm" data-admin-action="go-ledger">查看流水</button></div><div class="admin-chip-row">${ledger}</div></div></div><div class="admin-panel admin-quick-links"><h3>运营入口</h3><div class="admin-quick-link-grid"><button data-admin-action="go-users"><b>账号管理</b><span>用户、状态与积分</span></button><button data-admin-action="go-models"><b>模型与计费</b><span>启用模型和单价</span></button><button data-admin-action="go-providers"><b>API 配置</b><span>服务端供应商连接</span></button><button data-admin-action="go-audit"><b>审计日志</b><span>追溯管理员操作</span></button></div></div>`;
      return;
    }
    if (panel === 'users') {
      const users = await BackendClient.request('/api/admin/users?limit=200');
      body.innerHTML = `<form class="admin-inline-form" data-admin-form="new-user"><div class="admin-form-heading"><div><h3>新增账号</h3><p>创建后可立即分配初始积分，密码仅以哈希形式保存。</p></div><span class="admin-form-badge">账号与钱包</span></div><div class="admin-form-grid"><label>用户名<input name="username" required minlength="3" placeholder="例如：customer001"></label><label>初始密码<input name="password" type="password" required minlength="8" placeholder="至少 8 位"></label><label>初始积分<input name="initialCredits" type="number" min="0" step="1" value="0"></label><button class="btn btn-primary" type="submit">创建账号</button></div></form><div class="admin-toolbar admin-toolbar-spread"><div><b>账号列表</b><small>共 ${users.length} 个账号 · 可直接赠送积分、重置密码或停用账号</small></div><input id="adminUsersSearch" class="admin-search-input" type="search" placeholder="搜索用户名或角色"></div><div class="admin-table-wrap"><table class="admin-table" id="adminUsersTable"><thead><tr><th>账号</th><th>角色</th><th>状态</th><th>可用积分</th><th>预扣积分</th><th>创建时间</th><th>账号操作</th></tr></thead><tbody>${users.map(user => `<tr data-user-row="${user.id}"><td><strong>${adminEscape(user.username)}</strong><br><small>${adminEscape(user.email || '未设置邮箱')}</small></td><td><span class="admin-role-badge ${user.role === 'admin' ? 'is-admin' : ''}">${user.role === 'admin' ? '管理员' : '普通用户'}</span></td><td><span class="admin-status-badge ${user.is_active ? 'is-on' : 'is-off'}">${user.is_active ? '启用' : '已停用'}</span></td><td class="credit-positive">${user.balance}</td><td>${user.reserved}</td><td>${adminDate(user.created_at)}</td><td><div class="admin-row-actions"><input class="admin-compact-input" data-field="grant-amount" type="number" min="1" step="1" value="100" aria-label="赠送积分"><button class="btn btn-secondary btn-sm" data-admin-action="grant" data-user-id="${user.id}">赠送</button><input class="admin-compact-input" data-field="new-password" type="password" minlength="8" placeholder="新密码" aria-label="新密码"><button class="btn btn-secondary btn-sm" data-admin-action="reset-password" data-user-id="${user.id}">重置密码</button><button class="btn ${user.is_active ? 'btn-danger' : 'btn-secondary'} btn-sm" data-admin-action="toggle-user" data-user-id="${user.id}" data-active="${user.is_active}">${user.is_active ? '停用' : '启用'}</button></div></td></tr>`).join('')}</tbody></table></div>`;
      bindAdminTableFilter('adminUsersSearch', 'adminUsersTable');
      return;
    }
    if (panel === 'models') {
      const models = await BackendClient.request('/api/admin/models');
      const visibleModels = models.filter(item => item.operation !== 'tts' && item.provider_name !== 'audio' && !String(item.model || '').startsWith('regression-model-'));
      if (!ADMIN_MODE_CATALOG.some(item => item.id === state.adminModelMode)) state.adminModelMode = 'creation';
      const currentMode = adminModeDefinition(state.adminModelMode);
      const groups = currentMode.capabilities.map(capability => {
        const candidates = adminCapabilityModels(visibleModels, currentMode.id, capability.operation);
        const rows = candidates.length ? candidates.map(item => {
          const unit = item.unit || capability.unit;
          const unitText = adminUnitLabel(unit).replace('积分 / ', '积分/');
          return `<div class="admin-simple-price-row" data-admin-pricing-row><div class="admin-simple-model-name"><strong>${adminEscape(item.display_name || item.model)}</strong><small class="code-font">${adminEscape(item.model)}</small></div><div class="admin-simple-model-badges">${item.metadata?.isDefault === true ? '<span>默认</span>' : ''}${adminModelIsEnabled(item) ? '' : '<span class="is-off">已停用</span>'}</div><div class="admin-simple-price-control"><input type="number" min="0" step="1" value="${Number(item.credits ?? 0)}" aria-label="${adminEscape(item.display_name || item.model)}积分"><span>${unitText}</span><button type="button" class="btn btn-primary btn-sm" data-admin-action="save-model-price" data-model-mode="${currentMode.id}" data-model-operation="${capability.operation}" data-model-id="${adminEscape(item.model)}" data-model-unit="${unit}" data-pricing-active="${item.pricing_active !== false}">保存</button></div></div>`;
        }).join('') : '<div class="admin-simple-price-empty">这个功能目前没有配置模型</div>';
        return `<section class="admin-simple-price-group"><header><span class="admin-simple-capability-icon">${capability.operation === 'video' ? '▶' : capability.operation === 'image' ? '▧' : 'Aa'}</span><div><h3>${capability.label}</h3><p>${candidates.length} 个模型</p></div></header><div class="admin-simple-price-list">${rows}</div></section>`;
      }).join('');
      body.innerHTML = `<nav class="admin-simple-mode-tabs" aria-label="业务模式">${ADMIN_MODE_CATALOG.map(mode => `<button type="button" class="${mode.id === currentMode.id ? 'is-active' : ''}" data-admin-action="switch-model-mode" data-model-mode="${mode.id}">${mode.label}</button>`).join('')}</nav><section class="admin-simple-pricing-head"><h3>${currentMode.label}</h3><p>${currentMode.description}。直接修改模型积分并保存即可。</p></section><div class="admin-simple-pricing-groups">${groups}</div>`;
      return;
    }
    if (panel === 'providers') {
      const providers = await BackendClient.request('/api/admin/providers');
      body.innerHTML = `<div class="admin-provider-grid">${['video', 'image', 'llm'].map(name => { const item = providers.find(provider => provider.name === name); const title = name === 'video' ? '视频供应商' : name === 'image' ? '图片供应商' : '文本 / 长剧本供应商'; return `<div class="admin-provider-card"><div class="admin-provider-icon">${name === 'video' ? '▶' : name === 'image' ? '▧' : 'Aa'}</div><div class="admin-provider-main"><div class="admin-provider-title"><h3>${title}</h3><span class="admin-status-badge ${item?.enabled ? 'is-on' : 'is-off'}">${item?.enabled ? '已启用' : '未配置/停用'}</span></div><p class="code-font">${adminEscape(item?.base_url || '尚未配置 Base URL')}</p><div class="admin-provider-meta"><span>协议字段：${Object.keys(item?.metadata || {}).length} 项</span><span>密钥：仅服务端保存</span></div></div><button class="btn btn-secondary btn-sm" data-admin-action="open-api-config">配置</button></div>`; }).join('')}</div><div class="admin-panel"><div class="admin-panel-heading"><div><h3>安全说明</h3><p>API Key 只写入服务端加密配置，前端不会读取或回显完整密钥。上传的音频仅作为参考媒体发给视频 API。</p></div><button class="btn btn-primary" data-admin-action="open-api-config">打开完整配置</button></div><div class="admin-notice-list"><span>视频：创建接口、轮询接口、鉴权 Header、超时</span><span>图片：生成接口、返回格式、鉴权 Header、超时</span><span>文本：聊天接口、模型、鉴权 Header、超时</span><span>音频：仅上传为视频参考，不生成音频</span></div></div>`;
      return;
    }
    const endpoint = { tasks: '/api/admin/tasks?limit=200', ledger: '/api/admin/ledger?limit=200', audit: '/api/admin/audit?limit=200' }[panel];
    const rows = await BackendClient.request(endpoint);
    if (panel === 'tasks') { body.innerHTML = `<div class="admin-toolbar admin-toolbar-spread"><div><b>全量生成任务</b><small>包含成功、失败、退款和处理中任务</small></div><input id="adminTasksSearch" class="admin-search-input" type="search" placeholder="搜索用户、模型、任务 ID"></div><div class="admin-table-wrap"><table class="admin-table" id="adminTasksTable"><thead><tr><th>创建时间</th><th>任务 / 用户</th><th>模式与能力</th><th>模型</th><th>状态</th><th>积分结算</th><th>错误</th></tr></thead><tbody>${rows.map(item => `<tr><td>${adminDate(item.createdAt || item.created_at)}<br><small>${adminEscape(item.id)}</small></td><td><strong>${adminEscape(item.username || item.userId || '未知用户')}</strong><br><small class="code-font">${adminEscape(item.requestId || '')}</small></td><td>${adminModeLabel(item.mode)}<br><small>${adminOperationLabel(item.operation)}</small></td><td class="code-font">${adminEscape(item.model)}</td><td><span class="admin-status-badge ${['completed'].includes(item.status) ? 'is-on' : ['failed', 'refunded', 'canceled'].includes(item.status) ? 'is-off' : 'is-warn'}">${adminStatusLabel(item.status)}</span></td><td>预扣 ${item.reservedCredits ?? 0}<br>结算 ${item.consumedCredits ?? 0}</td><td><small>${adminEscape(item.errorMessage || '-')}</small></td></tr>`).join('')}</tbody></table></div>`; bindAdminTableFilter('adminTasksSearch', 'adminTasksTable'); }
    else if (panel === 'ledger') { body.innerHTML = `<div class="admin-toolbar admin-toolbar-spread"><div><b>不可变积分账本</b><small>金额为正表示回补/赠送，负数表示预扣或结算</small></div><input id="adminLedgerSearch" class="admin-search-input" type="search" placeholder="搜索用户、流水类型、任务 ID"></div><div class="admin-table-wrap"><table class="admin-table" id="adminLedgerTable"><thead><tr><th>时间</th><th>用户 / 请求</th><th>流水类型</th><th>变动</th><th>余额快照</th><th>关联任务 / 说明</th></tr></thead><tbody>${rows.map(item => `<tr><td>${adminDate(item.created_at)}</td><td><strong>${adminEscape(item.username)}</strong><br><small class="code-font">${adminEscape(item.request_id)}</small></td><td><span class="admin-ledger-badge ledger-${adminEscape(item.entry_type)}">${adminLedgerLabel(item.entry_type)}</span></td><td class="${Number(item.amount) >= 0 ? 'credit-positive' : 'credit-negative'}">${Number(item.amount) > 0 ? '+' : ''}${item.amount}</td><td>可用 ${item.balance_after}<br><small>预扣 ${item.reserved_after}</small></td><td>${adminEscape(item.description || '-')}<br><small class="code-font">${adminEscape(item.reference_id || '')}</small></td></tr>`).join('')}</tbody></table></div>`; bindAdminTableFilter('adminLedgerSearch', 'adminLedgerTable'); }
    else { body.innerHTML = `<div class="admin-toolbar admin-toolbar-spread"><div><b>操作审计记录</b><small>记录谁在什么时候对什么对象执行了什么操作</small></div><input id="adminAuditSearch" class="admin-search-input" type="search" placeholder="搜索用户、动作、目标"></div><div class="admin-table-wrap"><table class="admin-table" id="adminAuditTable"><thead><tr><th>时间</th><th>操作者</th><th>角色</th><th>动作</th><th>目标</th><th>详情</th></tr></thead><tbody>${rows.map(item => `<tr><td>${adminDate(item.created_at)}</td><td>${adminEscape(item.username || '系统')}</td><td>${adminEscape(item.actor_role || '-')}</td><td><span class="admin-action-badge">${adminEscape(item.action)}</span></td><td>${adminEscape(item.target_type || '-')}<br><small class="code-font">${adminEscape(item.target_id || '')}</small></td><td><small class="code-font">${adminEscape(JSON.stringify(item.metadata || {}))}</small></td></tr>`).join('')}</tbody></table></div>`; bindAdminTableFilter('adminAuditSearch', 'adminAuditTable'); }
  } catch (error) {
    body.innerHTML = `<div class="admin-error">读取失败：${adminEscape(error.message)}</div>`;
  }
}

async function handleAdminFormSubmit(event) {
  const form = event.target.closest('[data-admin-form]');
  if (!form || !BackendClient.isAdmin()) return;
  event.preventDefault();
  const formData = new FormData(form);
  try {
    if (form.dataset.adminForm === 'new-user') {
      const payload = {
        username: String(formData.get('username') || '').trim(),
        password: String(formData.get('password') || ''),
        initialCredits: Number(formData.get('initialCredits') || 0)
      };
      if (payload.username.length < 3) throw new Error('用户名至少需要 3 个字符');
      if (payload.password.length < 8) throw new Error('初始密码至少需要 8 位');
      if (!Number.isSafeInteger(payload.initialCredits) || payload.initialCredits < 0) throw new Error('初始积分必须是非负整数');
      await BackendClient.request('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
      showToast('账号已创建');
      return renderAdminView('users');
    }
    if (form.dataset.adminForm === 'model') {
      const editing = form.dataset.editMode === 'true';
      const payload = {
        mode: editing ? String(form.dataset.modelMode || '') : String(formData.get('mode') || ''),
        operation: editing ? String(form.dataset.modelOperation || '') : String(formData.get('operation') || ''),
        model: editing ? String(form.dataset.modelId || '').trim() : String(formData.get('model') || '').trim(),
        displayName: String(formData.get('displayName') || '').trim(),
        providerName: String(formData.get('providerName') || '').trim() || null,
        isActive: form.elements.namedItem('isActive').checked,
        isDefault: form.elements.namedItem('isDefault').checked
      };
      const unit = String(formData.get('unit') || 'request');
      const credits = Number(formData.get('credits') || 0);
      if (!payload.model || !payload.displayName) throw new Error('模型标识和显示名称不能为空');
      if (!Number.isSafeInteger(credits) || credits < 0) throw new Error('单位积分必须是非负整数');
      await BackendClient.request('/api/admin/models', { method: 'POST', body: JSON.stringify(payload) });
      await BackendClient.request('/api/admin/pricing', { method: 'PATCH', body: JSON.stringify({ mode: payload.mode, operation: payload.operation, model: payload.model, unit, credits, isActive: payload.isActive }) });
      await loadServerModels();
      showToast('模型和积分配置已保存');
      return renderAdminView('models');
    }
  } catch (error) {
    showToast(`操作失败：${error.message}`, 'error');
  }
}

async function handleAdminAction(event) {
  const button = event.target.closest('[data-admin-action]');
  if (!button || !BackendClient.isAdmin()) return;
  const action = button.dataset.adminAction;
  try {
    const adminRoute = { 'go-users': 'users', 'go-models': 'models', 'go-providers': 'providers', 'go-tasks': 'tasks', 'go-ledger': 'ledger', 'go-audit': 'audit' }[action];
    if (adminRoute) return switchView(`admin:${adminRoute}`);
    if (action === 'open-api-config') return openApiConfigModal();
    if (action === 'grant') {
      const row = button.closest('[data-user-row]');
      const amount = Number(row?.querySelector('[data-field="grant-amount"]')?.value || 0);
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('请输入大于 0 的整数积分');
      await BackendClient.request('/api/admin/credits/grant', { method: 'POST', body: JSON.stringify({ userId: button.dataset.userId, amount, requestId: `grant_${button.dataset.userId}_${Date.now()}` }) });
      showToast('积分已赠送'); return renderAdminView('users');
    }
    if (action === 'toggle-user') {
      await BackendClient.request(`/api/admin/users/${button.dataset.userId}`, { method: 'PATCH', body: JSON.stringify({ isActive: button.dataset.active !== 'true' }) });
      showToast('账号状态已更新'); return renderAdminView('users');
    }
    if (action === 'reset-password') {
      const row = button.closest('[data-user-row]');
      const password = row?.querySelector('[data-field="new-password"]')?.value || '';
      if (password.length < 8) throw new Error('新密码至少需要 8 位');
      await BackendClient.request(`/api/admin/users/${button.dataset.userId}`, { method: 'PATCH', body: JSON.stringify({ action: 'reset-password', password }) });
      row.querySelector('[data-field="new-password"]').value = '';
      showToast('密码已重置'); return;
    }
    if (action === 'switch-model-mode') {
      const mode = button.dataset.modelMode;
      if (!ADMIN_MODE_CATALOG.some(item => item.id === mode)) return;
      state.adminModelMode = mode;
      localStorage.setItem('vkb_admin_model_mode', mode);
      return renderAdminView('models');
    }
    if (action === 'save-model-price') {
      const row = button.closest('[data-admin-pricing-row]');
      const input = row?.querySelector('input[type="number"]');
      const credits = Number(input?.value);
      if (!Number.isSafeInteger(credits) || credits < 0) throw new Error('积分必须是非负整数');
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = '保存中';
      try {
        await BackendClient.request('/api/admin/pricing', {
          method: 'PATCH',
          body: JSON.stringify({
            mode: button.dataset.modelMode,
            operation: button.dataset.modelOperation,
            model: button.dataset.modelId,
            unit: button.dataset.modelUnit,
            credits,
            isActive: button.dataset.pricingActive !== 'false'
          })
        });
        button.textContent = '已保存';
        showToast('积分已保存');
        window.setTimeout(() => { if (button.isConnected) button.textContent = originalText; }, 1200);
      } finally {
        button.disabled = false;
      }
      return;
    }
    if (action === 'close-model-editor') {
      closeAdminModelEditor();
      return;
    }
    if (action === 'add-model') {
      const mode = button.dataset.modelMode || state.adminModelMode || 'creation';
      const operation = button.dataset.modelOperation || adminModeDefinition(mode).capabilities[0]?.operation || 'llm';
      openAdminModelEditor({ mode, operation });
      return;
    }
    if (action === 'edit-model' || action === 'load-model-form') {
      const item = JSON.parse(decodeURIComponent(button.dataset.modelPayload || ''));
      openAdminModelEditor(item);
      return;
    }
  } catch (error) { showToast(`操作失败：${error.message}`, 'error'); }
}

const PRIVACY_DISABLED_VIEWS = new Set(['taskQueue', 'historyLog', 'creationHistory', 'showcase', 'lensKb', 'promptKb', 'assetKb', 'canvasKb']);

function switchView(viewName) {
  if (window.PRIVACY_EPHEMERAL_MODE && (PRIVACY_DISABLED_VIEWS.has(viewName) || String(viewName).startsWith('admin:'))) {
    viewName = 'videoGen';
  }
  document.querySelectorAll('.page-view:not(.hidden)').forEach(view => {
    releaseManagedVideos(view, { force: true });
    unobserveManagedVideos(view);
  });
  if (el.viewVideoGen) el.viewVideoGen.classList.add('hidden');
  if (el.viewTaskQueue) el.viewTaskQueue.classList.add('hidden');
  if (el.viewHistoryLog) el.viewHistoryLog.classList.add('hidden');
  if (el.viewCreationHistory) el.viewCreationHistory.classList.add('hidden');
  if (el.viewLensKb) el.viewLensKb.classList.add('hidden');
  if (el.viewPromptKb) el.viewPromptKb.classList.add('hidden');
  if (el.viewAssetKb) el.viewAssetKb.classList.add('hidden');
  if (el.viewScriptGen) el.viewScriptGen.classList.add('hidden');
  if (el.viewLongScriptGen) el.viewLongScriptGen.classList.add('hidden');
  if (el.viewMultiAngle) el.viewMultiAngle.classList.add('hidden');
  if (el.viewCanvasMode) el.viewCanvasMode.classList.add('hidden');
  if (el.viewCanvasKb) el.viewCanvasKb.classList.add('hidden');
  if (el.viewShowcase) el.viewShowcase.classList.add('hidden');
  if (el.viewAdmin) el.viewAdmin.classList.add('hidden');

  // 重置所有菜单激活态
  [el.menuGroupVideoGen, el.menuGroupInspiration, el.menuGroupKb, el.menuGroupAdmin].forEach(g => g && g.classList.remove('active'));
  [el.navVideoGen, el.navInspirationHub, el.navKbGroup, el.navAdmin].forEach(n => n && n.classList.remove('active'));
  [el.navCreate, el.navCanvasMode, el.navSubQueue, el.navSubHistory,
   el.navScriptGen, el.navLongScriptGen, el.navMultiAngle, el.navShowcase,
   el.navCanvasKb, el.navLensKb, el.navPromptKb, el.navAssetKb,
   el.navAdminOverview, el.navAdminUsers, el.navAdminModels, el.navAdminProviders,
   el.navAdminTasks, el.navAdminLedger, el.navAdminAudit].forEach(n => n && n.classList.remove('active'));

  if (el.searchContainer) el.searchContainer.style.display = 'none';
  if (el.kbActionGroup) el.kbActionGroup.style.display = 'none';

  // 激活对应手风琴分组（并确保展开）
  function activateGroup(groupEl, headerEl) {
    if (groupEl) {
      groupEl.classList.add('active');
      groupEl.classList.add('expanded');
    }
    if (headerEl) headerEl.classList.add('active');
  }

  if (viewName === 'videoGen') {
    activateGroup(el.menuGroupVideoGen, el.navVideoGen);
    if (el.navCreate) el.navCreate.classList.add('active');
    if (el.viewVideoGen) el.viewVideoGen.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '⚡ 创作';
    if (el.topbarSub) el.topbarSub.textContent = '';
  } else if (viewName === 'taskQueue') {
    activateGroup(el.menuGroupVideoGen, el.navVideoGen);
    if (el.navSubQueue) el.navSubQueue.classList.add('active');
    if (el.viewTaskQueue) el.viewTaskQueue.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '⚡ 生成队列';
    if (el.topbarSub) el.topbarSub.textContent = '';
    updateTaskQueueUI();
  } else if (viewName === 'historyLog') {
    activateGroup(el.menuGroupVideoGen, el.navVideoGen);
    if (el.navSubHistory) el.navSubHistory.classList.add('active');
    if (el.viewHistoryLog) el.viewHistoryLog.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '📜 生成历史';
    if (el.topbarSub) el.topbarSub.textContent = '';
    renderHistoryListUI();
  } else if (viewName === 'creationHistory') {
    if (el.viewCreationHistory) el.viewCreationHistory.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '历史记录';
    if (el.topbarSub) el.topbarSub.textContent = '按会话查看，或浏览全部生成图片与视频';
    SessionSystem.renderCreationHistory();
  } else if (viewName === 'canvasMode') {
    activateGroup(el.menuGroupVideoGen, el.navVideoGen);
    if (el.navCanvasMode) el.navCanvasMode.classList.add('active');
    if (el.viewCanvasMode) el.viewCanvasMode.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '🎨 画布模式';
    if (el.topbarSub) el.topbarSub.textContent = '无限可视化节点工作台 · 双向实时联动生成队列与资产库';
    initCanvasEngine();
  } else if (viewName === 'scriptGen') {
    activateGroup(el.menuGroupVideoGen, el.navVideoGen);
    if (el.navScriptGen) el.navScriptGen.classList.add('active');
    if (el.viewScriptGen) el.viewScriptGen.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '✍️ 剧本创作中心';
    if (el.topbarSub) el.topbarSub.textContent = '灵感构想多镜头智能扩写与脚本排版编辑中心';
    renderScriptShotsUI(currentScriptShots || DEFAULT_SCRIPT_SHOTS);
  } else if (viewName === 'longScriptGen') {
    activateGroup(el.menuGroupVideoGen, el.navVideoGen);
    if (el.navLongScriptGen) el.navLongScriptGen.classList.add('active');
    if (el.viewLongScriptGen) el.viewLongScriptGen.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '📜 长剧本创作中心';
    if (el.topbarSub) el.topbarSub.textContent = 'AI 实时对话协同改写 · 《壹准验机》设备短视频长剧本';
    renderCanvasBrowserHtml(window.currentCanvasHtmlCode || '', { persist: false, allowEmpty: true });
  } else if (viewName === 'multiAngle') {
    activateGroup(el.menuGroupVideoGen, el.navVideoGen);
    if (el.navMultiAngle) el.navMultiAngle.classList.add('active');
    if (el.viewMultiAngle) el.viewMultiAngle.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '◈ 多角度创作';
    if (el.topbarSub) el.topbarSub.textContent = '上传原图·摆放摄像机·AI 生成对应视角';
    initMultiAngleCreator();
  } else if (viewName === 'showcase') {
    activateGroup(el.menuGroupInspiration, el.navInspirationHub);
    if (el.navShowcase) el.navShowcase.classList.add('active');
    if (el.viewShowcase) el.viewShowcase.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '🏆 精彩作品';
    if (el.topbarSub) el.topbarSub.textContent = '发现社区里的优秀创作';
  } else if (viewName === 'lensKb') {
    activateGroup(el.menuGroupKb, el.navKbGroup);
    if (el.navLensKb) el.navLensKb.classList.add('active');
    if (el.viewLensKb) el.viewLensKb.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '🎬 镜头库';
    if (el.topbarSub) el.topbarSub.textContent = '管理与检索做视频的提示词及对应镜头画面';
    if (el.searchContainer) el.searchContainer.style.display = 'flex';
    if (el.kbActionGroup) el.kbActionGroup.style.display = 'flex';
  } else if (viewName === 'promptKb') {
    activateGroup(el.menuGroupKb, el.navKbGroup);
    if (el.navPromptKb) el.navPromptKb.classList.add('active');
    if (el.viewPromptKb) {
      el.viewPromptKb.classList.remove('hidden');
    } else if (el.viewLensKb) {
      el.viewLensKb.classList.remove('hidden');
    }
    if (el.topbarTitle) el.topbarTitle.textContent = '📝 提示词库';
    if (el.topbarSub) el.topbarSub.textContent = '预置爆款提示词公式与卖点短视频表达句式';
    if (typeof renderPromptKbGridUI === 'function') renderPromptKbGridUI();
  } else if (viewName === 'assetKb') {
    activateGroup(el.menuGroupKb, el.navKbGroup);
    if (el.navAssetKb) el.navAssetKb.classList.add('active');
    if (el.viewAssetKb) {
      el.viewAssetKb.classList.remove('hidden');
    } else if (el.viewLensKb) {
      el.viewLensKb.classList.remove('hidden');
    }
    if (el.topbarTitle) el.topbarTitle.textContent = '📦 资产库';
    if (el.topbarSub) el.topbarSub.textContent = '人物、道具、场景 IP 资产管理及已上传资源绑定中心';
    if (typeof renderAssetGridUI === 'function') renderAssetGridUI(); if(typeof renderCanvasDrawer==='function') renderCanvasDrawer();
  } else if (viewName === 'canvasKb') {
    activateGroup(el.menuGroupKb, el.navKbGroup);
    if (el.navCanvasKb) el.navCanvasKb.classList.add('active');
    if (el.viewCanvasKb) el.viewCanvasKb.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '🎨 画布库';
    if (el.topbarSub) el.topbarSub.textContent = '管理与检索所有的 AI 可视化无限画布创作项目';
    renderCanvasKbGridUI();
  } else if (viewName.startsWith('admin:')) {
    if (!BackendClient.isAdmin()) return showToast('需要管理员权限', 'warning');
    const panel = viewName.slice(6) || 'overview';
    activateGroup(el.menuGroupAdmin, el.navAdmin);
    const nav = el[`navAdmin${panel[0].toUpperCase()}${panel.slice(1)}`];
    if (nav) nav.classList.add('active');
    if (el.viewAdmin) el.viewAdmin.classList.remove('hidden');
    if (el.topbarTitle) el.topbarTitle.textContent = '管理后台';
    if (el.topbarSub) el.topbarSub.textContent = '账号、模型、计费与生成运营数据';
    renderAdminView(panel);
  }
  window.requestAnimationFrame(() => {
    document.querySelectorAll('.page-view:not(.hidden)').forEach(view => observeManagedVideos(view));
  });
}

const MAX_CHAT_REFERENCE_FILE_BYTES = 50 * 1024 * 1024;
const SUPPORTED_CHAT_REFERENCE_TYPES = ['image/', 'video/', 'audio/'];

function validateChatReferenceFile(file) {
  if (!file || !SUPPORTED_CHAT_REFERENCE_TYPES.some(prefix => String(file.type || '').startsWith(prefix))) {
    return '不支持的文件格式，仅支持图片、视频和音频';
  }
  if (file.size > MAX_CHAT_REFERENCE_FILE_BYTES) {
    return `文件过大：${file.name || '该文件'} 超过 50 MB`;
  }
  return '';
}

  async function handleChatMediaSelect(e) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return 0;

  let count = 0;

  for (const file of files) {
    const validationError = validateChatReferenceFile(file);
    if (validationError) {
      showToast(validationError, 'warning');
      continue;
    }
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    if (getChatGenerationMode() === 'image' && !isImage) {
      showToast(`图片模式已忽略非图片文件：${file.name}`);
      continue;
    }

    try {
      const res = await apiUploadMedia(file);
      const tagNum = state.chatRefMediaList.length + 1;
      const mediaItem = {
        id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tag: `@图${tagNum}`,
        fileName: file.name,
        url: res.url,
        reference: res.reference || res.url,
        mediaId: res.id || null,
        mimeType: res.mimeType || file.type,
        sizeBytes: res.sizeBytes || file.size,
        type: isVideo ? 'video' : (isAudio ? 'audio' : 'image')
      };
      state.chatRefMediaList.push(mediaItem);
      count++;
    } catch (err) {
      console.error('Media upload error:', err);
      alert(`文件 “${file.name}” 上传失败: ${err.message}`);
    }
  }

  if (el.chatMediaInput) el.chatMediaInput.value = '';
  renderChatRefMediaList();
  if (count > 0) {
    showToast(`✅ 成功上传 ${count} 个参考媒体！点击标签或输入 @ 即可引用`);
  }
  return count;
}

function renderCreationMediaThumbnail(item, className = 'thumb-media-img') {
  const source = escapeHTML(item?.url || '');
  if (item?.type === 'video') return `<video data-lazy-video-src="${source}" data-lazy-video-release="auto" muted playsinline preload="none" class="${className}"></video>`;
  if (item?.type === 'audio') return `<span class="${className} thumb-media-audio" aria-label="音频参考">♫</span>`;
  return `<img src="${source}" alt="" class="${className}" />`;
}

function renderChatRefMediaList() {
  if (!el.aiRefMediaBox || !el.aiRefMediaList) return;

  // 重新排序标签编号 (@图1, @图2...)
  state.chatRefMediaList.forEach((item, index) => {
    item.tag = `@图${index + 1}`;
  });

  if (state.chatRefMediaList.length === 0) {
    el.aiRefMediaBox.classList.add('hidden');
    if (el.atMenuPopover) el.atMenuPopover.classList.add('hidden');
    refreshChatPromptEditorMediaRefs();
    return;
  }

  el.aiRefMediaBox.classList.remove('hidden');
  el.aiRefMediaList.innerHTML = state.chatRefMediaList.map(item => `
    <div class="ref-media-thumb-card" data-id="${item.id}" data-tag="${item.tag}" title="点击缩略图，在光标位置引用">
      <div class="thumb-media-wrapper">
        ${renderCreationMediaThumbnail(item)}
      </div>
      <button type="button" class="btn-del-chip" data-id="${item.id}" title="移除此参考媒体" aria-label="移除此参考媒体">&times;</button>
    </div>
  `).join('');
  observeManagedVideos(el.aiRefMediaList);

  // 绑定 Chip 点击与删除
  el.aiRefMediaList.querySelectorAll('.ref-media-thumb-card').forEach(card => {
    card.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.btn-del-chip')) e.preventDefault();
    });
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-del-chip')) {
        e.stopPropagation();
        removeChatMediaRef(card.dataset.id);
      } else {
        insertAtTagIntoTextarea(card.dataset.tag);
      }
    });
  });
  refreshChatPromptEditorMediaRefs();
}

function removeChatMediaRef(id) {
  state.chatRefMediaList = state.chatRefMediaList.filter(item => item.id !== id);
  renderChatRefMediaList();
}

function clearAllChatMediaRefs() {
  state.chatRefMediaList = [];
  renderChatRefMediaList();
}

let activeTextareaForAt = null;

async function addAssetToChatRefMedia(asset) {
  if (!asset) return;
  const imgUrl = asset.imageUrl || (asset.imageResultId ? await loadImageResultData(asset.imageResultId) : '') || 'assets/logo_brand.png';
  const fileName = asset.name || '资产素材';

  // 检查是否已经在参考列表中
  const existing = state.chatRefMediaList.find(m => m.assetId === asset.id || (m.url === imgUrl && m.fileName === fileName));
  if (existing) {
    showToast(`💡 【${asset.name}】已在参考图中 (${existing.tag})`);
    insertAtTagIntoTextarea(existing.tag, true, activeTextareaForAt);
    return;
  }

  const newRef = {
    id: `ref_asset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    assetId: asset.id,
    fileName: fileName,
    url: imgUrl,
    type: 'image',
    fileObj: null
  };

  state.chatRefMediaList.push(newRef);
  renderChatRefMediaList();

  const assignedTag = newRef.tag || `@图${state.chatRefMediaList.length}`;
  insertAtTagIntoTextarea(assignedTag, true, activeTextareaForAt);
  showToast(`✅ 已将资产库【${asset.name}】自动载入为参考图 (${assignedTag})`);
}

function checkAndToggleAtMenu(textarea) {
  if (!textarea) return;
  activeTextareaForAt = textarea;
  if (textarea.isContentEditable) rememberChatPromptSelection(textarea);
  const textBeforeCursor = textarea.isContentEditable
    ? getChatEditorTextBeforeCaret(textarea)
    : (textarea.value || '').slice(0, textarea.selectionStart || 0);

  initAssetAndPromptData();
  const hasRefMedia = state.chatRefMediaList && state.chatRefMediaList.length > 0;
  const hasAssets = state.assets && state.assets.length > 0;

  if (textBeforeCursor.endsWith('@') && (hasRefMedia || hasAssets)) {
    if (textarea.isContentEditable) {
      const selection = window.getSelection();
      const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
      chatAtInsertionRange = range && textarea.contains(range.startContainer) ? range.cloneRange() : null;
    }
    showAtMenuPopover(textarea);
  } else {
    if (textarea.isContentEditable && document.activeElement === textarea) chatAtInsertionRange = null;
    if (el.atMenuPopover) el.atMenuPopover.classList.add('hidden');
  }
}

function handleChatTextareaInput(e) {
  checkAndToggleAtMenu(e.target);
}

// 监听键盘按键、光标移动、鼠标点击与获得焦点，只要光标回到 '@' 正后方，弹窗即自动重新唤起
['click', 'keyup', 'focus', 'selectionchange'].forEach(eventType => {
  document.addEventListener(eventType, (e) => {
    const active = document.activeElement;
    if (active && (active.id === 'aiChatTextarea' || active.classList.contains('script-shot-visual-input'))) {
      checkAndToggleAtMenu(active);
    }
  });
});

function showAtMenuPopover(targetTextarea = null) {
  if (!el.atMenuPopover || !el.atMenuList) return;
  activeTextareaForAt = targetTextarea || el.aiChatTextarea;

  initAssetAndPromptData();
  const mediaList = state.chatRefMediaList || [];
  const assetList = state.assets || [];

  // 1. 顶部：会话已上传参考图列表
  const mediaItemsHtml = mediaList.map(item => `
    <div class="at-flyout-item at-ref-item" data-tag="${item.tag}">
      ${renderCreationMediaThumbnail(item, 'at-avatar')}
      <span class="at-title">${escapeHTML(item.fileName)}</span>
    </div>
  `).join('');

  // 2. 辅助渲染 3 级素材列表 HTML
  const renderTertiaryList = (items, emptyText = '暂无素材') => {
    if (!items || items.length === 0) {
      return `<div style="padding: 12px; font-size: 0.775rem; color: #94a3b8; text-align: center;">${emptyText}</div>`;
    }
    return items.map(asset => {
      const primary = asset.primaryMedia || asset.media?.[0];
      const imgUrl = asset.imageUrl || primary?.url || 'assets/logo_brand.png';
      const avatar = primary?.type === 'audio'
        ? '<span class="at-avatar thumb-media-audio">♫</span>'
        : primary?.type === 'video'
          ? '<span class="at-avatar thumb-media-audio">▶</span>'
          : `<img src="${imgUrl}" class="at-avatar" alt="${escapeHTML(asset.name)}" />`;
      return `
        <div class="at-flyout-item at-asset-item" data-asset-id="${asset.id}">
          ${avatar}
          <span class="at-title">${escapeHTML(asset.name)}</span>
        </div>
      `;
    }).join('');
  };

  const renderRefMediaTertiaryList = () => {
    if (!mediaList || mediaList.length === 0) {
      return `<div style="padding: 12px; font-size: 0.775rem; color: #94a3b8; text-align: center;">暂无已上传资源</div>`;
    }
    return mediaList.map(item => `
      <div class="at-flyout-item at-ref-item" data-tag="${item.tag}">
        ${renderCreationMediaThumbnail(item, 'at-avatar')}
        <span class="at-title">${escapeHTML(item.fileName)}</span>
      </div>
    `).join('');
  };

  // 3. 5 大二级分类配置 (全部资产、人物、道具、场景、已上传资源)
  const subCategories = [
    { id: 'all', name: '全部资产', icon: '📁', items: assetList },
    { id: 'renwu', name: '人物', icon: '👤', items: assetList.filter(a => (a.category || '人物') === '人物') },
    { id: 'daoju', name: '道具', icon: '🧩', items: assetList.filter(a => a.category === '道具') },
    { id: 'changjing', name: '场景', icon: '🏞️', items: assetList.filter(a => a.category === '场景') },
    { id: 'uploaded', name: '已上传资源', icon: '📎', isRefMedia: true }
  ];

  // 构建 2 级 + 3 级菜单 HTML
  const secondaryItemsHtml = subCategories.map(cat => {
    const tertiaryContentHtml = cat.isRefMedia ? renderRefMediaTertiaryList() : renderTertiaryList(cat.items, `暂无${cat.name}`);
    return `
      <div class="at-flyout-item at-category-trigger at-subcat-trigger" data-subcat="${cat.id}">
        <div class="at-cat-label">
          <span>${cat.icon}</span>
          <span>${cat.name}</span>
        </div>
        <span class="at-arrow">›</span>
        
        <!-- 3 级展开浮窗 (具体素材卡片) -->
        <div class="at-tertiary-flyout">
          ${tertiaryContentHtml}
        </div>
      </div>
    `;
  }).join('');

  // 4. 1 级 Popover 主 HTML (从资产库导入)
  const importItemHtml = `
    <div class="at-flyout-item at-category-trigger at-import-trigger">
      <div class="at-cat-label">
        <span>📦</span>
        <span>从资产库导入</span>
      </div>
      <span class="at-arrow">›</span>
      
      <!-- 2 级展开浮窗 (5 大分类) -->
      <div class="at-secondary-flyout">
        ${secondaryItemsHtml}
      </div>
    </div>
  `;

  el.atMenuList.innerHTML = `${mediaItemsHtml}${importItemHtml}`;

  // 5. 绑定点击事件：已上传参考图
  el.atMenuList.querySelectorAll('.at-ref-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      insertAtTagIntoTextarea(item.dataset.tag, true, activeTextareaForAt);
      el.atMenuPopover.classList.add('hidden');
    });
  });

  // 6. 绑定点击事件：资产库素材
  el.atMenuList.querySelectorAll('.at-asset-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const assetId = item.dataset.assetId;
      const targetAsset = assetList.find(a => a.id === assetId);
      if (targetAsset) {
        await addAssetToChatRefMedia(targetAsset);
      }
      el.atMenuPopover.classList.add('hidden');
    });
  });

  el.atMenuPopover.classList.remove('hidden');
}

function insertAtTagIntoTextarea(tag, replacingAtSymbol = false, targetTextarea = null) {
  const textarea = targetTextarea || activeTextareaForAt || el.aiChatTextarea;
  if (!textarea) return;

  if (textarea.isContentEditable && insertChatInlineMediaRef(textarea, tag, replacingAtSymbol)) return;

  const val = textarea.value;
  let cursorPos = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : val.length;
  let insertionStart = cursorPos;

  if (replacingAtSymbol && val.slice(cursorPos - 1, cursorPos) === '@') {
    insertionStart = cursorPos - 1;
    textarea.value = val.slice(0, cursorPos - 1) + `${tag} ` + val.slice(cursorPos);
  } else {
    textarea.value = val.slice(0, cursorPos) + `${tag} ` + val.slice(cursorPos);
  }

  textarea.focus();
  const newPos = insertionStart + tag.length + 1;
  if (typeof textarea.setSelectionRange === 'function') {
    textarea.setSelectionRange(newPos, newPos);
  }
}

function setupChatDragAndDrop() {
  const wrapper = document.getElementById('xyqChatWrapper');
  const overlay = document.getElementById('chatDragOverlay');
  if (!wrapper || !overlay) return;

  let dragDepth = 0;
  const hasDraggedFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');
  const resetDragState = () => {
    dragDepth = 0;
    overlay.classList.add('hidden');
  };

  wrapper.addEventListener('dragenter', event => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth += 1;
    overlay.classList.remove('hidden');
  }, false);

  wrapper.addEventListener('dragover', event => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    overlay.classList.remove('hidden');
  }, false);

  wrapper.addEventListener('dragleave', event => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth || !wrapper.contains(event.relatedTarget)) resetDragState();
  }, false);

  wrapper.addEventListener('drop', event => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer?.files;
    resetDragState();
    if (files?.length) void handleChatMediaSelect({ target: { files } });
  }, false);

  window.addEventListener('dragend', resetDragState);
  window.addEventListener('drop', resetDragState);
  window.addEventListener('blur', resetDragState);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetDragState();
  });
}

let isAiChatSubmitting = false;

function hasRunningChatImageTask() {
  return (state.activeTasks || []).some(task => task.source === 'chat'
    && task.mediaType === 'image'
    && ['queued', 'in_progress', 'running', 'rendering', 'paused', 'reconciling', 'needs_review'].includes(task.status));
}

function syncCreationSubmitButtonState() {
  if (!el.btnSubmitAiChat) return;
  const imageBusy = activeImageSubmissions.size > 0 || hasRunningChatImageTask();
  // 图片任务支持并列生成：按钮只在提交瞬间锁定，后台有任务时仍可继续提交。
  el.btnSubmitAiChat.disabled = isAiChatSubmitting;
  el.btnSubmitAiChat.title = imageBusy ? '已有图片任务在后台生成，可继续提交新任务' : '';
  if (el.chatSubmitButtonLabel) el.chatSubmitButtonLabel.classList.toggle('is-generating', isAiChatSubmitting);
}

function captureCreationSubmissionData() {
  return {
    chatHtml: el.aiChatStream?.innerHTML || '',
    inputDraft: el.aiChatTextarea?.value || '',
    refMedia: clone(state.chatRefMediaList || []),
    mode: getChatGenerationMode(),
    model: el.chatModelSelect?.value || state.apiConfig.model,
    imageModel: document.getElementById('chatImageModelSelect')?.value || state.apiConfig.imageModel,
    videoAspect: el.chatAspectSelect?.value || '16:9',
    imageAspect: el.chatImageAspectSelect?.value || state.chatImageAspect || '1:1',
    imageCount: el.chatImageCountInput?.value || state.chatImageCount || '1',
    duration: el.chatDurationSelect?.value || '5',
    tasks: []
  };
}

async function handleAiChatSubmit() {
  if (isAiChatSubmitting) {
    showToast('上一条请求正在提交，请稍候再试', 'info');
    syncCreationSubmitButtonState();
    return;
  }
  const text = el.aiChatTextarea.value.trim();
  const generationMode = getChatGenerationMode();
  const refMediaList = [...state.chatRefMediaList];
  const model = el.chatModelSelect.value;
  const videoAspectRatio = el.chatAspectSelect.value;
  const imageAspectRatio = el.chatImageAspectSelect?.value || state.chatImageAspect || '1:1';
  const imageCount = clampImageCount(el.chatImageCountInput?.value || state.chatImageCount || 1);
  const duration = isCustomDurationVideoModel(model)
    ? clampVideoDuration(el.chatDurationSelect.value, 4, 30, 5)
    : parseInt(el.chatDurationSelect.value, 10);
  if (!text && refMediaList.length === 0) {
    showToast('请在底部输入框写入场景描述或拖入参考媒体');
    return;
  }

  isAiChatSubmitting = true;
  syncCreationSubmitButtonState();
  try {
    let originSession = SessionSystem.getActive();
    if (originSession?.type !== 'creation') {
      originSession = await SessionSystem.createNew('creation', {
        force: true,
        data: captureCreationSubmissionData()
      });
    }
    if (originSession?.type !== 'creation') throw new Error('无法创建创作会话，请刷新页面后重试');
    const originSessionId = originSession.id;
    const persistedSession = await SessionSystem.ensureActivePersisted();
    if (!persistedSession || persistedSession.id !== originSessionId || SessionSystem.getActive()?.id !== originSessionId) {
      showToast('发送期间会话已切换，本次未提交，请在原会话重试', 'info');
      return;
    }
    if (generationMode === 'image') {
      const imageRefs = refMediaList.filter(item => item.type === 'image');
      const promptText = text || '基于所有参考图片生成一张主体和风格一致的新图片';
      appendAiUserBubble(text, imageRefs);
      el.aiChatTextarea.value = '';
      clearAllChatMediaRefs();
      void submitChatImageGeneration(promptText, imageRefs, imageAspectRatio, originSessionId, imageCount)
        .catch(error => console.error('Chat image generation failed:', error))
        .finally(syncCreationSubmitButtonState);
      return;
    }

    const promptText = text || '基于参考媒体生成高清视频';
    const getReference = item => item.reference || item.url;
    const imageOptions = refMediaList.filter(item => item.type === 'image').map(getReference);
    const videoOptions = refMediaList.filter(item => item.type === 'video').map(getReference);
    const audioOptions = refMediaList.filter(item => item.type === 'audio').map(getReference);
    appendAiUserBubble(text, refMediaList);
    el.aiChatTextarea.value = '';

    const options = { model, duration, aspectRatio: videoAspectRatio, refMediaList, sessionId: originSessionId };
    if (imageOptions.length > 0) options.images = imageOptions;
    if (videoOptions.length > 0) options.videos = videoOptions;
    if (audioOptions.length > 0) options.audios = audioOptions;
    clearAllChatMediaRefs();

    const aiBox = appendAiAssistantBubble('已在下方故事板生成您的提示词。您可直接提交渲染，或点击开始扩写让 AI 精细扩写。');
    renderLlmConfirmCard(aiBox, text, text, options, null, false);
    scrollChatToBottom();
  } finally {
    isAiChatSubmitting = false;
    syncCreationSubmitButtonState();
  }
}

function getImageJobUiStatus(job, parentStatus = 'in_progress') {
  const status = String(job?.status || '').toLowerCase();
  if (status === 'completed') return { key: 'completed', label: '已完成' };
  if (status === 'failed' || status === 'refunded') return { key: 'failed', label: '生成失败' };
  if (status === 'canceled') return { key: 'canceled', label: '已取消' };
  if (status === 'running' || status === 'in_progress' || status === 'rendering') return { key: 'running', label: '生成中' };
  if (parentStatus === 'canceled') return { key: 'canceled', label: '已取消' };
  return { key: 'queued', label: '排队中' };
}

function renderChatImageBatchProgress(task, card = null) {
  const targetCard = card || document.getElementById(`task-card-${task.taskId}`);
  const target = targetCard?.querySelector(`#chat-image-target-${task.taskId}`);
  if (!target) return;
  const expectedCount = clampImageCount(task.count || task.options?.count || task.input?.n || 1);
  const providerJobs = Array.isArray(task.providerJobs) && task.providerJobs.length
    ? task.providerJobs
    : Array.from({ length: expectedCount }, (_, index) => ({ index, status: task.status === 'queued' ? 'queued' : 'running' }));
  const progressValues = Array.isArray(task.imageJobProgress) ? task.imageJobProgress : [];
  const rows = Array.from({ length: expectedCount }, (_, index) => providerJobs.find(job => Number(job.index) === index) || providerJobs[index] || { index, status: 'queued' });
  const completedCount = rows.filter(job => getImageJobUiStatus(job, task.status).key === 'completed').length;
  const failedCount = rows.filter(job => ['failed', 'canceled'].includes(getImageJobUiStatus(job, task.status).key)).length;
  const rowProgress = rows.map((job, index) => {
    const uiStatus = getImageJobUiStatus(job, task.status);
    if (uiStatus.key === 'completed' || uiStatus.key === 'failed' || uiStatus.key === 'canceled') return 100;
    return Math.max(uiStatus.key === 'running' ? 12 : 5, Number(progressValues[index] || 0));
  });
  const overallProgress = Math.round(rowProgress.reduce((sum, value) => sum + value, 0) / expectedCount);
  const summary = failedCount
    ? `完成 ${completedCount}/${expectedCount}，异常 ${failedCount}`
    : `已完成 ${completedCount}/${expectedCount}`;
  const badge = targetCard?.querySelector(`#chat-image-badge-${task.taskId}`);
  if (badge) badge.textContent = `生成中 · ${summary}`;
  target.className = 'chat-image-batch-progress';
  target.innerHTML = `
    <div class="chat-image-batch-summary">
      <span><strong>批量生成进度</strong><small>${summary}</small></span>
      <b>${overallProgress}%</b>
    </div>
    <div class="chat-image-batch-overall" role="progressbar" aria-label="批量图片总体进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${overallProgress}"><i style="width:${overallProgress}%"></i></div>
    <div class="chat-image-job-grid">
      ${rows.map((job, index) => {
        const uiStatus = getImageJobUiStatus(job, task.status);
        const source = extractImageSourcesFromOutput(job.output || {})[0] || '';
        const providerTaskLabel = job.providerTaskId ? `任务 ${String(job.providerTaskId).slice(0, 10)}… · ` : '';
        const detail = uiStatus.key === 'failed' ? escapeHTML(job.errorMessage || '接口返回异常') : `${providerTaskLabel}${rowProgress[index]}%`;
        return `<div class="chat-image-job-card is-${uiStatus.key}" data-image-job-index="${index}">
          <div class="chat-image-job-visual">
            ${source && uiStatus.key === 'completed'
              ? `<img src="${escapeHTML(source)}" alt="第 ${index + 1} 张生成结果">`
              : `<span class="chat-image-job-state-icon" aria-hidden="true"></span>`}
          </div>
          <div class="chat-image-job-copy">
            <span><strong>第 ${index + 1} 张</strong><em>${uiStatus.label}</em></span>
            <small title="${detail}">${detail}</small>
          </div>
          <div class="chat-image-job-progress"><i style="width:${rowProgress[index]}%"></i></div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function createChatImageResultCard(container, taskId, promptText, model, aspectRatio, count = 1) {
  const card = document.createElement('div');
  card.className = 'chat-image-generation-card';
  card.id = `task-card-${taskId}`;
  card.innerHTML = `
    <div class="task-header">
      <span class="task-id-tag">ID: ${escapeHTML(taskId)}</span>
      <span style="display:flex;align-items:center;gap:6px;">
        <span class="task-status-badge in_progress" id="chat-image-badge-${taskId}">生成中</span>
        <button type="button" class="btn btn-secondary btn-sm danger" data-cancel-task="${escapeHTML(taskId)}">取消</button>
      </span>
    </div>
    <div style="font-size: 0.775rem; color: var(--text-muted); margin: 8px 0;">
      模型: <code>${escapeHTML(model)}</code> | 图片尺寸: ${escapeHTML(aspectRatio)} (${getChatImageSize(aspectRatio)}) | 数量: ${count} 张
    </div>
    <div class="chat-image-batch-progress" id="chat-image-target-${taskId}"></div>
  `;
  container.appendChild(card);
  renderChatImageBatchProgress({ taskId, count, status: 'queued', imageJobProgress: Array(count).fill(5) }, card);
  return card;
}

function startChatImageProgress(task) {
  const count = clampImageCount(task.count || task.options?.count || 1);
  task.imageJobProgress = Array.from({ length: count }, (_, index) => Number(task.imageJobProgress?.[index] || 5));
  const update = () => {
    const jobs = Array.isArray(task.providerJobs) ? task.providerJobs : [];
    task.imageJobProgress = task.imageJobProgress.map((current, index) => {
      const status = getImageJobUiStatus(jobs.find(job => Number(job.index) === index) || jobs[index], task.status).key;
      if (status === 'completed' || status === 'failed' || status === 'canceled') return 100;
      const step = status === 'queued' ? 1 : (current < 55 ? 4 : current < 78 ? 2 : 1);
      return Math.min(status === 'queued' ? 24 : 92, current + step);
    });
    task.progress = Math.round(task.imageJobProgress.reduce((sum, value) => sum + value, 0) / count);
    renderChatImageBatchProgress(task);
  };
  renderChatImageBatchProgress(task);
  const timer = window.setInterval(update, 1200);
  return () => window.clearInterval(timer);
}

async function loadTaskImageSources(task) {
  const sources = [];
  const resultIds = Array.isArray(task?.imageResultIds) && task.imageResultIds.length
    ? task.imageResultIds
    : (task?.imageResultId ? [task.imageResultId] : []);
  for (const id of resultIds) {
    const source = await loadImageResultData(id);
    if (source) sources.push(source);
  }
  const remoteUrls = Array.isArray(task?.imageUrls) && task.imageUrls.length
    ? task.imageUrls
    : (task?.imageUrl ? [task.imageUrl] : []);
  remoteUrls.filter(Boolean).forEach(source => sources.push(source));
  return [...new Set(sources)];
}

function getTaskImageEntries(task) {
  const resultIds = Array.isArray(task?.imageResultIds) && task.imageResultIds.length
    ? task.imageResultIds
    : (task?.imageResultId ? [task.imageResultId] : []);
  const remoteUrls = Array.isArray(task?.imageUrls) && task.imageUrls.length
    ? task.imageUrls
    : (task?.imageUrl ? [task.imageUrl] : []);
  return [
    ...resultIds.map(imageResultId => ({ imageResultId, imageUrl: null })),
    ...remoteUrls.map(imageUrl => ({ imageResultId: null, imageUrl }))
  ];
}

const activeImageReconciliations = new Set();
const imageReconcileTimers = new Map();
const activeImageSubmissions = new Set();

function scheduleChatImageReconcile(task, card = null) {
  if (!task?.taskId || activeImageSubmissions.has(task.taskId) || imageReconcileTimers.has(task.taskId)) return;
  const timer = window.setTimeout(() => {
    imageReconcileTimers.delete(task.taskId);
    void reconcileChatImageTask(task, document.getElementById(`task-card-${task.taskId}`) || card)
      .catch(error => console.warn('Image task scheduled reconcile failed:', error));
  }, 3500);
  imageReconcileTimers.set(task.taskId, timer);
}

async function reconcileChatImageTask(task, card = null) {
  if (!task?.taskId || SessionSystem.isTaskCanceled(task.taskId) || activeImageSubmissions.has(task.taskId) || activeImageReconciliations.has(task.taskId)) return task;
  activeImageReconciliations.add(task.taskId);
  try {
    if (!task.backendTaskId) {
      const backendTasks = await BackendClient.listGenerations(100);
      const exactMatch = backendTasks.find(item => item.requestId === task.taskId);
      const taskCreatedAt = Number(task.createdAt || 0);
      const legacyMatches = backendTasks.filter(item => {
        if (item.mode !== 'creation' || item.operation !== 'image' || item.model !== task.model || item.prompt !== task.prompt) return false;
        const backendCreatedAt = new Date(item.createdAt).getTime();
        const expectedCount = Number(task.count || task.options?.count || 1);
        const backendCount = Number(item.input?.n || 1);
        const expectedSize = String(task.imageSize || task.options?.size || '');
        const backendSize = String(item.input?.size || '');
        return taskCreatedAt > 0
          && Math.abs(backendCreatedAt - taskCreatedAt) <= 30 * 1000
          && backendCount === expectedCount
          && (!expectedSize || !backendSize || backendSize === expectedSize);
      }).sort((a, b) => Math.abs(new Date(a.createdAt).getTime() - taskCreatedAt) - Math.abs(new Date(b.createdAt).getTime() - taskCreatedAt));
      const matchedTask = exactMatch || legacyMatches[0];
      if (!matchedTask) {
        if (taskCreatedAt > 0 && Date.now() - taskCreatedAt > 20 * 60 * 1000) {
          const failedTask = completeTask(task.taskId, 'failed', null, '未找到对应的后端图片任务，请重新生成', task.prompt, task.model);
          const liveCard = document.getElementById(`task-card-${task.taskId}`) || (card?.isConnected ? card : null);
          if (liveCard) await renderChatImageCardResult(liveCard, failedTask, []);
          return failedTask;
        }
        scheduleChatImageReconcile(task, card);
        return task;
      }
      task.backendTaskId = matchedTask.id;
      await SessionSystem.trackTask(task);
    }
    const backendTask = await BackendClient.getGeneration(task.backendTaskId);
    applyBackendTaskBilling(task, backendTask);
    if (Array.isArray(backendTask.providerJobs)) task.providerJobs = clone(backendTask.providerJobs);
    if (!['completed', 'refunded', 'failed', 'canceled'].includes(backendTask.status)) {
      task.status = backendTask.status === 'queued' ? 'queued' : 'in_progress';
      renderChatImageBatchProgress(task, document.getElementById(`task-card-${task.taskId}`) || card);
      await SessionSystem.trackTask(task);
      scheduleChatImageReconcile(task, card);
      return task;
    }
    const pendingTimer = imageReconcileTimers.get(task.taskId);
    if (pendingTimer) window.clearTimeout(pendingTimer);
    imageReconcileTimers.delete(task.taskId);
    if (backendTask.status !== 'completed') {
      const failedTask = completeTask(
        task.taskId,
        backendTask.status,
        null,
        backendTask.errorMessage || '图片生成失败，预扣积分已退回',
        task.prompt,
        task.model,
        backendTask
      );
      const liveCard = document.getElementById(`task-card-${task.taskId}`) || (card?.isConnected ? card : null);
      if (liveCard) await renderChatImageCardResult(liveCard, failedTask, []);
      return failedTask;
    }

    const sources = extractImageSourcesFromOutput(backendTask.output || {});
    if (!sources.length) throw new Error('服务端任务已完成，但没有返回图片地址或图片数据');
    const imageResultIds = [];
    const imageUrls = [];
    const displaySources = [];
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      const imageResultId = `result_${task.taskId}_${index + 1}`;
      try {
        await saveImageResultData(imageResultId, source);
        imageResultIds.push(imageResultId);
        displaySources.push(await loadImageResultData(imageResultId) || source);
      } catch (storageError) {
        if (!/^https?:\/\//i.test(source)) throw storageError;
        imageUrls.push(source);
        displaySources.push(source);
      }
    }
    Object.assign(task, {
      imageResultIds,
      imageUrls,
      imageResultId: imageResultIds[0] || null,
      imageUrl: imageUrls[0] || null
    });
    const completedTask = completeTask(task.taskId, 'completed', null, null, task.prompt, task.model, backendTask);
    const liveCard = document.getElementById(`task-card-${task.taskId}`) || (card?.isConnected ? card : null);
    if (liveCard) await renderChatImageCardResult(liveCard, completedTask, displaySources);
    return completedTask;
  } finally {
    activeImageReconciliations.delete(task.taskId);
  }
}

async function renderChatImageCardResult(card, task, imageSources = []) {
  const badge = card?.querySelector(`#chat-image-badge-${task.taskId}`);
  const target = card?.querySelector(`#chat-image-target-${task.taskId}`);
  card?.querySelector(`[data-cancel-task="${CSS.escape(task.taskId)}"]`)?.remove();
  const sources = (Array.isArray(imageSources) ? imageSources : [imageSources]).filter(Boolean);
  const expectedCount = clampImageCount(task.count || task.options?.count || sources.length || 1);
  const providerJobs = Array.isArray(task.providerJobs) && task.providerJobs.length === expectedCount ? task.providerJobs : [];
  let creditsArea = card?.querySelector('.task-credit-breakdown-slot');
  if (!creditsArea && card) {
    creditsArea = document.createElement('div');
    creditsArea.className = 'task-credit-breakdown-slot';
    card.querySelector('.chat-image-loading')?.before(creditsArea);
  }
  if (creditsArea) creditsArea.innerHTML = renderTaskCreditBreakdown(task);
  if (badge) {
    badge.className = `task-status-badge ${task.status}`;
    badge.textContent = task.status === 'completed'
      ? (sources.length < expectedCount ? `部分完成（${sources.length}/${expectedCount} 张）` : `生成完成${sources.length > 1 ? `（${sources.length} 张）` : ''}`)
      : (task.status === 'canceled' ? '已取消' : (task.status === 'refunded' ? '已退款' : '生成失败'));
  }
  if (!target) return;
  if (task.status === 'canceled') {
    target.className = '';
    target.innerHTML = '<div class="session-task-resume">图片任务已在本地取消，返回结果不会写回。</div>';
    return;
  }
  if ((task.status === 'failed' || task.status === 'refunded') && !providerJobs.length) {
    target.className = '';
    target.innerHTML = `<div style="color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:left;"><strong>${task.status === 'refunded' ? '图片生成失败，积分已退回：' : '图片生成失败：'}</strong>${escapeHTML(task.errorMsg || '接口响应失败')}</div>`;
    return;
  }
  if (!sources.length && !providerJobs.length) {
    target.className = '';
    target.innerHTML = '<div class="session-task-resume">服务端未返回图片结果。</div>';
    return;
  }
  target.className = 'chat-image-result-grid';
  const partialWarning = task.status === 'completed' && sources.length < expectedCount
    ? `<div class="chat-image-partial-warning">本次需要 ${expectedCount} 张，成功返回 ${sources.length} 张。未返回的图片没有计入结果，可直接重新生成。</div>`
    : '';
  let sourceIndex = 0;
  const resultRows = providerJobs.length
    ? providerJobs.map((job, index) => {
      const status = getImageJobUiStatus(job, task.status);
      const itemSourceIndex = status.key === 'completed' && sources[sourceIndex] ? sourceIndex++ : -1;
      return { index, status, sourceIndex: itemSourceIndex, source: itemSourceIndex >= 0 ? sources[itemSourceIndex] : '', errorMessage: job.errorMessage || '' };
    })
    : sources.map((source, index) => ({ index, status: { key: 'completed', label: '已完成' }, sourceIndex: index, source, errorMessage: '' }));
  target.innerHTML = `${partialWarning}${resultRows.map(item => item.source ? `
    <div class="chat-image-result-item is-completed">
      <div class="chat-image-result-number">第 ${item.index + 1} 张 · 已完成</div>
      <img class="task-image-preview" src="${escapeHTML(item.source)}" alt="AI 生成图片 ${item.index + 1}">
      <div class="apple-card-actions" style="margin-top:10px;">
        <button type="button" class="btn btn-secondary btn-sm btn-download-chat-image" data-image-index="${item.sourceIndex}">下载</button>
        <button type="button" class="btn btn-primary btn-sm btn-save-chat-image" data-image-index="${item.sourceIndex}">存入资产库</button>
      </div>
    </div>
  ` : `
    <div class="chat-image-result-item is-failed">
      <div class="chat-image-result-number">第 ${item.index + 1} 张 · ${item.status.label}</div>
      <div class="chat-image-result-failed"><span>×</span><strong>${escapeHTML(item.errorMessage || '图片未成功返回')}</strong></div>
    </div>
  `).join('')}`;
  target.querySelectorAll('.btn-download-chat-image').forEach(button => {
    const source = sources[Number(button.dataset.imageIndex)];
    button.addEventListener('click', () => downloadGeneratedImage(source, { ...task, imageIndex: Number(button.dataset.imageIndex) }));
  });
  target.querySelectorAll('.btn-save-chat-image').forEach(button => {
    const source = sources[Number(button.dataset.imageIndex)];
    button.addEventListener('click', () => saveGeneratedImageToAssetLibrary(source, { ...task, imageIndex: Number(button.dataset.imageIndex) }));
  });
}

async function submitChatImageGeneration(promptText, refMediaList, aspectRatio, originSessionId = null, count = 1) {
  const model = getPreferredServerModel('creation', 'image', state.apiConfig.imageModel);
  const size = getChatImageSize(aspectRatio);
  const normalizedCount = clampImageCount(count);
  if (!model) {
    showToast('暂无可用图片模型，请联系管理员启用模型', 'error');
    return;
  }
  const taskId = `image_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const aiBox = appendAiAssistantBubble(normalizedCount > 1
    ? `正在提交 ${normalizedCount} 个独立图片任务，每张图会分别显示进度。`
    : '正在使用图片模型生成画面。');
  const card = createChatImageResultCard(aiBox, taskId, promptText, model, aspectRatio, normalizedCount);
  const task = SessionSystem.assignTask({
    source: 'chat',
    mediaType: 'image',
    taskId,
    prompt: promptText,
    model,
    imageSize: size,
    status: 'in_progress',
    progress: 10,
    options: { generationMode: 'image', aspectRatio, size, count: normalizedCount },
    count: normalizedCount,
    providerJobs: window.STANDALONE_MODE && normalizedCount > 1
      ? Array.from({ length: normalizedCount }, (_, index) => ({ index, status: index < 3 ? 'running' : 'queued', output: {}, errorMessage: null }))
      : undefined,
    createdAt: Date.now(),
    sessionId: originSessionId,
    sessionType: 'creation'
  }, 'creation');
  if (!state.activeTasks) state.activeTasks = [];
  state.activeTasks.unshift(task);
  updateStatusIndicators();
  void SessionSystem.trackTask(task).catch(error => console.warn('Image task session save failed:', error));
  showToast('图片生成请求已提交');
  activeImageSubmissions.add(taskId);
  syncCreationSubmitButtonState();
  const stopProgress = startChatImageProgress(task);
  try {
    const imageSources = refMediaList.map(item => item.reference || item.url).filter(Boolean);
    const handleBatchProgress = backendTask => {
      if (!backendTask || SessionSystem.isTaskCanceled(taskId)) return;
      if (Array.isArray(backendTask.providerJobs)) task.providerJobs = clone(backendTask.providerJobs);
      if (backendTask.output) task.output = clone(backendTask.output);
      if (backendTask.id) task.backendTaskId = backendTask.id;
      applyBackendTaskBilling(task, backendTask);
      renderChatImageBatchProgress(task, document.getElementById(`task-card-${taskId}`) || card);
      void SessionSystem.trackTask(task).catch(error => console.warn('Image batch progress save failed:', error));
    };
    const generated = await apiGenerateCanvasImage(promptText, imageSources, {
      size,
      mode: 'creation',
      count: normalizedCount,
      frontendTaskId: taskId,
      onProgress: handleBatchProgress
    });
    const generatedSources = (generated.sources || [generated.source]).filter(Boolean);
    applyBackendTaskBilling(task, generated.task, generated.pricing);
    const imageResultIds = [];
    const imageUrls = [];
    const displaySources = [];
    for (let index = 0; index < generatedSources.length; index += 1) {
      const generatedSource = generatedSources[index];
      let imageResultId = `result_${taskId}_${index + 1}`;
      try {
        await saveImageResultData(imageResultId, generatedSource);
        imageResultIds.push(imageResultId);
        displaySources.push(await loadImageResultData(imageResultId) || generatedSource);
      } catch (storageError) {
        if (/^https?:\/\//i.test(generatedSource)) {
          imageUrls.push(generatedSource);
          displaySources.push(generatedSource);
          console.warn('Image result persisted as remote URL:', storageError);
        } else {
          throw storageError;
        }
      }
    }
    if (SessionSystem.isTaskCanceled(taskId)) {
      Object.assign(task, { status: 'canceled', progress: 100, errorMsg: '已取消' });
      await Promise.all(imageResultIds.map(id => deleteImageResultData(id).catch(error => console.warn('Canceled image result cleanup failed:', error))));
      const liveCard = document.getElementById(`task-card-${taskId}`) || (card?.isConnected ? card : null);
      if (liveCard) await renderChatImageCardResult(liveCard, task, []);
      return;
    }
    const currentTask = state.activeTasks.find(item => item.taskId === taskId)
      || state.taskHistory.find(item => item.taskId === taskId)
      || task;
    Object.assign(currentTask, {
      imageResultIds,
      imageUrls,
      imageResultId: imageResultIds[0] || null,
      imageUrl: imageUrls[0] || null,
      batchWarning: generatedSources.length < normalizedCount
        ? `本次需要 ${normalizedCount} 张，实际返回 ${generatedSources.length} 张`
        : null
    });
    const completedTask = completeTask(taskId, 'completed', null, null, promptText, model, generated.task);
    const liveCard = document.getElementById(`task-card-${taskId}`) || (card?.isConnected ? card : null);
    if (liveCard) await renderChatImageCardResult(liveCard, completedTask, displaySources);
    showToast(generatedSources.length < normalizedCount
      ? `图片部分完成：已生成 ${generatedSources.length}/${normalizedCount} 张`
      : `图片生成完成，共 ${generatedSources.length} 张`, generatedSources.length < normalizedCount ? 'warning' : 'success');
  } catch (error) {
    if (SessionSystem.isTaskCanceled(taskId)) {
      Object.assign(task, { status: 'canceled', progress: 100, errorMsg: '已取消' });
      const liveCard = document.getElementById(`task-card-${taskId}`) || (card?.isConnected ? card : null);
      if (liveCard) await renderChatImageCardResult(liveCard, task, null);
      return;
    }
    const failedTask = completeTask(taskId, 'failed', null, error.message || '图片生成失败', promptText, model, error.task || null);
    const liveCard = document.getElementById(`task-card-${taskId}`) || (card?.isConnected ? card : null);
    if (liveCard) await renderChatImageCardResult(liveCard, failedTask, null);
    showToast(`图片生成失败：${failedTask.errorMsg}`);
  } finally {
    stopProgress();
    activeImageSubmissions.delete(taskId);
    syncCreationSubmitButtonState();
  }
  scrollChatToBottom();
}

async function downloadGeneratedImage(source, task) {
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    const imageSuffix = Number.isInteger(task?.imageIndex) ? `_${task.imageIndex + 1}` : '';
    link.download = `image_${task.taskId.slice(0, 16)}${imageSuffix}.${blob.type.includes('jpeg') ? 'jpg' : (blob.type.split('/')[1] || 'png')}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    showToast(`图片下载失败：${error.message}`);
  }
}

async function saveGeneratedImageToAssetLibrary(source, task) {
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`图片读取失败 (HTTP ${response.status})`);
    const blob = await response.blob();
    const extension = blob.type.includes('jpeg') ? 'jpg' : (blob.type.split('/')[1] || 'png');
    const imageSuffix = Number.isInteger(task?.imageIndex) ? `-${task.imageIndex + 1}` : '';
    const file = new File([blob], `AI生成图片${imageSuffix}-${Date.now()}.${extension}`, { type: blob.type || 'image/png' });
    const uploaded = await apiUploadMedia(file);
    await BackendClient.createLibraryAsset({
      name: String(task.prompt || 'AI 生成图片').slice(0, 40),
      description: task.prompt || '',
      category: '场景',
      scope: 'private',
      mediaIds: [uploaded.id],
      coverMediaId: uploaded.id
    });
    await loadLibraryData({ silent: true });
    if (typeof renderAssetGridUI === 'function') renderAssetGridUI();
    showToast('图片已存入资产库', 'success');
  } catch (error) {
    showToast(`存入资产库失败：${error.message}`, 'error');
  }
}

function renderLlmConfirmCard(aiBox, rawPrompt, currentExpandedPrompt, options, apiErrorMsg = null, isStreaming = false) {
  const msgContentNode = (aiBox && aiBox.classList && aiBox.classList.contains('ai-msg-content')) 
    ? aiBox 
    : (aiBox ? (aiBox.querySelector('.ai-msg-content') || aiBox) : null);
  if (!msgContentNode) return;

  const cardId = `llm_card_${Date.now()}`;
  const errorBannerHtml = apiErrorMsg ? `
    <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; font-size: 0.775rem; color: #f87171;">
      <strong>⚠️ LLM API 返回异常:</strong> ${escapeHTML(apiErrorMsg)}
      <div style="color: #94a3b8; font-size: 0.725rem; margin-top: 4px;">已为您自动无缝切换至【内置小云雀导演引擎】完成扩写，您可在下方编辑框中微调提示词：</div>
    </div>
  ` : '';

  const hasImages = options && options.images && options.images.length > 0;
  const hasVideos = options && options.videos && options.videos.length > 0;
  const hasAudios = options && options.audios && options.audios.length > 0;
  const refMediaList = options && options.refMediaList ? options.refMediaList : [];

  let mediaBadgeHtml = '';
  if (hasImages || hasVideos || hasAudios || refMediaList.length > 0) {
    const mediaThumbnails = (refMediaList.length > 0 ? refMediaList : (options.images || []).map((url, i) => ({ tag: `@图${i+1}`, url, type: 'image' }))).map(m => `
      <div class="ref-chip-btn" data-tag="${escapeHTML(m.tag || '@图')}" title="点击把 ${escapeHTML(m.tag || '@图')} 插入故事板" style="display: inline-flex; align-items: center; gap: 6px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px 8px; font-size: 0.775rem; font-weight: 600; color: #1e293b; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: pointer;">
        ${m.type === 'audio'
          ? '<span class="thumb-media-audio" style="width:24px;height:24px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;">♫</span>'
          : m.type === 'video'
            ? `<video data-lazy-video-src="${escapeHTML(m.url)}" data-lazy-video-release="auto" muted playsinline preload="none" style="width:24px;height:24px;object-fit:cover;border-radius:4px;"></video>`
            : `<img src="${escapeHTML(m.url)}" style="width:24px;height:24px;object-fit:cover;border-radius:4px;" alt="参考图">`}
        <span style="color: #2563eb;">${escapeHTML(m.tag || '@图')}</span>
      </div>
    `).join('');

    mediaBadgeHtml = `
      <div style="font-size: 0.775rem; color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 8px 12px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 6px;">
        <div style="font-weight: 700; display: flex; align-items: center; gap: 6px;">
          <span>📎 已绑定参考媒体（图片、视频、音频会随视频任务发送）:</span>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          ${mediaThumbnails}
        </div>
      </div>
    `;
  }

  const cardHtml = `
    <div class="llm-confirm-card" id="${cardId}">
      <div class="confirm-card-header">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>✨ 故事板</span>
        </div>
        <span class="confirm-status-badge">✍️ 待确认 / 可反复编辑</span>
      </div>

      <div class="confirm-card-body">
        ${errorBannerHtml}
        ${mediaBadgeHtml}
        <div style="font-size: 0.75rem; color: #166534; margin-bottom: 6px; font-weight: 500;">
          💡 提示：您可以在下方编辑框中自由修改或删除不符合意图的词汇，满意后点击提交渲染：
        </div>
        <textarea class="confirm-textarea code-font" rows="5" id="textarea-${cardId}">${escapeHTML(currentExpandedPrompt)}</textarea>
      </div>

      <div class="confirm-card-footer">
        <button type="button" class="btn btn-secondary btn-sm btn-re-expand" id="btn-re-${cardId}">✨ 开始扩写</button>
        <button type="button" class="btn btn-primary btn-sm btn-confirm-render" id="btn-submit-${cardId}">⚡ 确认提交渲染视频</button>
      </div>
    </div>
  `;

  msgContentNode.innerHTML = cardHtml;
  scrollChatToBottom();

  const textareaEl = document.getElementById(`textarea-${cardId}`);
  const btnReExpand = document.getElementById(`btn-re-${cardId}`);
  const btnSubmit = document.getElementById(`btn-submit-${cardId}`);

  if (textareaEl) {
    textareaEl.addEventListener('input', handleChatTextareaInput);
    textareaEl.addEventListener('focus', () => { activeTextareaForAt = textareaEl; });
  }

  // 点击上方参考图 Chip 标签也可以直接插入到故事板 textarea
  const mediaBadgeBox = msgContentNode.querySelector('.llm-confirm-card');
  if (mediaBadgeBox) {
    mediaBadgeBox.querySelectorAll('.at-menu-item-chip, [data-tag]').forEach(chip => {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', (e) => {
        const tag = chip.getAttribute('data-tag') || (chip.querySelector('span') ? chip.querySelector('span').textContent.trim() : '');
        if (tag && textareaEl) {
          insertAtTagIntoTextarea(tag, false, textareaEl);
          showToast(`已将 ${tag} 插入故事板编辑框`);
        }
      });
    });
  }

  // 初始流式输出阶段：禁用提交和重写按钮
  if (isStreaming) {
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.style.opacity = '0.4';
      btnSubmit.style.cursor = 'not-allowed';
      btnSubmit.textContent = '⏳ 提示词扩写中...';
    }
    if (btnReExpand) {
      btnReExpand.disabled = true;
      btnReExpand.style.opacity = '0.4';
      btnReExpand.style.cursor = 'not-allowed';
    }
  }

  // 1. ✨ 开始扩写 按钮事件（点击后 AI 帮用户把提示词扩写）
  btnReExpand.addEventListener('click', async () => {
    const currentInputText = textareaEl.value.trim() || rawPrompt;
    btnReExpand.disabled = true;
    btnReExpand.textContent = '⏳ AI 正在扩写镜头与细节...';
    showToast('🧠 大语言模型正在为您生成镜头细化与微表情扩写...');
    try {
      const newExpanded = await apiCallLlmExpandPrompt(currentInputText, (chunkText) => {
        if (textareaEl && chunkText) {
          textareaEl.value = chunkText;
          scrollChatToBottom();
        }
      });
      if (textareaEl && newExpanded) textareaEl.value = newExpanded;
      showToast('✨ 扩写完成！您可继续微调或直接提交');
      } catch (err) {
        console.warn('Expand prompt error:', err);
        showToast(`❌ 扩写失败：${err.message}`, 'error');
      } finally {
      btnReExpand.disabled = false;
      btnReExpand.textContent = '✨ 重新扩写';
    }
  });

  // 2. 确认并提交渲染按钮事件（原封不动提交故事板编辑框中的文本）
  btnSubmit.addEventListener('click', async () => {
    let finalPrompt = textareaEl.value.trim();
    if (!finalPrompt) {
      alert('提示词不能为空！');
      return;
    }

    // 锁死编辑框，保持提交的提示词内容不动
    textareaEl.disabled = true;
    textareaEl.style.background = '#f8fafc';
    textareaEl.style.color = '#334155';
    btnReExpand.style.display = 'none';

    btnSubmit.disabled = true;
    btnSubmit.style.background = '#10b981';
    btnSubmit.style.color = '#ffffff';
    btnSubmit.innerHTML = '✅ 提示词已确认，正在提交渲染...';

    const statusBadge = document.querySelector(`#${cardId} .confirm-status-badge`);
    if (statusBadge) {
      statusBadge.textContent = '✅ 已确认提交渲染';
      statusBadge.style.background = 'rgba(16, 185, 129, 0.1)';
      statusBadge.style.color = '#059669';
      statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    }

    showToast('🚀 正在提交算力渲染，请稍候...');
    try {
      await submitVideoRenderFlow(msgContentNode, finalPrompt, options);
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '✅ 已提交，正在生成';
      btnSubmit.title = '任务已进入生成队列';
    } catch (err) {
      console.error('Submit render error:', err);
      textareaEl.disabled = false;
      textareaEl.style.background = '';
      textareaEl.style.color = '';
      btnReExpand.style.display = '';
      btnSubmit.disabled = false;
      btnSubmit.style.background = 'var(--primary-color, #2563eb)';
      btnSubmit.innerHTML = '⚡ 提交失败，点击重试';
      if (statusBadge) {
        statusBadge.textContent = '❌ API 提交失败';
        statusBadge.style.background = 'rgba(239, 68, 68, 0.1)';
        statusBadge.style.color = '#dc2626';
        statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      }
      showToast(`❌ 提交渲染失败: ${err.message}`);
    }
  });

  return cardId;
}

async function submitVideoRenderFlow(aiBox, finalPrompt, options) {
  const originSession = SessionSystem.getActive();
  const originSessionId = options.sessionId || (originSession?.type === 'creation' ? originSession.id : null);
  const model = options.model || state.apiConfig.model || DEFAULT_VIDEO_MODEL;
  const aspectRatio = options.aspectRatio || '16:9';
  const duration = options.duration || 5;

  const controller = new AbortController();
  if (originSessionId) SessionSystem.registerPendingRequest(originSessionId, controller);
  try {
    const res = await apiSubmitVideo(finalPrompt, { ...options, sessionId: originSessionId, signal: controller.signal });
    if (controller.signal.aborted) throw new DOMException('提交已取消', 'AbortError');
    const taskId = extractVideoTaskId(res);
    if (!taskId) throw new Error('接口未返回有效任务 ID，请检查供应商响应格式');
    const cardEl = createChatGenCard(aiBox, taskId, finalPrompt, model, aspectRatio, duration, res.status || 'queued', res.progress || 0, res);

    const newTask = SessionSystem.assignTask({
      source: 'chat',
      mediaType: 'video',
      taskId: taskId,
      prompt: finalPrompt,
      model: model,
      duration: duration,
      options: options,
      status: res.status || 'queued',
      progress: res.progress || 0,
      reservedCredits: res.reservedCredits || res.pricing?.credits || 0,
      consumedCredits: res.consumedCredits || 0,
      pricing: res.pricing || null,
      createdAt: Date.now(),
      sessionId: originSessionId,
      sessionType: 'creation'
    }, 'creation');
    state.activeTasks.unshift(newTask);
    updateStatusIndicators();
    try {
      await SessionSystem.trackTask(newTask);
    } catch (error) {
      console.warn('Video task session save failed:', error);
    }
    SessionSystem.scheduleSave();

    startChatCardPoller(taskId, cardEl, finalPrompt, model);
    showToast('✅ 视频渲染任务已成功发起并进入渲染队列！');
  } catch (err) {
    if (controller.signal.aborted) throw new DOMException('提交已取消', 'AbortError');
    console.error('submitVideoRenderFlow caught error:', err);
    const failedId = `fail_${Date.now()}`;
    const failedTask = SessionSystem.assignTask({
      taskId: failedId,
      prompt: finalPrompt,
      model: model,
      duration: duration,
      options: options,
      source: 'chat',
      mediaType: 'video',
      status: 'failed',
      progress: 100,
      createdAt: Date.now(),
      errorMsg: err.message,
      sessionId: originSessionId,
      sessionType: 'creation'
    }, 'creation');
    saveTaskToHistory(failedTask);
    void SessionSystem.handleTaskFinished(failedTask, 'failed').catch(error => console.warn('Failed video task session save failed:', error));
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'color: #ef4444; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 10px 14px; margin-top: 10px; font-size: 0.8rem; line-height: 1.5;';
    errDiv.innerHTML = `<strong>❌ 视频渲染提交失败:</strong> ${escapeHTML(err.message)}`;
    aiBox.appendChild(errDiv);
    showToast(`❌ 渲染提交失败: ${err.message}`);
    throw err;
  } finally {
    if (originSessionId) SessionSystem.unregisterPendingRequest(originSessionId, controller);
  }

  scrollChatToBottom();
}

function messageCopyButton(text, label = '复制文字') {
  if (!String(text || '').trim()) return '';
  return `<button type="button" class="chat-copy-button" data-copy-message="${encodeURIComponent(String(text))}" title="${label}" aria-label="${label}">复制</button>`;
}

async function copyChatMessageText(button) {
  const text = decodeURIComponent(button?.dataset?.copyMessage || '');
  if (!text) return false;
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    copied = document.execCommand('copy') === true;
    textarea.remove();
  }
  const original = button.textContent;
  button.textContent = copied ? '已复制' : '复制失败';
  if (!copied) showToast('复制失败，请手动选择文字复制', 'error');
  window.setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1200);
  return copied;
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-copy-message]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  void copyChatMessageText(button);
});

function appendAiUserBubble(text, refMediaList) {
  const geminiWelcomeCard = document.getElementById('geminiWelcomeCard');
  if (geminiWelcomeCard) {
    geminiWelcomeCard.style.setProperty('display', 'none', 'important');
    geminiWelcomeCard.classList.add('hidden');
    geminiWelcomeCard.remove();
  }

  const row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 12px; max-width: 80%; align-self: flex-end; margin-left: auto; flex-direction: row-reverse; margin-bottom: 16px;';
  
  let tagsHtml = '';
  if (refMediaList && refMediaList.length > 0) {
    tagsHtml = `<div style="font-size: 0.75rem; margin-top: 8px; opacity: 0.95; display: flex; gap: 8px; flex-wrap: wrap;">
      ${refMediaList.map(m => `
        <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.25); padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.4);">
          ${m.type === 'audio'
            ? '<span class="thumb-media-audio" style="width:24px;height:24px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;">♫</span>'
            : m.type === 'video'
              ? `<video data-lazy-video-src="${escapeHTML(m.url)}" data-lazy-video-release="auto" muted playsinline preload="none" style="width:24px;height:24px;border-radius:4px;object-fit:cover;"></video>`
              : `<img src="${escapeHTML(m.url)}" style="width:24px;height:24px;border-radius:4px;object-fit:cover;" />`}
          <span>📎 ${m.tag}: ${escapeHTML(m.fileName)}</span>
        </div>
      `).join('')}
    </div>`;
  }

  row.innerHTML = `
    <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0;">👤</div>
    <div class="chat-message-shell is-user">
      <div class="chat-message-bubble" style="background: var(--primary); color: #fff; padding: 12px 16px; border-radius: 18px 18px 2px 18px; font-size: 0.9rem; line-height: 1.5; box-shadow: var(--shadow-sm);">
        <div class="chat-message-text">${escapeHTML(text)}</div>
        ${tagsHtml}
      </div>
      ${messageCopyButton(text)}
    </div>
  `;
  el.aiChatStream.appendChild(row);
  observeManagedVideos(row);
  scrollChatToBottom();
}

function appendAiAssistantBubble(initialText) {
  const geminiWelcomeCard = document.getElementById('geminiWelcomeCard');
  if (geminiWelcomeCard) {
    geminiWelcomeCard.style.setProperty('display', 'none', 'important');
    geminiWelcomeCard.classList.add('hidden');
    geminiWelcomeCard.remove();
  }

  const row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 12px; max-width: 80%; align-self: flex-start; margin-right: auto; margin-bottom: 16px;';
  row.innerHTML = `
    <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
      <img src="assets/bear_head_icon.png" alt="Bear AI" style="width: 24px; height: 24px; object-fit: contain;" />
    </div>
    <div class="chat-message-shell is-assistant">
      <div class="ai-msg-content" style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0;">
        <div class="chat-message-bubble chat-message-text" style="background: #ffffff; border: 1px solid var(--border-color); color: var(--text-main); padding: 12px 16px; border-radius: 18px 18px 18px 2px; font-size: 0.9rem; line-height: 1.5; box-shadow: var(--shadow-sm);">
          ${escapeHTML(initialText)}
        </div>
      </div>
      ${messageCopyButton(initialText)}
    </div>
  `;
  el.aiChatStream.appendChild(row);
  scrollChatToBottom();
  return row.querySelector('.ai-msg-content');
}

function renderCompletedChatVideoTarget(task) {
  const videoUrl = task?.videoUrl || '';
  if (!videoUrl) return '<div style="color:#059669;font-size:0.8rem;padding:6px;">渲染已完成，服务端未返回可播放地址。</div>';
  const source = safeMediaUrl(videoUrl);
  if (!source) return '<div class="task-error-message">视频地址无效或使用了不安全协议</div>';
  return `
    <video class="task-video-preview" data-lazy-video-src="${escapeHTML(source)}" data-click-video-load="1" controls loop muted playsinline preload="none"></video>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="flex:1;justify-content:center;font-size:0.75rem;">展开大屏</a>
      <button type="button" class="btn btn-primary btn-save-kb" data-save-video-task="${escapeHTML(task.taskId)}" style="flex:1;font-size:0.75rem;">存入知识库</button>
    </div>`;
}

async function saveCompletedVideoTaskToKnowledgeBase(taskId) {
  const task = state.taskHistory.find(item => item.taskId === taskId) || state.activeTasks.find(item => item.taskId === taskId);
  if (!task?.videoUrl) return;
  const newItem = {
    id: `prompt-${Date.now()}`,
    title: (task.prompt || 'AI 生成视频').slice(0, 20),
    prompt: task.prompt || '',
    shotSize: '特写',
    movement: '推镜头',
    angle: '平视角度',
    category: '人物肖像',
    videoUrl: task.videoUrl,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await PromptStore.save(newItem);
  await loadPrompts();
  showToast('已成功保存到知识库');
}

function shortenChatTaskId(taskId) {
  const value = String(taskId || '');
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-5)}`;
}

function getMedianNumber(values = []) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function estimateVideoTotalSeconds(task = {}) {
  const model = String(task.model || '');
  const duration = Math.max(1, Number(task.duration || task.options?.duration || 5));
  const completedSamples = (state.taskHistory || [])
    .filter(item => item.status === 'completed' && (item.mediaType === 'video' || item.operation === 'video' || item.videoUrl))
    .map(item => ({
      model: String(item.model || ''),
      duration: Math.max(1, Number(item.duration || item.options?.duration || 5)),
      seconds: (Number(item.updatedAt || 0) - Number(item.createdAt || 0)) / 1000
    }))
    // 排除历史迁移产生的瞬时记录，以及超过一小时的异常任务。
    .filter(item => Number.isFinite(item.seconds) && item.seconds >= 30 && item.seconds <= 3600);
  const exactSamples = completedSamples
    .filter(item => item.model === model && item.duration === duration)
    .map(item => item.seconds);
  const modelSamples = completedSamples
    .filter(item => item.model === model)
    .map(item => item.seconds);
  const historicalMedian = getMedianNumber(exactSamples.length >= 2 ? exactSamples : modelSamples);
  // 当前视频模型的真实历史通常约 9～10 分钟；样本不足时按成片时长保守递增。
  return Math.round(historicalMedian || Math.min(20 * 60, 480 + duration * 15));
}

function renderVideoEta(task = {}, status = 'in_progress') {
  if (!task?.createdAt || !['queued', 'in_progress', 'running', 'rendering', 'paused', 'reconciling', 'needs_review'].includes(String(status))) return '';
  const elapsedSeconds = Math.max(0, (Date.now() - Number(task.createdAt)) / 1000);
  const remainingSeconds = estimateVideoTotalSeconds(task) - elapsedSeconds;
  if (remainingSeconds <= 0) return '<span class="chat-video-eta">· 已超过预计时间，仍在处理</span>';
  if (remainingSeconds < 60) return '<span class="chat-video-eta">· 预计还需不到 1 分钟</span>';
  const minutes = Math.max(1, Math.round(remainingSeconds / 60));
  return `<span class="chat-video-eta">· 预计还需约 ${minutes} 分钟</span>`;
}

function renderChatVideoProgressLabel(status, progress = 0, task = null) {
  const normalizedStatus = String(status || 'queued').toLowerCase();
  const normalizedProgress = normalizedStatus === 'completed'
    ? 100
    : Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  if (normalizedStatus === 'completed') {
    return '<span class="chat-video-progress-label-inner is-completed">生成完成 100%</span>';
  }
  if (['failed', 'refunded', 'canceled'].includes(normalizedStatus)) {
    return '<span class="chat-video-progress-label-inner is-failed">生成失败</span>';
  }
  const statusText = normalizedStatus === 'queued'
    ? '排队中'
    : normalizedStatus === 'reconciling'
      ? '网络波动，自动恢复中'
      : normalizedStatus === 'needs_review'
        ? '等待供应商状态确认'
        : '生成中';
  return `<span class="chat-video-progress-label-inner"><i class="chat-video-progress-spinner" aria-hidden="true"></i>${statusText} ${normalizedProgress}% ${renderVideoEta(task, normalizedStatus)}</span>`;
}

function upgradeChatVideoTaskCard(card, task = {}) {
  if (!card) return card;
  const taskId = String(task.taskId || card.id?.replace(/^task-card-/, '') || '');
  const status = ['queued', 'in_progress', 'running', 'rendering', 'paused', 'reconciling', 'needs_review'].includes(task.status)
    ? 'in_progress'
    : (task.status || 'in_progress');
  const progress = status === 'completed' ? 100 : Math.max(0, Math.min(100, Number(task.progress) || 0));

  let header = card.querySelector('.task-header');
  if (!header) {
    header = document.createElement('div');
    card.prepend(header);
  }
  header.className = 'task-header chat-video-task-header';
  header.innerHTML = `<span class="task-id-tag" title="完整任务 ID：${escapeHTML(taskId)}">ID: ${escapeHTML(shortenChatTaskId(taskId))}</span>`;

  let track = card.querySelector('[data-video-progress-track]') || card.querySelector('.progress-track');
  if (!track) {
    track = document.createElement('div');
    const resultTarget = card.querySelector(`[id$="target-${CSS.escape(taskId)}"]`);
    if (resultTarget) resultTarget.before(track);
    else card.appendChild(track);
  }
  track.className = 'progress-track chat-video-progress-track';
  track.dataset.videoProgressTrack = '';
  track.dataset.status = status;
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', '视频生成进度');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-valuenow', String(progress));

  let fill = track.querySelector('.progress-bar-inner');
  if (!fill) fill = document.createElement('div');
  fill.className = 'progress-bar-inner';
  fill.id = `chat-progress-${taskId}`;
  fill.style.width = `${status === 'completed' ? 100 : Math.max(progress, 8)}%`;

  let label = track.querySelector('[data-video-progress-label]');
  if (!label) label = document.createElement('div');
  label.className = 'chat-video-progress-label';
  label.dataset.videoProgressLabel = '';
  label.setAttribute('aria-live', 'polite');
  label.innerHTML = renderChatVideoProgressLabel(status, progress, task);
  track.replaceChildren(fill, label);

  const target = card.querySelector(`[id$="target-${CSS.escape(taskId)}"]`);
  if (target) {
    target.className = 'chat-video-result-target';
    if (target.querySelector('[data-resume-task]') || /页面刷新后任务查询已暂停/.test(target.textContent || '')) target.replaceChildren();
  }
  return card;
}

function createChatGenCard(container, taskId, promptText, model, aspectRatio, duration, initialStatus = 'queued', initialProgress = 0, billingTask = null) {
  const card = document.createElement('div');
  card.className = 'task-item-card';
  card.id = `task-card-${taskId}`;
  card.style.cssText = 'width: 380px; max-width: 100%; margin-top: 4px; background: #ffffff;';
  const progressValue = initialStatus === 'completed' ? 100 : Math.max(Number(initialProgress) || 0, 8);
  const fullTaskId = String(taskId || '');

  card.innerHTML = `
    <div class="task-header chat-video-task-header">
      <span class="task-id-tag" title="完整任务 ID：${escapeHTML(fullTaskId)}">ID: ${escapeHTML(shortenChatTaskId(fullTaskId))}</span>
    </div>
    <div style="font-size: 0.775rem; color: var(--text-muted);">
      ⚙️ 模型: <code>${escapeHTML(model)}</code> | 比例: ${escapeHTML(aspectRatio)} | 时长: ${duration}s
    </div>
    <div id="chat-credits-${escapeHTML(taskId)}">${renderTaskCreditBreakdown(billingTask)}</div>
    <div class="progress-track chat-video-progress-track" data-video-progress-track data-status="${escapeHTML(initialStatus)}" role="progressbar" aria-label="视频生成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressValue}">
      <div class="progress-bar-inner" id="chat-progress-${taskId}" style="width: ${progressValue}%;"></div>
      <div class="chat-video-progress-label" data-video-progress-label aria-live="polite">${renderChatVideoProgressLabel(initialStatus, initialProgress, billingTask)}</div>
    </div>
    <div id="chat-target-${taskId}" class="chat-video-result-target"></div>
  `;
  container.appendChild(card);
  return card;
}

function startChatCardPoller(taskId, cardEl, promptText, model) {
  if (SessionSystem.hasPoller(taskId)) return;
  const MAX_VIDEO_POLL_ERRORS = 8;
  const MAX_VIDEO_POLL_DURATION_MS = 45 * 60 * 1000;
  let currentCardEl = cardEl;
  let progressInner = null;
  let progressTrack = null;
  let progressLabel = null;
  let targetArea = null;
  const bindCurrentCard = () => {
    const liveCard = document.getElementById(`task-card-${taskId}`);
    if (liveCard) currentCardEl = liveCard;
    if (!currentCardEl) return;
    progressInner = currentCardEl.querySelector(`#chat-progress-${CSS.escape(taskId)}`);
    progressTrack = currentCardEl.querySelector('[data-video-progress-track]');
    progressLabel = currentCardEl.querySelector('[data-video-progress-label]');
    targetArea = currentCardEl.querySelector(`#chat-target-${CSS.escape(taskId)}`);
  };
  bindCurrentCard();
  const startTime = Date.now();
  let consecutivePollErrors = 0;

  const poller = setInterval(async () => {
    // 会话重新打开后 DOM 卡片会重建；每轮按任务 ID 重新绑定当前可见卡片。
    bindCurrentCard();
    if (SessionSystem.isTaskCanceled(taskId)) {
      clearInterval(poller);
      SessionSystem.unregisterPoller(taskId, poller);
      return;
    }
    // 必须用后端 UUID 查询，前端 taskId（image_xxx/video_xxx）会导致后端 500
    const taskObj = state.activeTasks.find(t => t.taskId === taskId);
    const pollId = taskObj?.backendTaskId || taskId;
    if (!pollId) {
      clearInterval(poller);
      SessionSystem.unregisterPoller(taskId, poller);
      const failed = completeTask(taskId, 'failed', null, '接口未返回有效任务 ID', promptText, model);
      if (targetArea) targetArea.innerHTML = `<div class="task-error-message">${escapeHTML(failed.errorMsg || '接口未返回有效任务 ID')}</div>`;
      return;
    }
    try {
      if (Date.now() - startTime > MAX_VIDEO_POLL_DURATION_MS) {
        throw new Error('视频状态查询已超过 45 分钟');
      }
      const info = await apiPollVideo(pollId);
      if (SessionSystem.isTaskCanceled(taskId)) return;
      consecutivePollErrors = 0;
      const parsed = parseVideoTaskResponse(info, startTime);
      const status = parsed.status;
      const previousProgress = Number(taskObj?.progress || 0);
      // 供应商偶尔缺少 progress；进度只能向前，不能因兜底值或轮询重建而倒退。
      const progress = ['completed', 'failed', 'refunded', 'canceled'].includes(status)
        ? parsed.progress
        : Math.max(previousProgress, Number(parsed.progress || 0));

      // 同步更新全套全局任务状态
      const taskInState = state.activeTasks.find(t => t.taskId === taskId);
      if (taskInState) {
        taskInState.status = status;
        taskInState.progress = progress;
        applyBackendTaskBilling(taskInState, info);
      }
      const creditsArea = currentCardEl?.querySelector(`#chat-credits-${CSS.escape(taskId)}`);
      if (creditsArea) creditsArea.innerHTML = renderTaskCreditBreakdown(taskInState || info);
      updateTaskQueueUI();
      updateStatusIndicators();

      if (progressInner) {
        progressInner.style.width = `${Math.max(progress, 8)}%`;
      }
      if (progressTrack) {
        progressTrack.dataset.status = status;
        progressTrack.setAttribute('aria-valuenow', String(progress));
      }
      if (progressLabel) progressLabel.innerHTML = renderChatVideoProgressLabel(status, progress, taskInState || taskObj);

      if (status === 'completed') {
        clearInterval(poller);
        SessionSystem.unregisterPoller(taskId, poller);
        const videoUrl = safeMediaUrl(parsed.videoUrl || (info.metadata && info.metadata.url) || info.video_url || info.url);
        if (!videoUrl) {
          const failedTask = completeTask(taskId, 'failed', null, '供应商返回了不安全或缺失的视频地址', promptText, model, info);
          if (targetArea) targetArea.innerHTML = `<div class="task-error-message">${escapeHTML(failedTask.errorMsg)}</div>`;
          showToast('视频生成返回了无效地址', 'error');
          return;
        }
        completeTask(taskId, 'completed', videoUrl, null, promptText, model, info);
        showToast('🎉 视频在线渲染完成！');

        if (targetArea) {
          if (videoUrl) {
            const safeSource = setSafeVideoResult(targetArea, videoUrl, {
              onSave: async () => {
                const newItem = {
                  id: `prompt-${Date.now()}`,
                  title: promptText.slice(0, 20) + (promptText.length > 20 ? '...' : ''),
                  prompt: promptText,
                  shotSize: '特写',
                  movement: '推镜头',
                  angle: '平视角度',
                  category: '人物肖像',
                  videoUrl: safeMediaUrl(videoUrl),
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                };
                await PromptStore.save(newItem);
                await loadPrompts();
                showToast('✅ 已成功保存到镜头库！');
              }
            });
            if (!safeSource) completeTask(taskId, 'failed', null, '供应商返回了不安全的视频地址', promptText, model, info);
          } else {
            targetArea.innerHTML = `<div style="color: #059669; font-size: 0.8rem; padding: 6px;">🎉 渲染完成！已在生成历史中查看成果</div>`;
          }
        }
      } else if (['failed', 'refunded', 'canceled'].includes(status)) {
        clearInterval(poller);
        SessionSystem.unregisterPoller(taskId, poller);
        let rawErr = parsed.errorMsg || (info.error && info.error.message) || info.message || '生成失败';
        let errMsg = rawErr;
        if (typeof rawErr === 'string' && (rawErr.includes('403') || rawErr.includes('Unauthorized') || rawErr.includes('access_error') || rawErr.includes('no access'))) {
          errMsg = `API 权限拦截 [403 Access Error]: 当前 Key 未获授权调用模型 "${model}"。请在顶部配置中检查 Key 权限或模型选中。`;
        }
        
        // 从队列中移除，并移入生成历史
        completeTask(taskId, status, null, errMsg, promptText, model, info);

        if (targetArea) {
          targetArea.innerHTML = `<div style="color: #dc2626; background: rgba(254, 226, 226, 0.6); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 10px 14px; font-size: 0.8rem; line-height: 1.5; text-align: left; margin-top: 4px;"><strong>❌ 视频渲染中断:</strong> ${escapeHTML(errMsg)}</div>`;
        }
      }
    } catch (err) {
      consecutivePollErrors += 1;
      console.error('Chat poller error:', err);
      if (targetArea) {
        targetArea.innerHTML = `<div style="color: #b45309; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 10px 14px; font-size: 0.8rem; line-height: 1.5; text-align: left; margin-top: 4px;"><strong>状态查询失败 (${consecutivePollErrors}/3)：</strong> ${escapeHTML(err.message)}</div>`;
      }
      if (consecutivePollErrors >= MAX_VIDEO_POLL_ERRORS) {
        clearInterval(poller);
        SessionSystem.unregisterPoller(taskId, poller);
        const errMsg = `状态查询连续失败 ${consecutivePollErrors} 次，已停止自动重试：${err.message}`;
        const activeTask = state.activeTasks.find(item => item.taskId === taskId);
        if (activeTask) {
          activeTask.status = 'needs_review';
          activeTask.errorMsg = errMsg;
          void SessionSystem.trackTask(activeTask).catch(error => console.warn('视频待确认状态保存失败:', error));
        }
        if (progressTrack) progressTrack.dataset.status = 'needs_review';
        if (progressLabel) progressLabel.innerHTML = renderChatVideoProgressLabel('needs_review', activeTask?.progress || 0, activeTask);
        if (targetArea) {
          targetArea.innerHTML = `<div style="color:#92400e;background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:10px 14px;font-size:.8rem;"><strong>已停止自动查询：</strong> ${escapeHTML(errMsg)}。可刷新当前页面后重新发起任务。</div>`;
        }
        showToast('视频状态查询已停止，请检查 API 或网络后重试', 'warning');
      } else if (consecutivePollErrors >= 3) {
        const errMsg = `任务已提交，网络波动，后台会自动重试查询。${err.message}`;
        const activeTask = state.activeTasks.find(item => item.taskId === taskId);
        if (activeTask) {
          activeTask.status = 'reconciling';
          activeTask.errorMsg = errMsg;
          void SessionSystem.trackTask(activeTask).catch(error => console.warn('视频恢复状态保存失败:', error));
        }
        if (progressTrack) progressTrack.dataset.status = 'reconciling';
        if (progressLabel) progressLabel.innerHTML = renderChatVideoProgressLabel('reconciling', activeTask?.progress || 0, activeTask);
        if (targetArea) {
          targetArea.innerHTML = `<div style="color: #b45309; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 10px 14px; font-size: 0.8rem; line-height: 1.5; text-align: left; margin-top: 4px;"><strong>网络波动：</strong> ${escapeHTML(errMsg)}</div>`;
        }
        if (consecutivePollErrors === 3) showToast('视频状态查询出现网络波动，后台会继续自动恢复');
      }
    }
  }, 3000);
  SessionSystem.registerPoller(taskId, poller);
}

function scrollChatToBottom() {
  setTimeout(() => {
    if (el.aiChatStream) {
      el.aiChatStream.scrollTop = el.aiChatStream.scrollHeight;
    }
  }, 100);
}

/* ==========================================================================
   交互式小熊登录系统 (1280x720 超清画质 & 精准 360° 视线实时跟随引擎)
   ========================================================================== */

const BEAR_SPECIAL_FRAMES = {
  DEFAULT_FRONT: 42,
  TYPING_USER: 50,
  TYPING_PASS: 55,
  SHOW_PASS: 82,
  HIDE_PASS: 90,
  SUBMIT_SUCCESS: 65
};

function getBearHeadScreenPosition() {
  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;
  const frameWidth = 1280;
  const frameHeight = 720;

  const containerRatio = containerWidth / containerHeight;
  const frameRatio = frameWidth / frameHeight;

  let renderWidth, renderHeight, offsetX, offsetY;

  if (containerRatio > frameRatio) {
    renderWidth = containerWidth;
    renderHeight = containerWidth / frameRatio;
    offsetX = 0;
    offsetY = (containerHeight - renderHeight) / 2;
  } else {
    renderWidth = containerHeight * frameRatio;
    renderHeight = containerHeight;
    offsetX = (containerWidth - renderWidth) / 2;
    offsetY = 0;
  }

  // 小熊眼罩在 1280x720 原始画幅左侧的真实像素坐标为 (223.0, 280.5)
  return {
    x: offsetX + (223.0 / frameWidth) * renderWidth,
    y: offsetY + (280.5 / frameHeight) * renderHeight
  };
}

function getExactFrameFromAngle(angleDeg) {
  let normAngle = (angleDeg % 360 + 360) % 360;
  if (normAngle <= 180) {
    return 42 + (normAngle / 180.0) * (94 - 42);
  } else {
    return 1 + ((normAngle - 180.0) / 180.0) * (42 - 1);
  }
}

function initBearLoginSystem() {
  const loginOverlay = document.getElementById('loginOverlay');
  if (!loginOverlay) return;

  const usernameInput = document.getElementById('usernameInput');
  const passwordInput = document.getElementById('passwordInput');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const eyeIconClosed = document.getElementById('eyeIconClosed');
  const eyeIconOpen = document.getElementById('eyeIconOpen');
  const loginForm = document.getElementById('loginForm');
  const btnLogin = document.getElementById('btnLogin');
  const btnRegister = document.getElementById('btnRegister');
  const btnLogout = document.getElementById('btnLogout');
  const userNameText = document.getElementById('userNameText');

  let isPasswordVisible = false;

  updateAuthUi();

  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      isPasswordVisible = !isPasswordVisible;
      if (isPasswordVisible) {
        if (passwordInput) passwordInput.type = 'text';
        if (eyeIconClosed) eyeIconClosed.classList.add('hidden');
        if (eyeIconOpen) eyeIconOpen.classList.remove('hidden');
      } else {
        if (passwordInput) passwordInput.type = 'password';
        if (eyeIconOpen) eyeIconOpen.classList.add('hidden');
        if (eyeIconClosed) eyeIconClosed.classList.remove('hidden');
      }
    });
  }

  const doUserLogin = async (e) => {
    if (e) e.preventDefault();
    const username = usernameInput?.value.trim() || '';
    const password = passwordInput?.value || '';
    const errorText = document.getElementById('loginErrorText');
    if (!username || !password) {
      if (errorText) errorText.textContent = '请输入账号和密码';
      return;
    }
    if (btnLogin) btnLogin.disabled = true;
    if (errorText) errorText.textContent = '正在验证账号...';
    try {
      await BackendClient.login(username, password);
      updateAuthUi();
      await loadServerModels();
      await loadLibraryData();
      if (errorText) errorText.textContent = '';
      showToast('登录成功');
    } catch (error) {
      if (errorText) errorText.textContent = error.message || '登录失败';
    } finally {
      if (btnLogin) btnLogin.disabled = false;
    }
  };

  if (loginForm) {
    loginForm.addEventListener('submit', doUserLogin);
  }

  if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
      const username = usernameInput?.value.trim() || '';
      const password = passwordInput?.value || '';
      const errorText = document.getElementById('loginErrorText');
      if (!username || password.length < 8) {
        if (errorText) errorText.textContent = '注册账号需填写用户名和至少 8 位密码';
        return;
      }
      btnRegister.disabled = true;
      if (errorText) errorText.textContent = '正在创建账号...';
      try {
        await BackendClient.register(username, password);
        updateAuthUi();
        await loadLibraryData();
        if (errorText) errorText.textContent = '';
        showToast('注册成功');
      } catch (error) {
        if (errorText) errorText.textContent = error.message || '注册失败';
      } finally { btnRegister.disabled = false; }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      if (e) e.preventDefault();
      BackendClient.logout();
      updateAuthUi();
      void loadLibraryData({ silent: true });
      if (passwordInput) passwordInput.value = '';
      showToast('已安全退出');
    });
  }
}


// ==========================================================================
// 📦 资产库 (人物/道具/场景/已上传资源) 与 📝 提示词库 全套高级 ERP 逻辑
// ==========================================================================

const SEED_ASSETS = [
  {
    id: 'ast_001',
    name: '质检师熊主任 (主角IP)',
    category: '人物',
    description: '二手/新机推广智能体专属 IP 角色。蓝熊形象，头戴黑色棒球帽与闪电发光遮罩，手持专业相机，身穿科技工作马甲。',
    imageUrl: 'assets/logo_brand.png',
    createdAt: Date.now() - 3600000
  },
  {
    id: 'ast_002',
    name: '高级验机工程师',
    category: '人物',
    description: '二手机专职技术专家，身穿无尘检测服，头戴防静电帽子与护目镜，手持精修螺丝刀与检测仪器。',
    imageUrl: 'assets/login_bg_new.jpg',
    createdAt: Date.now() - 7200000
  },
  {
    id: 'ast_003',
    name: '54项全检防伪报告单',
    category: '道具',
    description: '官方权威 54 项成色与硬件检测证书，包含二维码、质检盖章与屏幕无划痕评级指标。',
    imageUrl: '',
    createdAt: Date.now() - 10800000
  },
  {
    id: 'ast_004',
    name: '纳米级光学显微检测仪',
    category: '道具',
    description: '用于展现二手/新机外壳成色、边框微米级防伪检测与屏幕发光像素点的高精光学显微仪器。',
    imageUrl: '',
    createdAt: Date.now() - 14400000
  },
  {
    id: 'ast_005',
    name: '智能二手机严选测验大厅',
    category: '场景',
    description: '蓝光科技感实验室，配备多屏成色对比展示壁、无尘检测工作台与自动化传送信道。',
    imageUrl: 'assets/login_bg_new.jpg',
    createdAt: Date.now() - 18000000
  },
  {
    id: 'ast_006',
    name: '极简旗舰数码直播间',
    category: '场景',
    description: '苹果风格极简科技展台，环形软光灯照明，专门用于二手/新机裸机成色与镜头微距拍摄展示。',
    imageUrl: '',
    createdAt: Date.now() - 21600000
  }
];

const SEED_PROMPT_TEMPLATES = [
  {
    id: 'pt_001',
    title: '📱 手机成色全特写环绕 (爆款卖点)',
    category: '二手新机',
    prompt: '电影级4K画质，一品成色旗舰手机放置在极简黑色光感玻璃台面。镜头环绕特写，近距离扫过手机钛金属边框与无瑕疵镜头模组，蓝光霓虹环境光折射在机身上，极致质感，慢动作呈现。',
    description: '适用于二手/新机成色展示视频，突出无划痕、高成色细节。'
  },
  {
    id: 'pt_002',
    title: '🔍 质检师专业无尘验机 (信任度)',
    category: '二手新机',
    prompt: '专业二手机质检师身穿蓝色无尘服，戴着白手套，在微距检测台下用光学显微镜认真检验手机屏幕。画面干净明亮，科技感极强，画面右下角出现绿勾成色认证。',
    description: '建立买家信任，突出专业检测流程。'
  },
  {
    id: 'pt_003',
    title: '🎬 赛博朋克二手机检测中心 (品牌IP)',
    category: '电影画质',
    prompt: '赛博朋克科幻数码实验室，质检师熊主任立于全息大屏前，手中拿着相机与最新旗舰手机。背景是透光玻璃与高速传送带，柔和蓝光透射，全景镜头拉近至中景，大片质感。',
    description: '专属于二手/新机推广智能体的开场大片模板。'
  }
];

function initAssetAndPromptData() {
  if (!state.assets || state.assets.length === 0) {
    state.assets = SEED_ASSETS;
    localStorage.setItem('vkb_assets', JSON.stringify(state.assets));
  }
  if (!state.promptTemplates || state.promptTemplates.length === 0) {
    state.promptTemplates = SEED_PROMPT_TEMPLATES;
    localStorage.setItem('vkb_prompt_templates', JSON.stringify(state.promptTemplates));
  }
}

function renderPromptKbGridUI() {
  initAssetAndPromptData();
  updateStatusIndicators();
  if (!el.promptKbGridContainer) return;

  const category = state.promptKbFilter || 'all';
  let items = state.promptTemplates || [];
  if (category !== 'all') {
    items = items.filter(p => p.category === category);
  }

  if (items.length === 0) {
    el.promptKbGridContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 60px 16px;">暂无该分类的提示词模板</div>';
    return;
  }

  el.promptKbGridContainer.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px;">
      ${items.map(t => `
        <div class="apple-card" style="background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border: 1px solid var(--border-color); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${escapeHTML(t.title)}</div>
            <span class="apple-meta-pill" style="background: #e0f2fe; color: #0369a1; font-weight: 600;">${escapeHTML(t.category)}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">${escapeHTML(t.description)}</div>
          <div class="apple-prompt-box" style="font-size: 0.875rem; background: rgba(15, 23, 42, 0.04); padding: 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.06); font-family: monospace;">
            ⚡ ${escapeHTML(t.prompt)}
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText(\`${escapeHTML(t.prompt)}\`); showToast('📋 提示词已复制到剪贴板！');">📋 复制提示词</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="switchView('videoGen'); if(el.aiChatTextarea){ el.aiChatTextarea.value = \`${escapeHTML(t.prompt)}\`; el.aiChatTextarea.focus(); } showToast('⚡ 提示词已载入 AI 视频创作框！');">⚡ 一键创作视频</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderAssetGridUI() {
  initAssetAndPromptData();
  updateStatusIndicators();
  if (!el.assetGridContainer) return;

  const category = state.assetCategoryFilter || 'all';

  if (category === 'uploaded') {
    renderUploadedResourcesUI();
    return;
  }

  let items = state.assets || [];
  if (category !== 'all') {
    items = items.filter(a => a.category === category);
  }

  if (items.length === 0) {
    el.assetGridContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 60px 16px;">暂无该分类的资产数据，点击右上角“➕ 新建资产”添加</div>';
    return;
  }

  const categoryIcons = { '人物': '👤', '道具': '🛠️', '场景': '🏞️' };

  el.assetGridContainer.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
      ${items.map(a => `
        <div class="apple-card" style="background: rgba(255,255,255,0.9); backdrop-filter: blur(12px); border: 1px solid var(--border-color); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem;">${categoryIcons[a.category] || '📦'}</span>
              <strong style="font-size: 1rem; color: var(--text-main);">${escapeHTML(a.name)}</strong>
            </div>
            <span class="apple-meta-pill" style="background: #e0f2fe; color: #0284c7; font-weight: 600;">${escapeHTML(a.category)}</span>
          </div>

          ${(a.imageUrl || a.imageResultId) ? `
            <div style="width: 100%; height: 160px; border-radius: 10px; overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center;">
              <img src="${a.imageUrl || ''}" ${a.imageResultId ? `data-image-result-id="${a.imageResultId}"` : ''} style="width: 100%; height: 100%; object-fit: cover;" alt="${escapeHTML(a.name)}">
            </div>
          ` : `
            <div style="width: 100%; height: 100px; border-radius: 10px; background: rgba(56, 189, 248, 0.08); border: 1px dashed rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.85rem;">
              无预览图片
            </div>
          `}

          <div style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5; flex: 1;">
            ${escapeHTML(a.description)}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 4px;">
            <button type="button" class="btn btn-ghost btn-sm" style="color: #ef4444;" onclick="deleteAssetItem('${a.id}')">🗑️ 删除</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="switchView('videoGen'); if(el.aiChatTextarea){ el.aiChatTextarea.value = '【使用资产: ${escapeHTML(a.name)}】' + el.aiChatTextarea.value; el.aiChatTextarea.focus(); } showToast('⚡ 已绑定资产 ${escapeHTML(a.name)} 到创作框！');">⚡ 用于视频创作</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  hydrateStoredImageElements(el.assetGridContainer);
}

function renderUploadedResourcesUI() {
  const list = state.uploadedResources || [];

  if (list.length === 0) {
    el.assetGridContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 60px 16px; background: #ffffff; border-radius: 16px; border: 1px dashed var(--border-color);">
        <div style="font-size: 2.5rem; margin-bottom: 10px;">☁️</div>
        <h4 style="margin-bottom: 6px; color: var(--text-main);">暂无已上传的参考图片/资源</h4>
        <p style="font-size: 0.85rem;">在 AI 视频生成对话框或镜头录入中上传的参考图片将自动归入此处，并支持一键加入资产库。</p>
      </div>
    `;
    return;
  }

  el.assetGridContainer.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
      ${list.map(r => `
        <div class="apple-card" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          <div style="width: 100%; height: 160px; border-radius: 10px; overflow: hidden; background: #090d16; position: relative;">
            <img src="${r.url}" style="width: 100%; height: 100%; object-fit: cover;">
            ${r.boundAssetId ? `
              <span style="position: absolute; top: 8px; right: 8px; background: #16a34a; color: #fff; font-size: 0.725rem; font-weight: 600; padding: 2px 8px; border-radius: 10px;">已入库</span>
            ` : `
              <span style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: #fff; font-size: 0.725rem; padding: 2px 8px; border-radius: 10px;">未绑定</span>
            `}
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="font-weight: 600; font-size: 0.875rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHTML(r.name || '已上传参考资源')}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              ⏱️ ${new Date(r.uploadedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <button type="button" class="btn btn-primary btn-sm" style="width: 100%;" onclick="openBindModal('${r.id}')">➕ 加入资产库</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openBindModal(resourceId) {
  const item = (state.uploadedResources || []).find(r => r.id === resourceId);
  if (!item) return;

  if (el.bindResourceId) el.bindResourceId.value = item.id;
  if (el.bindResourcePreviewImg) el.bindResourcePreviewImg.src = item.url;
  if (el.bindAssetName) el.bindAssetName.value = (item.name || '二手新机推广资产').replace(/\.[^/.]+$/, "");
  if (el.bindAssetDesc) el.bindAssetDesc.value = '二手/新机推广参考资产';

  if (el.bindResourceModal) {
    el.bindResourceModal.classList.remove('hidden');
  }
}

async function deleteAssetItem(assetId) {
  if (confirm('确认要删除该资产吗？')) {
    const removedAsset = (state.assets || []).find(asset => asset.id === assetId);
    state.assets = (state.assets || []).filter(asset => asset.id !== assetId);
    localStorage.setItem('vkb_assets', JSON.stringify(state.assets));
    if (removedAsset) await cleanupUnreferencedImageResults([removedAsset]);
    updateStatusIndicators();
    renderAssetGridUI(); if(typeof renderCanvasDrawer==='function') renderCanvasDrawer();
    showToast('已安全删除资产');
  }
}

function recordUploadedResource(fileDataUrl, fileName) {
  if (!state.uploadedResources) state.uploadedResources = [];
  const resource = {
    id: 'res_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    url: fileDataUrl,
    name: fileName || '已上传图片',
    uploadedAt: Date.now(),
    boundAssetId: null
  };
  state.uploadedResources.unshift(resource);
  localStorage.setItem('vkb_uploaded_resources', JSON.stringify(state.uploadedResources));
  updateStatusIndicators();
}

// 旧版浏览器本地库事件保留作回退参考，不再绑定。
function bindLegacyLibraryEventsDisabled() {
  initAssetAndPromptData();

  if (el.navPromptKb) {
    el.navPromptKb.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('promptKb');
    });
  }

  if (el.navAssetKb) {
    el.navAssetKb.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('assetKb');
    });
  }

  if (el.promptKbFilterTabs) {
    el.promptKbFilterTabs.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        el.promptKbFilterTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.promptKbFilter = btn.dataset.category;
        renderPromptKbGridUI();
      });
    });
  }

  if (el.assetCategoryTabs) {
    el.assetCategoryTabs.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        el.assetCategoryTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.assetCategoryFilter = btn.dataset.category;
        renderAssetGridUI(); if(typeof renderCanvasDrawer==='function') renderCanvasDrawer();
      });
    });
  }

  if (el.btnNewAsset) {
    el.btnNewAsset.addEventListener('click', () => {
      if (el.assetFormId) el.assetFormId.value = '';
      if (el.assetFormName) el.assetFormName.value = '';
      if (el.assetFormDesc) el.assetFormDesc.value = '';
      if (el.assetFormImgUrl) el.assetFormImgUrl.value = '';
      if (el.assetFormImgUrl) delete el.assetFormImgUrl.dataset.mediaReference;
      if (el.assetFormImgPreview) {
        el.assetFormImgPreview.src = '';
        el.assetFormImgPreview.style.display = 'none';
      }
      if (el.assetModalTitle) el.assetModalTitle.textContent = '➕ 新建资产';
      if (el.assetModal) el.assetModal.classList.remove('hidden');
    });
  }

  if (el.btnCloseAssetModal) el.btnCloseAssetModal.addEventListener('click', () => el.assetModal && el.assetModal.classList.add('hidden'));
  if (el.btnCancelAssetForm) el.btnCancelAssetForm.addEventListener('click', () => el.assetModal && el.assetModal.classList.add('hidden'));
  if (el.btnCloseBindModal) el.btnCloseBindModal.addEventListener('click', () => el.bindResourceModal && el.bindResourceModal.classList.add('hidden'));
  if (el.btnCancelBindModal) el.btnCancelBindModal.addEventListener('click', () => el.bindResourceModal && el.bindResourceModal.classList.add('hidden'));

  // 分段选择器
  const initSegs = (segEl, hiddenInputId) => {
    if (!segEl) return;
    const input = document.getElementById(hiddenInputId);
    segEl.querySelectorAll('.segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        segEl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.value;
        segEl.dataset.value = val;
        if (input) input.value = val;
      });
    });
  };

  initSegs(el.assetFormCategorySeg, 'assetFormCategory');
  initSegs(el.bindCategorySeg, 'bindCategoryInput');

  if (el.btnUploadAssetImg) {
    el.btnUploadAssetImg.addEventListener('click', () => el.assetFormImgInput && el.assetFormImgInput.click());
  }

  if (el.assetFormImgInput) {
    el.assetFormImgInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        try {
          const uploaded = await apiUploadMedia(file);
          if (el.assetFormImgUrl) {
            el.assetFormImgUrl.value = uploaded.url;
            el.assetFormImgUrl.dataset.mediaReference = uploaded.reference || uploaded.url;
          }
          if (el.assetFormImgPreview) {
            el.assetFormImgPreview.src = uploaded.url;
            el.assetFormImgPreview.style.display = 'block';
          }
        } catch (error) {
          showToast(`资产图片上传失败：${error.message || error}`, 'error');
        }
      }
    });
  }

  if (el.assetForm) {
    el.assetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = el.assetFormName.value.trim();
      const desc = el.assetFormDesc.value.trim();
      const category = el.assetFormCategory.value || '人物';
      const imgUrl = el.assetFormImgUrl ? el.assetFormImgUrl.value : '';
      const mediaReference = el.assetFormImgUrl?.dataset.mediaReference || '';

      if (!name || !desc) return;

      const newAsset = {
        id: 'ast_' + Date.now(),
        name,
        category,
        description: desc,
        imageUrl: imgUrl,
        mediaReference,
        createdAt: Date.now()
      };

      if (!state.assets) state.assets = [];
      state.assets.unshift(newAsset);
      localStorage.setItem('vkb_assets', JSON.stringify(state.assets));

      if (el.assetModal) el.assetModal.classList.add('hidden');
      updateStatusIndicators();
      renderAssetGridUI(); if(typeof renderCanvasDrawer==='function') renderCanvasDrawer();
      showToast(`🎉 成功添加新资产: ${name}`);
    });
  }

  if (el.bindResourceForm) {
    el.bindResourceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const resId = el.bindResourceId.value;
      const category = el.bindCategoryInput.value || '人物';
      const name = el.bindAssetName.value.trim();
      const desc = el.bindAssetDesc.value.trim();

      const res = (state.uploadedResources || []).find(r => r.id === resId);
      if (!res || !name) return;

      const newAsset = {
        id: 'ast_' + Date.now(),
        name,
        category,
        description: desc,
        imageUrl: res.url,
        createdAt: Date.now()
      };

      if (!state.assets) state.assets = [];
      state.assets.unshift(newAsset);
      localStorage.setItem('vkb_assets', JSON.stringify(state.assets));

      res.boundAssetId = newAsset.id;
      localStorage.setItem('vkb_uploaded_resources', JSON.stringify(state.uploadedResources));

      if (el.bindResourceModal) el.bindResourceModal.classList.add('hidden');
      updateStatusIndicators();
      renderAssetGridUI(); if(typeof renderCanvasDrawer==='function') renderCanvasDrawer();
      showToast(`🎉 已成功将资源绑定并加入资产库 [${category}]: ${name}`);
    });
  }
}

/* ========================================================================== */
/* 服务端提示词库与多媒体资产库 */
/* ========================================================================== */
let libraryAssetDraftMedia = [];
let librarySearchTimer = null;

function libraryMediaUrl(value) {
  const url = String(value || '');
  if (!url || /^(https?:|blob:|data:)/i.test(url)) return url;
  return `${BackendClient.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

function normalizeLibraryAsset(asset) {
  const media = (asset.media || []).map(item => ({ ...item, url: libraryMediaUrl(item.url) }));
  const cover = media.find(item => item.isCover) || media.find(item => item.type === 'image') || media[0] || null;
  const firstImage = media.find(item => item.type === 'image') || null;
  return {
    ...asset,
    media,
    primaryMedia: cover,
    imageUrl: firstImage?.url || '',
    imageResultId: firstImage && !firstImage.url ? firstImage.id : null,
    mediaReference: cover?.reference || '',
    mediaId: cover?.id || null
  };
}

function initAssetAndPromptData() {
  if (!Array.isArray(state.promptTemplates)) state.promptTemplates = [];
  if (!Array.isArray(state.assets)) state.assets = [];
  if (!Array.isArray(state.uploadedResources)) state.uploadedResources = [];
}

async function loadLibraryData({ silent = false } = {}) {
  if (!BackendClient.isAuthenticated()) {
    state.promptTemplates = [];
    state.assets = [];
    state.uploadedResources = [];
    state.libraryLoaded = false;
    updateSidebarBadgeCounts();
    return;
  }
  state.libraryLoading = true;
  if (!silent) {
    const visible = document.querySelector('#viewPromptKb:not(.hidden) #promptKbGridContainer, #viewAssetKb:not(.hidden) #assetGridContainer');
    if (visible) visible.innerHTML = '<div class="library-loading-state"><span class="spin-icon">◌</span> 正在读取资料库…</div>';
  }
  try {
    const [prompts, assets, uploads] = await Promise.all([
      BackendClient.listLibraryPrompts(),
      BackendClient.listLibraryAssets(),
      BackendClient.listLibraryUploads(200)
    ]);
    state.promptTemplates = Array.isArray(prompts) ? prompts : [];
    state.assets = (Array.isArray(assets) ? assets : []).map(normalizeLibraryAsset);
    state.uploadedResources = (Array.isArray(uploads) ? uploads : []).map(item => ({
      ...item,
      url: libraryMediaUrl(item.url),
      mediaReference: item.reference,
      mediaId: item.id,
      uploadedAt: item.createdAt || Date.now()
    }));
    state.libraryLoaded = true;
    updateSidebarBadgeCounts();
    if (typeof renderCanvasDrawer === 'function' && !document.getElementById('viewCanvasMode')?.classList.contains('hidden')) renderCanvasDrawer();
  } catch (error) {
    state.libraryLoaded = false;
    console.error('Library load failed:', error);
    if (!silent) showToast(`资料库读取失败：${error.message}`, 'error');
  } finally {
    state.libraryLoading = false;
  }
}
window.loadLibraryData = loadLibraryData;

function filteredLibraryPrompts() {
  const query = String(state.promptKbSearch || '').trim().toLowerCase();
  return (state.promptTemplates || []).filter(item => {
    if (state.promptKbFilter !== 'all' && item.category !== state.promptKbFilter) return false;
    if (state.promptKbTargetType !== 'all' && item.targetType !== state.promptKbTargetType) return false;
    if (state.promptKbScope !== 'all' && item.scope !== state.promptKbScope) return false;
    if (state.promptKbFavoriteOnly && !item.isFavorite) return false;
    if (!query) return true;
    return [item.title, item.prompt, item.description, ...(item.tags || [])].join(' ').toLowerCase().includes(query);
  });
}

function promptTargetLabel(value) {
  return value === 'image' ? '图片' : value === 'video' ? '视频' : '图片 · 视频';
}

function renderPromptKbGridUI() {
  initAssetAndPromptData();
  updateStatusIndicators();
  if (!el.promptKbGridContainer) return;
  const items = filteredLibraryPrompts();
  const batchActions = document.getElementById('promptBatchActions');
  batchActions?.classList.toggle('hidden', !state.isBatchSelectingPrompts);
  const batchCount = document.getElementById('promptBatchCount');
  if (batchCount) batchCount.textContent = `已选 ${state.selectedPromptIds.size} 项`;
  if (state.libraryLoading && !state.libraryLoaded) {
    el.promptKbGridContainer.innerHTML = '<div class="library-loading-state"><span class="spin-icon">◌</span> 正在读取资料库…</div>';
    return;
  }
  if (!items.length) {
    el.promptKbGridContainer.innerHTML = '<div class="library-empty-state"><div>⌁</div><h3>这里还没有提示词</h3><p>点击“新增提示词”建立个人模板，管理员也可以发布系统模板。</p></div>';
    return;
  }
  el.promptKbGridContainer.innerHTML = `<div class="library-card-grid">${items.map(item => `
    <article class="library-card prompt-library-card ${state.selectedPromptIds.has(item.id) ? 'is-selected' : ''}" data-prompt-id="${item.id}">
      ${state.isBatchSelectingPrompts && item.canEdit ? `<label class="library-check"><input type="checkbox" data-action="select-prompt" ${state.selectedPromptIds.has(item.id) ? 'checked' : ''}><span></span></label>` : ''}
      <div class="library-card-top"><div class="library-badges"><span>${escapeHTML(item.category)}</span><span>${promptTargetLabel(item.targetType)}</span>${item.scope === 'system' ? '<span class="system-badge">系统模板</span>' : '<span>仅自己</span>'}</div><button class="library-star ${item.isFavorite ? 'active' : ''}" type="button" data-action="favorite-prompt" aria-label="收藏">${item.isFavorite ? '★' : '☆'}</button></div>
      <h3>${escapeHTML(item.title)}</h3>
      <p class="library-description">${escapeHTML(item.description || '暂无使用说明')}</p>
      <div class="library-prompt-content">${escapeHTML(item.prompt)}</div>
      ${(item.tags || []).length ? `<div class="library-tags">${item.tags.map(tag => `<span>#${escapeHTML(tag)}</span>`).join('')}</div>` : ''}
      <div class="library-card-actions"><button class="btn btn-primary btn-sm" type="button" data-action="use-prompt-creation">用于创作</button><button class="btn btn-secondary btn-sm" type="button" data-action="use-prompt-canvas">加入画布</button><button class="btn btn-ghost btn-sm" type="button" data-action="copy-prompt-text">复制</button>${item.canEdit ? '<button class="btn btn-ghost btn-sm" type="button" data-action="edit-prompt">编辑</button><button class="btn btn-ghost btn-sm danger" type="button" data-action="delete-prompt">删除</button>' : '<button class="btn btn-ghost btn-sm" type="button" data-action="copy-prompt-item">复制到我的库</button>'}</div>
    </article>`).join('')}</div>`;
}

function libraryMediaPreview(item, { compact = false } = {}) {
  const source = escapeHTML(item?.url || '');
  const className = compact ? 'library-media compact' : 'library-media';
  if (item?.type === 'video') return `<div class="${className} library-video"><video data-lazy-video-src="${source}" data-click-video-load="1" muted playsinline preload="none"></video><span class="library-play-mark">▶</span></div>`;
  if (item?.type === 'audio') return `<div class="${className} library-audio"><span>♫</span><small>${escapeHTML(item.name || '音频参考')}</small></div>`;
  if (source) return `<div class="${className}"><img src="${source}" alt=""></div>`;
  return `<div class="${className}" data-image-result-id="${escapeHTML(item?.id || '')}"><span class="library-file-mark">▧</span></div>`;
}

function filteredLibraryAssets() {
  const query = String(state.assetKbSearch || '').trim().toLowerCase();
  return (state.assets || []).filter(item => {
    if (state.assetCategoryFilter !== 'all' && item.category !== state.assetCategoryFilter) return false;
    if (state.assetKbMediaType !== 'all' && !(item.media || []).some(media => media.type === state.assetKbMediaType)) return false;
    if (state.assetKbScope !== 'all' && item.scope !== state.assetKbScope) return false;
    if (state.assetKbFavoriteOnly && !item.isFavorite) return false;
    if (!query) return true;
    return [item.name, item.description, ...(item.tags || [])].join(' ').toLowerCase().includes(query);
  });
}

function renderAssetGridUI() {
  initAssetAndPromptData();
  updateStatusIndicators();
  if (!el.assetGridContainer) return;
  if (state.assetCategoryFilter === 'uploaded') return renderUploadedResourcesUI();
  const items = filteredLibraryAssets();
  document.getElementById('assetBatchActions')?.classList.toggle('hidden', !state.isBatchSelectingAssets);
  const count = document.getElementById('assetBatchCount');
  if (count) count.textContent = `已选 ${state.selectedAssetIds.size} 项`;
  if (state.libraryLoading && !state.libraryLoaded) {
    el.assetGridContainer.innerHTML = '<div class="library-loading-state"><span class="spin-icon">◌</span> 正在读取资料库…</div>';
    return;
  }
  if (!items.length) {
    el.assetGridContainer.innerHTML = '<div class="library-empty-state"><div>▧</div><h3>这里还没有资产</h3><p>上传图片、视频或音频，把同一角色或产品的素材整理在一起。</p></div>';
    return;
  }
  el.assetGridContainer.innerHTML = `<div class="library-card-grid asset-library-grid">${items.map(item => {
    const typeSummary = [...new Set((item.media || []).map(media => media.type === 'image' ? '图片' : media.type === 'video' ? '视频' : '音频'))];
    return `<article class="library-card asset-library-card ${state.selectedAssetIds.has(item.id) ? 'is-selected' : ''}" data-asset-id="${item.id}">
      ${state.isBatchSelectingAssets && item.canEdit ? `<label class="library-check"><input type="checkbox" data-action="select-asset" ${state.selectedAssetIds.has(item.id) ? 'checked' : ''}><span></span></label>` : ''}
      <div class="asset-cover">${item.primaryMedia ? libraryMediaPreview(item.primaryMedia) : '<div class="library-media"><span class="library-file-mark">＋</span></div>'}<span class="asset-media-count">${item.media.length} 个媒体</span></div>
      <div class="library-card-top"><div class="library-badges"><span>${escapeHTML(item.category)}</span>${item.scope === 'system' ? '<span class="system-badge">系统资产</span>' : '<span>仅自己</span>'}</div><button class="library-star ${item.isFavorite ? 'active' : ''}" type="button" data-action="favorite-asset">${item.isFavorite ? '★' : '☆'}</button></div>
      <h3>${escapeHTML(item.name)}</h3><p class="library-description">${escapeHTML(item.description || '暂无资产说明')}</p>
      <div class="asset-media-types">${typeSummary.length ? typeSummary.map(type => `<span>${type}</span>`).join('') : '<span>暂无媒体</span>'}</div>
      <div class="library-card-actions"><button class="btn btn-primary btn-sm" type="button" data-action="use-asset-creation" ${item.media.length ? '' : 'disabled'}>用于创作</button><button class="btn btn-secondary btn-sm" type="button" data-action="use-asset-canvas" ${item.media.length ? '' : 'disabled'}>加入画布</button>${item.canEdit ? '<button class="btn btn-ghost btn-sm" type="button" data-action="edit-asset">编辑</button><button class="btn btn-ghost btn-sm danger" type="button" data-action="delete-asset">删除</button>' : '<button class="btn btn-ghost btn-sm" type="button" data-action="copy-asset-item">复制到我的库</button>'}</div>
    </article>`;
  }).join('')}</div>`;
  hydrateStoredImageElements(el.assetGridContainer);
  observeManagedVideos(el.assetGridContainer);
}

function renderUploadedResourcesUI() {
  const list = (state.uploadedResources || []).filter(item => state.assetKbMediaType === 'all' || item.type === state.assetKbMediaType);
  if (!list.length) {
    el.assetGridContainer.innerHTML = '<div class="library-empty-state"><div>☁</div><h3>没有未整理的上传文件</h3><p>创作页或画布上传的媒体会出现在这里，加入资产后自动移出。</p></div>';
    return;
  }
  el.assetGridContainer.innerHTML = `<div class="library-upload-grid">${list.map(item => `<article class="library-upload-card" data-upload-id="${item.id}">${libraryMediaPreview(item)}<div><strong>${escapeHTML(item.name || '未命名媒体')}</strong><span>${item.type === 'image' ? '图片' : item.type === 'video' ? '视频' : '音频'}</span></div><button class="btn btn-primary btn-sm" type="button" data-action="organize-upload">加入资产库</button></article>`).join('')}</div>`;
  observeManagedVideos(el.assetGridContainer);
}

function openPromptTemplateEditor(item = null) {
  const modal = document.getElementById('promptTemplateModal');
  if (!modal) return;
  document.getElementById('promptTemplateFormId').value = item?.id || '';
  document.getElementById('promptTemplateTitle').value = item?.title || '';
  document.getElementById('promptTemplateCategory').value = item?.category || '通用';
  document.getElementById('promptTemplateTarget').value = item?.targetType || 'both';
  document.getElementById('promptTemplateScope').value = item?.scope || 'private';
  document.getElementById('promptTemplatePrompt').value = item?.prompt || '';
  document.getElementById('promptTemplateDescription').value = item?.description || '';
  document.getElementById('promptTemplateTags').value = (item?.tags || []).join('，');
  document.getElementById('promptTemplateModalTitle').textContent = item ? '编辑提示词' : '新增提示词';
  document.getElementById('promptTemplateScopeGroup')?.classList.toggle('hidden', !BackendClient.isAdmin());
  modal.classList.remove('hidden');
  document.getElementById('promptTemplateTitle')?.focus();
}

function closePromptTemplateEditor() { document.getElementById('promptTemplateModal')?.classList.add('hidden'); }

function renderAssetDraftMedia() {
  const target = document.getElementById('assetFormMediaList');
  if (!target) return;
  target.innerHTML = libraryAssetDraftMedia.length ? libraryAssetDraftMedia.map((item, index) => `<div class="asset-form-media ${item.isCover ? 'is-cover' : ''}" data-media-id="${item.id}">${libraryMediaPreview(item, { compact: true })}<div><strong>${escapeHTML(item.name || `媒体 ${index + 1}`)}</strong><span>${item.type === 'image' ? '图片' : item.type === 'video' ? '视频' : '音频'}${item.isCover ? ' · 封面' : ''}</span></div><button type="button" data-action="set-asset-cover" title="设为封面">封面</button><button type="button" data-action="remove-asset-media" title="移除">×</button></div>`).join('') : '<div class="asset-form-media-empty">还没有媒体，可一次上传多个文件</div>';
  observeManagedVideos(target);
}

function openAssetEditor(item = null, seedMedia = []) {
  const modal = document.getElementById('assetModal');
  if (!modal) return;
  el.assetFormId.value = item?.id || '';
  el.assetFormName.value = item?.name || '';
  el.assetFormDesc.value = item?.description || '';
  el.assetFormCategory.value = item?.category || '人物';
  document.getElementById('assetFormScope').value = item?.scope || 'private';
  document.getElementById('assetFormTags').value = (item?.tags || []).join('，');
  document.getElementById('assetFormScopeGroup')?.classList.toggle('hidden', !BackendClient.isAdmin());
  libraryAssetDraftMedia = (item?.media || seedMedia || []).map((media, index) => ({ ...media, isCover: Boolean(media.isCover || index === 0) }));
  el.assetModalTitle.textContent = item ? '编辑资产' : '新增资产';
  renderAssetDraftMedia();
  modal.classList.remove('hidden');
  el.assetFormName.focus();
}

async function uploadAssetDraftFiles(files) {
  const accepted = Array.from(files || []).filter(file => /^(image|video|audio)\//.test(file.type));
  if (!accepted.length) return showToast('请选择图片、视频或音频文件', 'warning');
  const progress = document.getElementById('assetUploadProgress');
  const bar = progress?.querySelector('span');
  const text = progress?.querySelector('p');
  progress?.classList.remove('hidden');
  try {
    for (let index = 0; index < accepted.length; index += 1) {
      const file = accepted[index];
      if (text) text.textContent = `正在上传 ${index + 1}/${accepted.length}：${file.name}`;
      const uploaded = await apiUploadMedia(file, percent => { if (bar) bar.style.width = `${((index + percent / 100) / accepted.length) * 100}%`; });
      libraryAssetDraftMedia.push({
        id: uploaded.id,
        name: uploaded.name || file.name,
        type: file.type.split('/')[0],
        mimeType: uploaded.mimeType || file.type,
        url: libraryMediaUrl(uploaded.url),
        reference: uploaded.reference,
        isCover: libraryAssetDraftMedia.length === 0
      });
      renderAssetDraftMedia();
    }
  } catch (error) {
    showToast(`媒体上传失败：${error.message}`, 'error');
  } finally {
    progress?.classList.add('hidden');
    if (bar) bar.style.width = '0%';
    if (el.assetFormImgInput) el.assetFormImgInput.value = '';
  }
}

function insertPromptAtCreationCaret(prompt) {
  switchView('videoGen');
  const textarea = el.aiChatTextarea;
  if (!textarea) return;
  const start = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
  const end = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : start;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const prefix = before && !/\s$/.test(before) ? '\n' : '';
  const suffix = after && !/^\s/.test(after) ? '\n' : '';
  textarea.value = `${before}${prefix}${prompt}${suffix}${after}`;
  const cursor = before.length + prefix.length + prompt.length;
  textarea.setSelectionRange(cursor, cursor);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

function applyPromptToCanvas(item) {
  switchView('canvasMode');
  const selected = (canvasState.selectedNodeIds || []).map(id => canvasState.nodes.find(node => node.id === id)).filter(Boolean);
  const textNode = selected.length === 1 && selected[0].type === 'text' ? selected[0] : null;
  if (textNode) {
    textNode.content = item.prompt;
    textNode.title = `📝 ${item.title}`;
    saveCanvasState();
    renderCanvasNodesAndLines();
  } else {
    const center = getCanvasViewportCenterPos();
    addCanvasNode({ id: `node_text_${Date.now()}`, type: 'text', x: center.x, y: center.y, title: `📝 ${item.title}`, content: item.prompt });
  }
  showToast(textNode ? '已应用到所选文本节点' : '已创建提示词文本节点', 'success');
}

async function addAssetToChatRefMedia(asset) {
  if (!asset?.media?.length) return showToast('这个资产还没有媒体', 'warning');
  let added = 0;
  const addedRefs = [];
  for (const media of asset.media) {
    if (getChatGenerationMode() === 'image' && media.type !== 'image') continue;
    const existing = state.chatRefMediaList.find(item => item.mediaId === media.id);
    if (existing) continue;
    const nextRef = {
      id: `ref_asset_${media.id}_${Date.now()}`,
      assetId: asset.id,
      mediaId: media.id,
      fileName: media.name || asset.name,
      url: media.url,
      reference: media.reference,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      type: media.type
    };
    state.chatRefMediaList.push(nextRef);
    addedRefs.push(nextRef);
    added += 1;
  }
  renderChatRefMediaList();
  if (addedRefs.length && activeTextareaForAt) {
    const beforeCaret = activeTextareaForAt.isContentEditable
      ? getChatEditorTextBeforeCaret(activeTextareaForAt)
      : String(activeTextareaForAt.value || '').slice(0, activeTextareaForAt.selectionStart || 0);
    if (beforeCaret.endsWith('@')) insertAtTagIntoTextarea(addedRefs[0].tag, true, activeTextareaForAt);
  }
  if (!el.viewAssetKb?.classList.contains('hidden')) switchView('videoGen');
  if (added) showToast(`已引用资产“${asset.name}”中的 ${added} 个媒体`, 'success');
  else showToast(getChatGenerationMode() === 'image' ? '图片模式只能引用图片，或媒体已存在' : '资产媒体已在输入框中', 'info');
}

function addAssetMediaToCanvas(asset) {
  if (!asset?.media?.length) return;
  switchView('canvasMode');
  const center = getCanvasViewportCenterPos();
  const created = [];
  asset.media.forEach((media, index) => {
    const x = center.x + (index % 3) * 260;
    const y = center.y + Math.floor(index / 3) * 340;
    const common = { id: `node_library_${Date.now()}_${index}`, x, y, assetName: asset.name, mediaReference: media.reference, mediaId: media.id, mediaAutoSizePending: true };
    if (media.type === 'video') created.push({ ...common, type: 'video', title: `🎬 ${asset.name}`, videoUrl: media.url, outputUrl: media.url, status: 'completed' });
    else if (media.type === 'audio') created.push({ ...common, type: 'audio', title: `🎧 ${asset.name}`, audioUrl: media.url, status: 'completed' });
    else created.push({ ...common, type: 'asset', title: `🖼️ ${asset.name}`, imgUrl: media.url });
  });
  created.forEach(node => addCanvasNode(node));
  canvasState.selectedNodeIds = created.map(node => node.id);
  saveCanvasState();
  renderCanvasNodesAndLines();
  showToast(`已把 ${created.length} 个媒体加入画布`, 'success');
}

async function deletePromptItems(ids) {
  const editable = ids.filter(id => state.promptTemplates.find(item => item.id === id)?.canEdit);
  if (!editable.length || !confirm(`确认删除 ${editable.length} 个提示词吗？`)) return;
  await Promise.all(editable.map(id => BackendClient.deleteLibraryPrompt(id)));
  state.selectedPromptIds.clear();
  await loadLibraryData({ silent: true });
  renderPromptKbGridUI();
}

async function deleteAssetItems(ids) {
  const editable = ids.filter(id => state.assets.find(item => item.id === id)?.canEdit);
  if (!editable.length || !confirm(`确认删除 ${editable.length} 个资产吗？媒体文件和历史引用会保留。`)) return;
  await Promise.all(editable.map(id => BackendClient.deleteLibraryAsset(id)));
  state.selectedAssetIds.clear();
  await loadLibraryData({ silent: true });
  renderAssetGridUI();
  if (typeof renderCanvasDrawer === 'function') renderCanvasDrawer();
}

async function deleteAssetItem(assetId) { return deleteAssetItems([assetId]); }

function openBindModal(resourceId) {
  const item = state.uploadedResources.find(media => media.id === resourceId);
  if (item) openAssetEditor(null, [item]);
}

function recordUploadedResource() {
  // 上传后由服务端未整理媒体接口统一归档，避免浏览器重复保存大文件。
  void loadLibraryData({ silent: true });
}

function bindLibraryUi() {
  const byId = id => document.getElementById(id);
  byId('btnNewPromptTemplate')?.addEventListener('click', () => openPromptTemplateEditor());
  byId('btnClosePromptTemplateModal')?.addEventListener('click', closePromptTemplateEditor);
  byId('btnCancelPromptTemplateForm')?.addEventListener('click', closePromptTemplateEditor);
  byId('promptTemplateForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const id = byId('promptTemplateFormId').value;
    const payload = {
      title: byId('promptTemplateTitle').value,
      category: byId('promptTemplateCategory').value,
      targetType: byId('promptTemplateTarget').value,
      scope: BackendClient.isAdmin() ? byId('promptTemplateScope').value : 'private',
      prompt: byId('promptTemplatePrompt').value,
      description: byId('promptTemplateDescription').value,
      tags: byId('promptTemplateTags').value.split(/[,，]/)
    };
    try {
      if (id) await BackendClient.updateLibraryPrompt(id, payload); else await BackendClient.createLibraryPrompt(payload);
      closePromptTemplateEditor();
      await loadLibraryData({ silent: true });
      renderPromptKbGridUI();
      if (typeof renderCanvasDrawer === 'function') renderCanvasDrawer();
      showToast('提示词已保存', 'success');
    } catch (error) { showToast(`保存失败：${error.message}`, 'error'); }
  });

  const rerenderPrompts = () => renderPromptKbGridUI();
  byId('promptKbSearchInput')?.addEventListener('input', event => { clearTimeout(librarySearchTimer); librarySearchTimer = setTimeout(() => { state.promptKbSearch = event.target.value; rerenderPrompts(); }, 120); });
  byId('promptKbCategorySelect')?.addEventListener('change', event => { state.promptKbFilter = event.target.value; rerenderPrompts(); });
  byId('promptKbTargetSelect')?.addEventListener('change', event => { state.promptKbTargetType = event.target.value; rerenderPrompts(); });
  byId('promptKbScopeSelect')?.addEventListener('change', event => { state.promptKbScope = event.target.value; rerenderPrompts(); });
  byId('btnPromptFavoriteFilter')?.addEventListener('click', event => { state.promptKbFavoriteOnly = !state.promptKbFavoriteOnly; event.currentTarget.classList.toggle('active', state.promptKbFavoriteOnly); event.currentTarget.textContent = state.promptKbFavoriteOnly ? '★ 已收藏' : '☆ 只看收藏'; rerenderPrompts(); });
  byId('btnPromptBatchMode')?.addEventListener('click', event => { state.isBatchSelectingPrompts = !state.isBatchSelectingPrompts; if (!state.isBatchSelectingPrompts) state.selectedPromptIds.clear(); event.currentTarget.textContent = state.isBatchSelectingPrompts ? '完成' : '批量管理'; rerenderPrompts(); });
  byId('btnDeleteSelectedPrompts')?.addEventListener('click', () => deletePromptItems([...state.selectedPromptIds]).catch(error => showToast(error.message, 'error')));
  byId('btnExportPromptLibrary')?.addEventListener('click', () => {
    const own = state.promptTemplates.filter(item => item.scope === 'private').map(({ id, canEdit, usageCount, createdAt, updatedAt, ...item }) => item);
    const blob = new Blob([JSON.stringify({ version: 1, prompts: own }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `提示词库-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  byId('promptLibraryImportInput')?.addEventListener('change', async event => {
    try {
      const parsed = JSON.parse(await event.target.files[0].text());
      const items = Array.isArray(parsed) ? parsed : parsed.prompts;
      if (!Array.isArray(items)) throw new Error('文件中没有 prompts 数组');
      for (const item of items.slice(0, 200)) await BackendClient.createLibraryPrompt({ ...item, scope: 'private' });
      await loadLibraryData({ silent: true }); renderPromptKbGridUI(); showToast(`已导入 ${Math.min(items.length, 200)} 个提示词`, 'success');
    } catch (error) { showToast(`导入失败：${error.message}`, 'error'); } finally { event.target.value = ''; }
  });
  el.promptKbGridContainer?.addEventListener('change', event => {
    if (event.target.dataset.action !== 'select-prompt') return;
    const id = event.target.closest('[data-prompt-id]')?.dataset.promptId;
    if (event.target.checked) state.selectedPromptIds.add(id); else state.selectedPromptIds.delete(id);
    rerenderPrompts();
  });
  el.promptKbGridContainer?.addEventListener('click', async event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const item = state.promptTemplates.find(prompt => prompt.id === event.target.closest('[data-prompt-id]')?.dataset.promptId);
    if (!item || !action || action === 'select-prompt') return;
    try {
      if (action === 'use-prompt-creation') insertPromptAtCreationCaret(item.prompt);
      else if (action === 'use-prompt-canvas') applyPromptToCanvas(item);
      else if (action === 'copy-prompt-text') { await navigator.clipboard.writeText(item.prompt); showToast('提示词已复制'); }
      else if (action === 'edit-prompt') openPromptTemplateEditor(item);
      else if (action === 'delete-prompt') await deletePromptItems([item.id]);
      else if (action === 'copy-prompt-item') { await BackendClient.copyLibraryPrompt(item.id); await loadLibraryData({ silent: true }); rerenderPrompts(); showToast('已复制到我的提示词库', 'success'); }
      else if (action === 'favorite-prompt' && item.canEdit) { await BackendClient.updateLibraryPrompt(item.id, { isFavorite: !item.isFavorite }); await loadLibraryData({ silent: true }); rerenderPrompts(); }
    } catch (error) { showToast(`操作失败：${error.message}`, 'error'); }
  });

  byId('btnNewAsset')?.addEventListener('click', () => openAssetEditor());
  byId('btnCloseAssetModal')?.addEventListener('click', () => el.assetModal?.classList.add('hidden'));
  byId('btnCancelAssetForm')?.addEventListener('click', () => el.assetModal?.classList.add('hidden'));
  byId('btnUploadAssetImg')?.addEventListener('click', () => el.assetFormImgInput?.click());
  byId('assetMediaDropzone')?.addEventListener('click', event => { if (!event.target.closest('button')) el.assetFormImgInput?.click(); });
  byId('assetMediaDropzone')?.addEventListener('dragover', event => { event.preventDefault(); event.currentTarget.classList.add('is-dragging'); });
  byId('assetMediaDropzone')?.addEventListener('dragleave', event => event.currentTarget.classList.remove('is-dragging'));
  byId('assetMediaDropzone')?.addEventListener('drop', event => { event.preventDefault(); event.currentTarget.classList.remove('is-dragging'); void uploadAssetDraftFiles(event.dataTransfer.files); });
  el.assetFormImgInput?.addEventListener('change', event => void uploadAssetDraftFiles(event.target.files));
  byId('assetFormMediaList')?.addEventListener('click', event => {
    const row = event.target.closest('[data-media-id]'); if (!row) return;
    if (event.target.dataset.action === 'remove-asset-media') libraryAssetDraftMedia = libraryAssetDraftMedia.filter(item => item.id !== row.dataset.mediaId);
    if (event.target.dataset.action === 'set-asset-cover') libraryAssetDraftMedia = libraryAssetDraftMedia.map(item => ({ ...item, isCover: item.id === row.dataset.mediaId }));
    if (libraryAssetDraftMedia.length && !libraryAssetDraftMedia.some(item => item.isCover)) libraryAssetDraftMedia[0].isCover = true;
    renderAssetDraftMedia();
  });
  el.assetForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const id = el.assetFormId.value;
    const payload = { name: el.assetFormName.value, description: el.assetFormDesc.value, category: el.assetFormCategory.value, scope: BackendClient.isAdmin() ? byId('assetFormScope').value : 'private', tags: byId('assetFormTags').value.split(/[,，]/), mediaIds: libraryAssetDraftMedia.map(item => item.id), coverMediaId: libraryAssetDraftMedia.find(item => item.isCover)?.id || null };
    try {
      if (id) await BackendClient.updateLibraryAsset(id, payload); else await BackendClient.createLibraryAsset(payload);
      el.assetModal.classList.add('hidden');
      await loadLibraryData({ silent: true }); renderAssetGridUI(); if (typeof renderCanvasDrawer === 'function') renderCanvasDrawer(); showToast('资产已保存', 'success');
    } catch (error) { showToast(`保存失败：${error.message}`, 'error'); }
  });
  const rerenderAssets = () => renderAssetGridUI();
  byId('assetKbSearchInput')?.addEventListener('input', event => { clearTimeout(librarySearchTimer); librarySearchTimer = setTimeout(() => { state.assetKbSearch = event.target.value; rerenderAssets(); }, 120); });
  byId('assetKbCategorySelect')?.addEventListener('change', event => { state.assetCategoryFilter = event.target.value; rerenderAssets(); });
  byId('assetKbMediaTypeSelect')?.addEventListener('change', event => { state.assetKbMediaType = event.target.value; rerenderAssets(); });
  byId('assetKbScopeSelect')?.addEventListener('change', event => { state.assetKbScope = event.target.value; rerenderAssets(); });
  byId('btnAssetFavoriteFilter')?.addEventListener('click', event => { state.assetKbFavoriteOnly = !state.assetKbFavoriteOnly; event.currentTarget.classList.toggle('active', state.assetKbFavoriteOnly); event.currentTarget.textContent = state.assetKbFavoriteOnly ? '★ 已收藏' : '☆ 只看收藏'; rerenderAssets(); });
  byId('btnAssetBatchMode')?.addEventListener('click', event => { state.isBatchSelectingAssets = !state.isBatchSelectingAssets; if (!state.isBatchSelectingAssets) state.selectedAssetIds.clear(); event.currentTarget.textContent = state.isBatchSelectingAssets ? '完成' : '批量管理'; rerenderAssets(); });
  byId('btnDeleteSelectedAssets')?.addEventListener('click', () => deleteAssetItems([...state.selectedAssetIds]).catch(error => showToast(error.message, 'error')));
  el.assetGridContainer?.addEventListener('change', event => {
    if (event.target.dataset.action !== 'select-asset') return;
    const id = event.target.closest('[data-asset-id]')?.dataset.assetId;
    if (event.target.checked) state.selectedAssetIds.add(id); else state.selectedAssetIds.delete(id);
    rerenderAssets();
  });
  el.assetGridContainer?.addEventListener('click', async event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action || action === 'select-asset') return;
    const uploadId = event.target.closest('[data-upload-id]')?.dataset.uploadId;
    if (action === 'organize-upload') return openBindModal(uploadId);
    const item = state.assets.find(asset => asset.id === event.target.closest('[data-asset-id]')?.dataset.assetId);
    if (!item) return;
    try {
      if (action === 'use-asset-creation') await addAssetToChatRefMedia(item);
      else if (action === 'use-asset-canvas') addAssetMediaToCanvas(item);
      else if (action === 'edit-asset') openAssetEditor(item);
      else if (action === 'delete-asset') await deleteAssetItems([item.id]);
      else if (action === 'copy-asset-item') { await BackendClient.copyLibraryAsset(item.id); await loadLibraryData({ silent: true }); rerenderAssets(); showToast('已复制到我的资产库', 'success'); }
      else if (action === 'favorite-asset' && item.canEdit) { await BackendClient.updateLibraryAsset(item.id, { isFavorite: !item.isFavorite }); await loadLibraryData({ silent: true }); rerenderAssets(); }
    } catch (error) { showToast(`操作失败：${error.message}`, 'error'); }
  });
}

document.addEventListener('DOMContentLoaded', bindLibraryUi);

/* ========================================================================== */
/* 多角度创作：虚拟摄像机 + 现有图片 API */
/* ========================================================================== */
const multiAngleState = {
  initialized: false,
  source: '',
  sourceName: '',
  sourceImage: null,
  azimuth: 45,
  elevation: 10,
  distance: 5,
  batchAngles: new Map(),
  results: [],
  generating: false,
  scene: null,
  fallback: false,
  pointer: null,
  dragDepth: 0,
  priceRequestId: 0
};
let multiAngleReconcilePromise = null;
let multiAngleReconcileTimer = null;

const MULTI_ANGLE_SIZE_BY_ASPECT = {
  '1:1': '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '4:3': '1536x1024'
};

function getMultiAngleModel() {
  return getPreferredServerModel('multi-angle', 'image', state.apiConfig?.imageModel);
}

function renderMultiAngleModel() {
  const target = document.getElementById('multiAngleModel');
  if (!target) return;
  const models = getServerModels('multi-angle', 'image');
  const model = getMultiAngleModel();
  const item = models.find(entry => entry.model === model);
  target.textContent = model ? getModelDisplayName(item) : '暂无可用模型';
  target.title = model || '请联系管理员启用多角度图片模型';
  updateMultiAngleGenerateState();
  void updateMultiAnglePricePreview();
}

function multiAngleDistanceLabel(distance = multiAngleState.distance) {
  if (distance <= 3.3) return '特写';
  if (distance <= 4.4) return '近景';
  if (distance <= 6.2) return '中景';
  return '远景';
}

function normalizedAngle(value) {
  return ((Number(value) % 360) + 360) % 360;
}

function multiAnglePosition() {
  const azimuth = normalizedAngle(multiAngleState.azimuth) * Math.PI / 180;
  const elevation = Number(multiAngleState.elevation) * Math.PI / 180;
  const radius = Number(multiAngleState.distance);
  return {
    x: Math.sin(azimuth) * Math.cos(elevation) * radius,
    y: Math.sin(elevation) * radius,
    z: Math.cos(azimuth) * Math.cos(elevation) * radius
  };
}

function syncMultiAngleControls(options = {}) {
  const azimuth = Math.round(normalizedAngle(multiAngleState.azimuth));
  const elevation = Math.round(Math.max(-30, Math.min(60, Number(multiAngleState.elevation))));
  const distance = Math.max(2.5, Math.min(8, Number(multiAngleState.distance)));
  multiAngleState.azimuth = azimuth;
  multiAngleState.elevation = elevation;
  multiAngleState.distance = distance;
  const azimuthInput = document.getElementById('multiAngleAzimuth');
  const elevationInput = document.getElementById('multiAngleElevation');
  const distanceInput = document.getElementById('multiAngleDistance');
  if (azimuthInput) azimuthInput.value = String(azimuth);
  if (elevationInput) elevationInput.value = String(elevation);
  if (distanceInput) distanceInput.value = String(distance);
  const azimuthOutput = document.getElementById('multiAngleAzimuthValue');
  const elevationOutput = document.getElementById('multiAngleElevationValue');
  const distanceOutput = document.getElementById('multiAngleDistanceValue');
  if (azimuthOutput) azimuthOutput.textContent = `${azimuth}°`;
  if (elevationOutput) elevationOutput.textContent = `${elevation}°`;
  if (distanceOutput) distanceOutput.textContent = multiAngleDistanceLabel(distance);
  const position = multiAnglePosition();
  const readout = document.getElementById('multiAngleCameraReadout');
  if (readout) readout.textContent = `X ${position.x.toFixed(2)}   Y ${position.y.toFixed(2)}   Z ${position.z.toFixed(2)}`;
  document.querySelectorAll('#multiAnglePresetGrid button').forEach(button => {
    const matches = Number(button.dataset.azimuth) === azimuth && Number(button.dataset.elevation) === elevation;
    button.classList.toggle('active', !document.getElementById('multiAngleBatchMode')?.checked && matches);
  });
  updateMultiAngleScene();
  if (options.price !== false) void updateMultiAnglePricePreview();
}

function createMultiAngleFallbackScene() {
  multiAngleState.fallback = true;
  multiAngleState.scene = null;
  drawMultiAngleFallback();
}

function drawMultiAngleFallback() {
  if (!multiAngleState.fallback) return;
  const canvas = document.getElementById('multiAngleCanvas');
  const viewport = document.getElementById('multiAngleViewport');
  if (!canvas || !viewport) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const centerX = width * .5;
  const centerY = height * .52;
  ctx.strokeStyle = '#d9dee8';
  ctx.lineWidth = 1;
  for (let offset = -8; offset <= 8; offset += 1) {
    ctx.beginPath();
    ctx.moveTo(0, centerY + offset * 25);
    ctx.lineTo(width, centerY + offset * 25);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(centerX, centerY + 58);
  ctx.scale(1, .34);
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(width, height) * .34, 0, Math.PI * 2);
  ctx.strokeStyle = '#aeb9cd';
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.restore();
  const image = multiAngleState.sourceImage;
  if (image) {
    const maxW = Math.min(280, width * .36);
    const maxH = Math.min(300, height * .48);
    const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(28,42,70,.18)';
    ctx.shadowBlur = 24;
    ctx.fillRect(centerX - drawW / 2 - 8, centerY - drawH / 2 - 8, drawW + 16, drawH + 16);
    ctx.shadowBlur = 0;
    ctx.drawImage(image, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
  }
  const azimuth = normalizedAngle(multiAngleState.azimuth) * Math.PI / 180;
  const elevationFactor = multiAngleState.elevation / 60;
  const orbitRadius = Math.min(width, height) * .34 * (.7 + multiAngleState.distance / 16);
  const cameraX = centerX + Math.sin(azimuth) * orbitRadius;
  const cameraY = centerY + 58 + Math.cos(azimuth) * orbitRadius * .34 - elevationFactor * 90;
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(76,111,255,.5)';
  ctx.beginPath(); ctx.moveTo(cameraX, cameraY); ctx.lineTo(centerX, centerY); ctx.stroke();
  ctx.save();
  ctx.translate(cameraX, cameraY);
  ctx.rotate(Math.atan2(centerY - cameraY, centerX - cameraX));
  ctx.fillStyle = '#4c6fff';
  ctx.beginPath(); ctx.roundRect(-18, -12, 30, 24, 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(28, -14); ctx.lineTo(28, 14); ctx.lineTo(10, 8); ctx.closePath(); ctx.fill();
  ctx.restore();
}

async function createMultiAngleThreeScene() {
  const canvas = document.getElementById('multiAngleCanvas');
  const viewport = document.getElementById('multiAngleViewport');
  if (!canvas || !viewport) return;
  try {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js');
    if (!document.getElementById('multiAngleCanvas')) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0xffffff, 0);
    const scene = new THREE.Scene();
    const overviewCamera = new THREE.PerspectiveCamera(38, 1, .1, 100);
    overviewCamera.position.set(8.2, 6.3, 9.3);
    overviewCamera.lookAt(0, .4, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c1d1, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(4, 8, 5);
    scene.add(light);
    const grid = new THREE.GridHelper(15, 30, 0xb8c1d0, 0xdce1e9);
    grid.position.y = -1.75;
    scene.add(grid);
    const axes = new THREE.AxesHelper(2.2);
    axes.position.set(-3.9, -1.7, 2.5);
    scene.add(axes);
    const ringPoints = [];
    for (let i = 0; i <= 128; i += 1) {
      const angle = i / 128 * Math.PI * 2;
      ringPoints.push(new THREE.Vector3(Math.sin(angle) * 5, -1.62, Math.cos(angle) * 5));
    }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPoints), new THREE.LineDashedMaterial({ color: 0x91a0ba, dashSize: .14, gapSize: .1 }));
    ring.computeLineDistances();
    scene.add(ring);
    const subject = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 3.7), new THREE.MeshStandardMaterial({ color: 0xf5f7fb, side: THREE.DoubleSide, roughness: .78 }));
    subject.position.y = .2;
    scene.add(subject);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.86, 3.86, .12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .65 }));
    frame.position.set(0, .2, -.09);
    scene.add(frame);
    const cameraGroup = new THREE.Group();
    const cameraBody = new THREE.Mesh(new THREE.BoxGeometry(.72, .48, .45), new THREE.MeshStandardMaterial({ color: 0x4c6fff, roughness: .45 }));
    cameraGroup.add(cameraBody);
    const cameraLens = new THREE.Mesh(new THREE.ConeGeometry(.34, .65, 4), new THREE.MeshStandardMaterial({ color: 0x3155d3, roughness: .48 }));
    cameraLens.rotation.x = Math.PI / 2;
    cameraLens.position.z = -.52;
    cameraGroup.add(cameraLens);
    scene.add(cameraGroup);
    const aimGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const aimLine = new THREE.Line(aimGeometry, new THREE.LineDashedMaterial({ color: 0x4c6fff, transparent: true, opacity: .5, dashSize: .15, gapSize: .1 }));
    scene.add(aimLine);
    const resize = () => {
      const width = Math.max(1, viewport.clientWidth);
      const height = Math.max(1, viewport.clientHeight);
      renderer.setSize(width, height, false);
      overviewCamera.aspect = width / height;
      overviewCamera.updateProjectionMatrix();
      renderer.render(scene, overviewCamera);
    };
    const setImage = image => {
      if (!image) return;
      const texture = new THREE.Texture(image);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      const aspect = image.naturalWidth / image.naturalHeight || 1;
      const width = aspect >= 1 ? 3.7 : 3.7 * aspect;
      const height = aspect >= 1 ? 3.7 / aspect : 3.7;
      subject.geometry.dispose();
      subject.geometry = new THREE.PlaneGeometry(width, height);
      subject.material.map?.dispose?.();
      subject.material.map = texture;
      subject.material.color.set(0xffffff);
      subject.material.needsUpdate = true;
      frame.scale.set((width + .16) / 3.86, (height + .16) / 3.86, 1);
      renderer.render(scene, overviewCamera);
    };
    const update = () => {
      const position = multiAnglePosition();
      cameraGroup.position.set(position.x, position.y, position.z);
      cameraGroup.lookAt(0, .1, 0);
      const coordinates = aimLine.geometry.attributes.position.array;
      coordinates[0] = position.x; coordinates[1] = position.y; coordinates[2] = position.z;
      coordinates[3] = 0; coordinates[4] = .1; coordinates[5] = 0;
      aimLine.geometry.attributes.position.needsUpdate = true;
      aimLine.computeLineDistances();
      renderer.render(scene, overviewCamera);
    };
    multiAngleState.fallback = false;
    multiAngleState.scene = { THREE, renderer, scene, camera: overviewCamera, cameraGroup, aimLine, subject, setImage, update, resize };
    new ResizeObserver(resize).observe(viewport);
    resize();
    if (multiAngleState.sourceImage) setImage(multiAngleState.sourceImage);
    update();
  } catch (error) {
    console.warn('Three.js 多角度视口不可用，已切换本地 Canvas 投影:', error.message);
    createMultiAngleFallbackScene();
  }
}

function updateMultiAngleScene() {
  if (multiAngleState.scene?.update) multiAngleState.scene.update();
  else drawMultiAngleFallback();
}

function loadMultiAngleImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法读取'));
    image.src = source;
  });
}

async function compressMultiAngleFile(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadMultiAngleImage(objectUrl);
    let maxSide = 1280;
    let quality = .86;
    let dataUrl = '';
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= 1_250_000) break;
      maxSide = Math.round(maxSide * .82);
      quality = Math.max(.68, quality - .07);
    }
    if (dataUrl.length > 1_700_000) throw new Error('图片压缩后仍过大，请使用更小的图片');
    return { dataUrl, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function setMultiAngleSource(source, name = '参考图', meta = '') {
  const image = await loadMultiAngleImage(source);
  multiAngleState.source = source;
  multiAngleState.sourceName = name;
  multiAngleState.sourceImage = image;
  const thumb = document.getElementById('multiAngleSourceThumb');
  if (thumb) thumb.innerHTML = `<img src="${escapeHTML(source)}" alt="已上传原图">`;
  const sourceName = document.getElementById('multiAngleSourceName');
  const sourceMeta = document.getElementById('multiAngleSourceMeta');
  if (sourceName) sourceName.textContent = name;
  if (sourceMeta) sourceMeta.textContent = meta || `${image.naturalWidth} × ${image.naturalHeight}`;
  document.getElementById('multiAngleEmpty')?.classList.add('hidden');
  multiAngleState.scene?.setImage?.(image);
  drawMultiAngleFallback();
  updateMultiAngleGenerateState();
}

async function handleMultiAngleFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return showToast('请选择有效图片', 'warning');
  try {
    const compressed = await compressMultiAngleFile(file);
    await setMultiAngleSource(compressed.dataUrl, file.name, `原图 ${compressed.width} × ${compressed.height}·已优化上传`);
    showToast('原图已加载，现在可以摆放摄像机');
  } catch (error) {
    showToast(`图片读取失败：${error.message}`, 'error');
  }
}

function multiAngleDirectionLabel(azimuth, elevation) {
  const normalized = normalizedAngle(azimuth);
  const horizontal = normalized < 22.5 || normalized >= 337.5 ? '正前方'
    : normalized < 67.5 ? '右前方'
      : normalized < 112.5 ? '右侧'
        : normalized < 157.5 ? '右后方'
          : normalized < 202.5 ? '正后方'
            : normalized < 247.5 ? '左后方'
              : normalized < 292.5 ? '左侧' : '左前方';
  const vertical = elevation >= 35 ? '明显俯视' : elevation >= 12 ? '轻微俯视' : elevation <= -18 ? '明显仰视' : elevation <= -7 ? '轻微仰视' : '平视';
  return `${horizontal}·${vertical}`;
}

function buildMultiAnglePrompt(pose) {
  const custom = document.getElementById('multiAnglePrompt')?.value.trim();
  const distance = multiAngleDistanceLabel(pose.distance);
  return `使用参考图作为严格的主体和场景依据。\n保持主体身份、五官、发型、服装、材质、颜色、比例和背景风格一致。\n将摄像机移动到主体${multiAngleDirectionLabel(pose.azimuth, pose.elevation)}，水平方位角 ${Math.round(pose.azimuth)} 度，俯仰角 ${Math.round(pose.elevation)} 度，${distance}构图。\n生成该摄像机位置真实看到的新视角照片，而不是把原图旋转、拉伸或做平面透视变形。\n不要增加、删除或重新设计主要物体，不要添加文字或水印。${custom ? `\n补充要求：${custom}` : ''}`;
}

function getMultiAngleGenerationPoses() {
  const batch = document.getElementById('multiAngleBatchMode')?.checked;
  if (batch && multiAngleState.batchAngles.size) return [...multiAngleState.batchAngles.values()];
  return [{
    key: `custom_${multiAngleState.azimuth}_${multiAngleState.elevation}_${multiAngleState.distance}`,
    label: multiAngleDirectionLabel(multiAngleState.azimuth, multiAngleState.elevation),
    azimuth: multiAngleState.azimuth,
    elevation: multiAngleState.elevation,
    distance: multiAngleState.distance
  }];
}

function updateMultiAngleGenerateState() {
  const button = document.getElementById('btnMultiAngleGenerate');
  if (!button) return;
  button.disabled = multiAngleState.generating || !multiAngleState.source || !getMultiAngleModel();
  const label = button.querySelector('span');
  const count = getMultiAngleGenerationPoses().length;
  if (label) label.textContent = multiAngleState.generating ? '正在生成...' : (count > 1 ? `批量生成 ${count} 个角度` : '生成对应角度');
}

async function updateMultiAnglePricePreview() {
  const target = document.getElementById('multiAnglePricePreview');
  if (!target) return;
  const model = getMultiAngleModel();
  const count = getMultiAngleGenerationPoses().length;
  const requestId = ++multiAngleState.priceRequestId;
  updateMultiAngleGenerateState();
  if (!model) { target.textContent = '积分预算：--'; return; }
  target.textContent = '积分预算：读取中';
  try {
    const pricing = await BackendClient.previewPricing({ mode: 'multi-angle', operation: 'image', model, count });
    if (requestId !== multiAngleState.priceRequestId) return;
    target.textContent = `${pricing.credits} 积分`;
    target.title = `${count} 张 × ${pricing.unitCredits} 积分/张`;
  } catch (error) {
    if (requestId !== multiAngleState.priceRequestId) return;
    target.textContent = '积分预算：--';
    target.title = error.message;
  }
}

function persistMultiAngleResults() {
  const safe = multiAngleState.results
    .filter(item => item.taskId || item.imageResultId)
    .slice(0, 40)
    .map(({ id, label, azimuth, elevation, distance, source, createdAt, prompt, taskId, status, error, mediaId, imageResultId, model, aspectRatio }) => ({
      id, label, azimuth, elevation, distance,
      source: /^https?:\/\//i.test(source || '') ? source : '',
      createdAt, prompt, taskId, status, error, mediaId, imageResultId, model, aspectRatio
    }));
  localStorage.setItem('vkb_multi_angle_results', JSON.stringify(safe));
}

function loadMultiAngleResults() {
  try {
    const stored = JSON.parse(localStorage.getItem('vkb_multi_angle_results') || '[]');
    multiAngleState.results = Array.isArray(stored) ? stored.slice(0, 40) : [];
  } catch (error) {
    multiAngleState.results = [];
  }
  renderMultiAngleResults();
  void reconcileMultiAngleResults();
}

function parseMultiAnglePoseFromTask(task) {
  const prompt = String(task?.prompt || '');
  const azimuth = Number(prompt.match(/水平方位角\s*(-?\d+(?:\.\d+)?)\s*度/)?.[1] || 0);
  const elevation = Number(prompt.match(/俯仰角\s*(-?\d+(?:\.\d+)?)\s*度/)?.[1] || 0);
  const label = prompt.match(/移动到主体([^，\n]+)/)?.[1]?.trim() || multiAngleDirectionLabel(azimuth, elevation);
  const distance = prompt.includes('特写构图') ? 3
    : prompt.includes('近景构图') ? 4
      : prompt.includes('远景构图') ? 7 : 5;
  return { label, azimuth, elevation, distance };
}

function multiAngleResultFromTask(task, existing = null) {
  const pose = parseMultiAnglePoseFromTask(task);
  const sources = extractImageSourcesFromOutput(task?.output || {});
  const localMedia = Array.isArray(task?.output?._localMedia) ? task.output._localMedia.find(item => item?.id) : null;
  const terminalFailure = ['failed', 'refunded', 'canceled'].includes(task?.status);
  const status = task?.status === 'completed' && (sources.length || localMedia)
    ? 'completed'
    : terminalFailure || task?.status === 'completed' ? 'failed' : 'running';
  return {
    ...pose,
    ...(existing || {}),
    id: existing?.id || `ma_recovered_${task.id}`,
    taskId: task.id,
    prompt: task.prompt || existing?.prompt || '',
    createdAt: existing?.createdAt || new Date(task.createdAt || Date.now()).getTime(),
    status,
    source: status === 'completed' ? sources[0] : (existing?.source || ''),
    mediaId: localMedia?.id || existing?.mediaId || '',
    imageResultId: existing?.imageResultId || '',
    model: task.model || existing?.model || '',
    aspectRatio: existing?.aspectRatio || '',
    error: status === 'failed'
      ? (task.errorMessage || (task.status === 'completed' ? '服务端已完成，但未返回可识别的图片地址' : '生成失败'))
      : ''
  };
}

async function cacheMultiAngleResultLocally(result, task) {
  if (!result || task?.status !== 'completed') return result;
  let backendTask = task;
  let localMedia = Array.isArray(backendTask.output?._localMedia) ? backendTask.output._localMedia.find(item => item?.id) : null;
  if (!localMedia) {
    backendTask = await BackendClient.cacheGenerationMedia(task.id);
    localMedia = Array.isArray(backendTask.output?._localMedia) ? backendTask.output._localMedia.find(item => item?.id) : null;
  }
  if (!localMedia?.id) throw new Error('服务端未能保存生成图片');
  const imageResultId = `multi_angle_${task.id}_${localMedia.id}`;
  let source = await loadImageResultData(imageResultId).catch(() => null);
  if (!source) {
    const blob = await BackendClient.fetchMediaBlob(localMedia.id);
    await saveImageResultBlob(imageResultId, blob);
    source = await loadImageResultData(imageResultId);
  }
  result.status = 'completed';
  result.error = '';
  result.mediaId = localMedia.id;
  result.imageResultId = imageResultId;
  result.source = source || result.source;
  result.model = backendTask.model || result.model || '';
  result.aspectRatio = result.aspectRatio || document.getElementById('multiAngleAspect')?.value || '1:1';
  syncMultiAngleResultToHistory(result, backendTask);
  return result;
}

function syncMultiAngleResultToHistory(result, backendTask) {
  if (!result?.taskId || !result.imageResultId) return;
  const existing = state.taskHistory.find(task => task.taskId === result.taskId);
  if (existing?.status === 'completed' && existing.imageResultId === result.imageResultId) return;
  const historyTask = existing || {
    taskId: result.taskId,
    backendTaskId: result.taskId,
    createdAt: result.createdAt || Date.now()
  };
  Object.assign(historyTask, {
    prompt: result.prompt || `${result.label} · 多角度创作`,
    model: backendTask?.model || result.model || getMultiAngleModel(),
    mediaType: 'image',
    operation: 'image',
    source: 'multi-angle',
    imageResultId: result.imageResultId,
    imageResultIds: [result.imageResultId],
    imageUrl: null,
    imageUrls: [],
    imageSize: backendTask?.input?.size || '',
    options: { aspectRatio: result.aspectRatio || '1:1', size: backendTask?.input?.size || '' }
  });
  if (!existing) state.activeTasks.push(historyTask);
  completeTask(result.taskId, 'completed', null, null, historyTask.prompt, historyTask.model, backendTask);
}

function scheduleMultiAngleReconcile(delay = 5000) {
  if (multiAngleReconcileTimer) clearTimeout(multiAngleReconcileTimer);
  multiAngleReconcileTimer = setTimeout(() => {
    multiAngleReconcileTimer = null;
    void reconcileMultiAngleResults();
  }, delay);
}

async function reconcileMultiAngleResults() {
  if (!BackendClient.isAuthenticated()) return [];
  if (multiAngleReconcilePromise) return multiAngleReconcilePromise;
  multiAngleReconcilePromise = (async () => {
    try {
      const clearedAt = Number(localStorage.getItem('vkb_multi_angle_cleared_at') || 0);
      const tasks = (await BackendClient.listGenerations(100))
        .filter(task => task.mode === 'multi-angle' && task.operation === 'image')
        .filter(task => new Date(task.createdAt || 0).getTime() > clearedAt)
        .slice(0, 40);
      const existingByTaskId = new Map(multiAngleState.results.filter(item => item.taskId).map(item => [item.taskId, item]));
      const backendTaskIds = new Set(tasks.map(task => task.id));
      const reconciled = tasks.map(task => multiAngleResultFromTask(task, existingByTaskId.get(task.id)));
      for (let index = 0; index < reconciled.length; index += 1) {
        if (tasks[index].status !== 'completed') continue;
        try {
          await cacheMultiAngleResultLocally(reconciled[index], tasks[index]);
        } catch (error) {
          reconciled[index].status = 'failed';
          reconciled[index].error = /404|410|下载失败|失效/.test(error.message)
            ? '原始临时图片已失效，请重新生成此角度'
            : `图片保存失败：${error.message}`;
        }
      }
      const localOnly = multiAngleState.results.filter(item => !item.taskId || !backendTaskIds.has(item.taskId));
      multiAngleState.results = [...reconciled, ...localOnly]
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
        .slice(0, 40);
      persistMultiAngleResults();
      renderMultiAngleResults();
      if (multiAngleState.results.some(item => item.status === 'running')) scheduleMultiAngleReconcile();
      return reconciled;
    } catch (error) {
      console.warn('多角度任务状态恢复失败:', error.message);
      if (multiAngleState.results.some(item => item.status === 'running')) scheduleMultiAngleReconcile();
      return [];
    } finally {
      multiAngleReconcilePromise = null;
    }
  })();
  return multiAngleReconcilePromise;
}

function renderMultiAngleResults() {
  const grid = document.getElementById('multiAngleResults');
  const summary = document.getElementById('multiAngleResultsSummary');
  if (!grid) return;
  if (summary) {
    const completed = multiAngleState.results.filter(item => item.status === 'completed').length;
    const running = multiAngleState.results.filter(item => item.status === 'running').length;
    summary.textContent = multiAngleState.results.length ? `${completed} 张已完成${running ? `·${running} 个生成中` : ''}` : '还没有生成记录';
  }
  if (!multiAngleState.results.length) {
    grid.innerHTML = '<div class="multi-angle-results-empty">选择视角后点击生成，结果会保留在这里</div>';
    return;
  }
  grid.querySelector('.multi-angle-results-empty')?.remove();
  const existingCards = new Map(Array.from(grid.querySelectorAll('[data-ma-result-card]')).map(card => [card.dataset.maResultCard, card]));
  const activeIds = new Set();
  multiAngleState.results.forEach(item => {
    activeIds.add(item.id);
    let card = existingCards.get(item.id);
    if (!card) {
      card = document.createElement('article');
      card.className = 'multi-angle-result-card';
      card.dataset.maResultCard = item.id;
    }
    const detail = `方位 ${Math.round(item.azimuth)}°·俯仰 ${Math.round(item.elevation)}°·${multiAngleDistanceLabel(item.distance)}`;
    const renderKey = JSON.stringify([item.status, item.imageResultId || '', item.source || '', item.error || '', detail, item.label]);
    const media = item.status === 'running'
      ? '<div class="result-loading">模型正在重建新视角</div>'
      : item.status === 'failed'
        ? `<div class="result-error">生成失败<br>${escapeHTML(item.error || '请稍后重试')}</div>`
        : `<img ${item.imageResultId ? `data-image-result-id="${escapeHTML(item.imageResultId)}"` : ''} ${item.source ? `src="${escapeHTML(item.source)}"` : ''} alt="${escapeHTML(item.label)}生成结果">`;
    const actions = item.status === 'completed' ? `<div class="multi-angle-result-actions"><button type="button" data-ma-action="download" data-result-id="${item.id}">下载</button><button type="button" data-ma-action="save" data-result-id="${item.id}">存入资产库</button><button type="button" data-ma-action="continue" data-result-id="${item.id}">继续换角度</button></div>` : '';
    if (card.dataset.renderKey !== renderKey) {
      card.innerHTML = `<div class="multi-angle-result-media">${media}</div><div class="multi-angle-result-info"><strong>${escapeHTML(item.label)}</strong><small>${detail}</small>${actions}</div>`;
      card.dataset.renderKey = renderKey;
    }
    grid.appendChild(card);
  });
  existingCards.forEach((card, id) => { if (!activeIds.has(id)) card.remove(); });
  void hydrateStoredImageElements(grid);
}

async function runMultiAnglePose(pose, result) {
  const model = getMultiAngleModel();
  const aspect = document.getElementById('multiAngleAspect')?.value || '1:1';
  const prompt = buildMultiAnglePrompt(pose);
  result.prompt = prompt;
  const requestId = `multi_angle_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  try {
    const created = await BackendClient.createGeneration({
      mode: 'multi-angle',
      operation: 'image',
      model,
      prompt,
      input: { size: MULTI_ANGLE_SIZE_BY_ASPECT[aspect] || '1024x1024', images: [multiAngleState.source], n: 1 },
      count: 1,
      requestId
    });
    result.taskId = created.task?.id || '';
    persistMultiAngleResults();
    const task = await BackendClient.waitForGeneration(created.task, { timeoutMs: 300000 });
    const sources = extractImageSourcesFromOutput(task.output || {});
    const localMedia = Array.isArray(task.output?._localMedia) && task.output._localMedia.some(item => item?.id);
    if (!sources.length && !localMedia) throw new Error('服务端未返回图片');
    result.status = 'completed';
    result.source = sources[0] || '';
    result.taskId = task.id || result.taskId;
    result.model = task.model || model;
    result.aspectRatio = aspect;
    await cacheMultiAngleResultLocally(result, task);
  } catch (error) {
    const status = Number(error?.status || 0);
    const transient = !status || status === 408 || status === 429 || status >= 500;
    if (result.taskId && transient) {
      result.status = 'running';
      result.error = '连接暂时中断，正在自动恢复后台任务';
      scheduleMultiAngleReconcile(1500);
    } else {
      result.status = 'failed';
      result.error = error.message || '生成失败';
    }
  }
  renderMultiAngleResults();
  persistMultiAngleResults();
  await BackendClient.refreshWallet().catch(() => {});
}

async function generateMultiAngleImages() {
  if (multiAngleState.generating) return;
  if (!multiAngleState.source) return showToast('请先上传原始图片', 'warning');
  if (!getMultiAngleModel()) return showToast('暂无可用的多角度图片模型，请联系管理员', 'error');
  const poses = getMultiAngleGenerationPoses();
  const pricing = await BackendClient.previewPricing({ mode: 'multi-angle', operation: 'image', model: getMultiAngleModel(), count: poses.length }).catch(error => {
    showToast(`无法确认积分：${error.message}`, 'error');
    return null;
  });
  if (!pricing) return;
  multiAngleState.generating = true;
  updateMultiAngleGenerateState();
  const createdAt = Date.now();
  const pending = poses.map((pose, index) => ({
    ...pose,
    id: `ma_${createdAt}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    status: 'running',
    createdAt
  }));
  multiAngleState.results.unshift(...pending);
  renderMultiAngleResults();
  document.querySelector('.multi-angle-results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(`已提交 ${poses.length} 个角度，预计消耗 ${pricing.credits} 积分`);
  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const index = cursor++;
      await runMultiAnglePose(poses[index], pending[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, pending.length) }, worker));
  multiAngleState.generating = false;
  updateMultiAngleGenerateState();
  const completed = pending.filter(item => item.status === 'completed').length;
  showToast(completed === pending.length ? `已完成 ${completed} 个角度` : `完成 ${completed}/${pending.length}，失败任务已自动释放积分`, completed ? 'success' : 'error');
}

async function handleMultiAngleResultAction(event) {
  const button = event.target.closest('[data-ma-action]');
  if (!button) return;
  const item = multiAngleState.results.find(result => result.id === button.dataset.resultId);
  if (!item) return;
  const source = item.imageResultId ? await loadImageResultData(item.imageResultId).catch(() => null) : item.source;
  if (!source) return showToast('图片暂时不可用，请稍后重试', 'warning');
  if (button.dataset.maAction === 'download') return downloadGeneratedImage(source, { taskId: item.taskId, prompt: item.prompt });
  if (button.dataset.maAction === 'save') return saveGeneratedImageToAssetLibrary(source, { taskId: item.taskId, prompt: item.prompt, model: item.model || getMultiAngleModel() });
  if (button.dataset.maAction === 'continue') {
    try {
      await setMultiAngleSource(source, `${item.label}生成结果`, '已设为新的视角参考图');
      document.getElementById('multiAngleViewport')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('已将结果设为新的原图，可继续调整角度');
    } catch (error) {
      showToast(`图片加载失败：${error.message}`, 'error');
    }
  }
}

function bindMultiAnglePointerControls() {
  const viewport = document.getElementById('multiAngleViewport');
  if (!viewport) return;
  viewport.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    multiAngleState.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, azimuth: multiAngleState.azimuth, elevation: multiAngleState.elevation };
    viewport.setPointerCapture?.(event.pointerId);
  });
  viewport.addEventListener('pointermove', event => {
    const pointer = multiAngleState.pointer;
    if (!pointer || pointer.id !== event.pointerId || !multiAngleState.source) return;
    multiAngleState.azimuth = pointer.azimuth + (event.clientX - pointer.x) * .5;
    multiAngleState.elevation = pointer.elevation - (event.clientY - pointer.y) * .35;
    syncMultiAngleControls({ price: false });
  });
  const end = event => {
    if (multiAngleState.pointer?.id === event.pointerId) {
      multiAngleState.pointer = null;
      void updateMultiAnglePricePreview();
    }
  };
  viewport.addEventListener('pointerup', end);
  viewport.addEventListener('pointercancel', end);
  viewport.addEventListener('wheel', event => {
    if (!multiAngleState.source) return;
    event.preventDefault();
    multiAngleState.distance += Math.sign(event.deltaY) * .25;
    syncMultiAngleControls();
  }, { passive: false });
}

function bindMultiAngleDropUpload() {
  const page = document.getElementById('viewMultiAngle');
  const viewport = document.getElementById('multiAngleViewport');
  if (!page || !viewport) return;
  const hasFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');
  const resetDragState = () => {
    multiAngleState.dragDepth = 0;
    viewport.classList.remove('is-dragover');
  };
  page.addEventListener('dragenter', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    multiAngleState.dragDepth += 1;
    viewport.classList.add('is-dragover');
  });
  page.addEventListener('dragover', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    viewport.classList.add('is-dragover');
  });
  page.addEventListener('dragleave', event => {
    if (!hasFiles(event)) return;
    multiAngleState.dragDepth = Math.max(0, multiAngleState.dragDepth - 1);
    if (!multiAngleState.dragDepth) viewport.classList.remove('is-dragover');
  });
  page.addEventListener('drop', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    resetDragState();
    const files = [...(event.dataTransfer?.files || [])];
    const file = files.find(item => item.type.startsWith('image/'));
    if (!file) return showToast('请拖入 JPG、PNG 或 WEBP 图片', 'warning');
    if (files.length > 1) showToast('每次使用第一张图片，其余图片未上传', 'info');
    void handleMultiAngleFile(file);
  });
  window.addEventListener('dragend', resetDragState);
  window.addEventListener('drop', () => {
    if (multiAngleState.dragDepth) resetDragState();
  });
}

function initMultiAngleCreator() {
  if (multiAngleState.initialized) {
    multiAngleState.scene?.resize?.();
    renderMultiAngleModel();
    void reconcileMultiAngleResults();
    return;
  }
  multiAngleState.initialized = true;
  const fileInput = document.getElementById('multiAngleFileInput');
  ['btnMultiAngleUploadEmpty', 'btnMultiAngleUpload'].forEach(id => document.getElementById(id)?.addEventListener('click', () => fileInput?.click()));
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    void handleMultiAngleFile(file);
  });
  const inputs = [
    ['multiAngleAzimuth', 'azimuth'],
    ['multiAngleElevation', 'elevation'],
    ['multiAngleDistance', 'distance']
  ];
  inputs.forEach(([id, key]) => document.getElementById(id)?.addEventListener('input', event => {
    multiAngleState[key] = Number(event.target.value);
    syncMultiAngleControls();
  }));
  document.getElementById('btnMultiAngleReset')?.addEventListener('click', () => {
    multiAngleState.azimuth = 45;
    multiAngleState.elevation = 10;
    multiAngleState.distance = 5;
    syncMultiAngleControls();
  });
  document.getElementById('multiAnglePresetGrid')?.addEventListener('click', event => {
    const button = event.target.closest('button[data-azimuth]');
    if (!button) return;
    const pose = { key: button.dataset.label, label: button.dataset.label, azimuth: Number(button.dataset.azimuth), elevation: Number(button.dataset.elevation), distance: multiAngleState.distance };
    multiAngleState.azimuth = pose.azimuth;
    multiAngleState.elevation = pose.elevation;
    if (document.getElementById('multiAngleBatchMode')?.checked) {
      if (multiAngleState.batchAngles.has(pose.key)) multiAngleState.batchAngles.delete(pose.key);
      else multiAngleState.batchAngles.set(pose.key, pose);
      button.classList.toggle('batch-selected', multiAngleState.batchAngles.has(pose.key));
    }
    syncMultiAngleControls();
    updateMultiAngleGenerateState();
  });
  document.getElementById('multiAngleBatchMode')?.addEventListener('change', event => {
    if (!event.target.checked) {
      multiAngleState.batchAngles.clear();
      document.querySelectorAll('#multiAnglePresetGrid button').forEach(button => button.classList.remove('batch-selected'));
    }
    syncMultiAngleControls();
    updateMultiAngleGenerateState();
  });
  document.getElementById('multiAngleAspect')?.addEventListener('change', updateMultiAnglePricePreview);
  document.getElementById('btnMultiAngleGenerate')?.addEventListener('click', generateMultiAngleImages);
  document.getElementById('multiAngleResults')?.addEventListener('click', handleMultiAngleResultAction);
  document.getElementById('btnMultiAngleClearResults')?.addEventListener('click', () => {
    if (multiAngleState.generating) return showToast('请等待当前批次完成后再清空', 'info');
    multiAngleState.results = [];
    localStorage.setItem('vkb_multi_angle_cleared_at', String(Date.now()));
    if (multiAngleReconcileTimer) clearTimeout(multiAngleReconcileTimer);
    multiAngleReconcileTimer = null;
    persistMultiAngleResults();
    renderMultiAngleResults();
  });
  bindMultiAnglePointerControls();
  bindMultiAngleDropUpload();
  loadMultiAngleResults();
  syncMultiAngleControls({ price: false });
  renderMultiAngleModel();
  void createMultiAngleThreeScene();
  window.addEventListener('resize', () => {
    multiAngleState.scene?.resize?.();
    drawMultiAngleFallback();
  });
}

window.initMultiAngleCreator = initMultiAngleCreator;


// ==========================================================================
// ✍️ 剧本创作中心 (灵感扩写、多镜头智能排版与一键应用到 AI 视频创作)
// ==========================================================================

const DEFAULT_SCRIPT_SHOTS = [
  {
    shotNum: '镜头 1 (0-3s)',
    shotType: '特写 / 快速推镜头',
    visual: '电影级4K画质，近距离环绕扫描黑色光感玻璃台面上的二手 iPhone 15 Pro 钛金属边框，无任何划痕与瑕疵。霓虹蓝光折射在磨砂玻璃背板上。',
    dialogue: '【口播】买二手最怕成色翻车？今天带你实测真正的99新顶级神仙机！',
    motion: '从相机镜头大特写拉开至机身全貌，流畅推镜头'
  },
  {
    shotNum: '镜头 2 (3-7s)',
    shotType: '中景 / 慢速平移',
    visual: '质检师熊主任身穿蓝光无尘服，戴着白手套，在微距检测台下用高精光学显微镜仔细查验手机屏幕与电池发光层。',
    dialogue: '【口播】54项官方权威全检！每一台都经过无尘光照与防伪级成色认证。',
    motion: '侧向跟随平移，画面右下角弹出绿勾质检认证印章'
  },
  {
    shotNum: '镜头 3 (7-11s)',
    shotType: '近景 / 俯拍切入',
    visual: '镜头由上至下俯拍，工作人员将专属正品防伪封条盖在极准包装盒封口处，随后双手平稳将手机递给屏幕前的买家。',
    dialogue: '【口播】正品塑封带防伪印章，扫码即查成色大牌报告，买得明白，用得安心！',
    motion: '俯拍定格后顺滑旋转 45 度镜头'
  },
  {
    shotNum: '镜头 4 (11-15s)',
    shotType: '全景 / 环绕定格',
    visual: '极准数码极简展台，背景是柔和霓虹环境光，手机在环形灯照耀下熠熠生辉，右下角弹出专属于二手/新机的智能体 Logo。',
    dialogue: '【口播】专属于二手/新机行业的推广智能体，闭眼入不踩坑！点击下方卡片立即锁单！',
    motion: '缓慢后退并定格大牌品牌画面'
  }
];

let currentScriptShots = JSON.parse(localStorage.getItem('vkb_current_script') || 'null') || DEFAULT_SCRIPT_SHOTS;

function initScriptGenModule() {
  renderScriptShotsUI(currentScriptShots);
  renderScriptHistoryListUI();

  const btnOpenHist = document.getElementById('btnOpenScriptHistoryModal');
  const btnCloseHist = document.getElementById('btnCloseScriptHistoryModal');

  if (btnOpenHist) btnOpenHist.addEventListener('click', openScriptHistoryModal);
  if (btnCloseHist) btnCloseHist.addEventListener('click', closeScriptHistoryModal);

  const btnClearHist = document.getElementById('btnClearScriptHistory');
  if (btnClearHist) {
    btnClearHist.addEventListener('click', () => {
      if (confirm('确认要清空全部历史生成的剧本记录吗？')) {
        state.scriptHistory = [];
        localStorage.removeItem('vkb_script_history');
        renderScriptHistoryListUI();
        showToast('已清空全部历史剧本记录');
      }
    });
  }

  // 导航点击事件已在 bindEvents() 中统一处理
}


function renderScriptShotsUI(shots) {
  const tbody = document.getElementById('scriptTableBody');
  if (!tbody) return;

  if (!shots || shots.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">暂无分镜头数据，请在上方输入需求后点击“生成 AI 剧本脚本”或点击右上角“➕ 添加镜头”</td></tr>`;
    return;
  }

  tbody.innerHTML = shots.map((s, idx) => `
    <tr class="script-shot-row" data-idx="${idx}" style="border-bottom: 1px solid var(--border-color);">
      <td style="padding: 10px; vertical-align: top; background: #ffffff;">
        <input type="text" class="shot-num-input form-control" value="${escapeHTML(s.shotNum)}" style="font-weight: 700; font-size: 0.85rem; color: var(--primary); padding: 6px; border: 1px solid var(--border-color); border-radius: 6px; width: 100%;">
      </td>
      <td style="padding: 10px; vertical-align: top; background: #ffffff;">
        <input type="text" class="shot-type-input form-control" value="${escapeHTML(s.shotType || '镜头')}" style="font-size: 0.825rem; font-weight: 600; color: #475569; padding: 6px; border: 1px solid var(--border-color); border-radius: 6px; width: 100%;">
      </td>
      <td style="padding: 10px; vertical-align: top; background: #ffffff;">
        <textarea class="shot-visual-textarea form-control" rows="3" style="font-size: 0.875rem; line-height: 1.5; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); width: 100%; resize: vertical; background: #fafafa;">${escapeHTML(s.visual)}</textarea>
      </td>
      <td style="padding: 10px; vertical-align: top; background: #ffffff;">
        <textarea class="shot-dialogue-textarea form-control" rows="3" style="font-size: 0.875rem; line-height: 1.5; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); color: #0369a1; width: 100%; resize: vertical; background: #f0f9ff;">${escapeHTML(s.dialogue)}</textarea>
      </td>
      <td style="padding: 10px; vertical-align: top; background: #ffffff;">
        <input type="text" class="shot-motion-input form-control" value="${escapeHTML(s.motion)}" style="font-size: 0.825rem; padding: 6px; border: 1px solid var(--border-color); border-radius: 6px; width: 100%;">
      </td>
      <td style="padding: 10px; vertical-align: top; text-align: center; background: #ffffff;">
        <button type="button" class="btn btn-ghost btn-sm" style="color: #ef4444; padding: 4px 6px;" onclick="deleteScriptShotRow(${idx})" title="删除该镜头">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function deleteScriptShotRow(idx) {
  if (currentScriptShots && currentScriptShots.length > idx) {
    currentScriptShots.splice(idx, 1);
    localStorage.setItem('vkb_current_script', JSON.stringify(currentScriptShots));
    renderScriptShotsUI(currentScriptShots);
    showToast('已删除镜头行');
  }
}


document.addEventListener('DOMContentLoaded', () => {
  // Preset prompt chips in Script Center
  if (el.scriptPresetChips) {
    el.scriptPresetChips.querySelectorAll('.chip-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.prompt;
        if (p && el.scriptInputText) {
          el.scriptInputText.value = p;
          el.scriptInputText.focus();
        }
      });
    });
  }

  if (el.btnResetScriptForm) {
    el.btnResetScriptForm.addEventListener('click', () => {
      if (el.scriptInputText) el.scriptInputText.value = '';
    });
  }


async function callRealLLMForScript(userInput, scriptType, scriptTone) {
  const modelName = state.apiConfig.llmModelName || 'gpt-5.6-sol';

  const systemPrompt = `你是一位顶级短视频与二手机/新机推广的资深编剧兼大导演。
请根据用户的构想、剧本时长 (例如 15s 短视频通常 3-5 个镜头，30s 通常 5-8 个镜头，60s 通常 8-12 个镜头) 与风格基调，自由决定最适合表达效果的镜头数量。镜头数量由你作为大导演根据表达效果自由挥洒设计，绝不受固定 4 个镜头的约束限制！
请务必严格直接输出 JSON 数组格式（不要包含任何 markdown 代码块标记，不要有导言或解释），格式示例：
[
  {
    "shotNum": "镜头 1 (0-3s)",
    "shotType": "黄金前3s开场特写",
    "visual": "详细画面拍摄描绘...",
    "dialogue": "【口播】台词对白...",
    "motion": "运镜方式..."
  },
  ...
]`;

  const userPrompt = `用户构想：${userInput}\n剧本时长：${scriptType}\n风格基调：${scriptTone}\n请作为资深大导演，根据表达效果与剧情起伏，自由设计最符合该长度的分镜头数量与脚本细节。`;

  try {
    const content = await backendGenerateText({
      mode: 'long-script',
      operation: 'long-script',
      model: modelName,
      prompt: userPrompt,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });
    const parsedShots = JSON.parse(content.replace(/```json/gi, '').replace(/```/g, '').trim());
    if (Array.isArray(parsedShots) && parsedShots.length > 0) return parsedShots;
  } catch (error) {
    console.warn('服务端剧本生成失败:', error.message);
    throw error;
  }

  // 供应商未返回有效剧本时禁止使用本地规则伪生成。
  throw new Error('API 未返回有效剧本结果');
}

  // 生成 AI 剧本脚本按键点击 (真实接入 LLM 大模型 API)
  if (el.btnGenerateScript) {
    el.btnGenerateScript.addEventListener('click', async () => {
      const input = el.scriptInputText ? el.scriptInputText.value.trim() : '';
      if (!input) {
        alert('请先在文本框中输入你的剧本构想或选择预设短句！');
        return;
      }

      const scriptType = el.scriptTypeSelect ? el.scriptTypeSelect.value : '短视频爆款 (15s)';
      const scriptTone = el.scriptToneSelect ? el.scriptToneSelect.value : '科技专业';

      if (el.scriptGenBtnIcon) el.scriptGenBtnIcon.textContent = '🧠';
      if (el.scriptGenBtnText) el.scriptGenBtnText.textContent = '正在通过 LLM 大模型生成多镜头剧本...';
      if (el.btnGenerateScript) el.btnGenerateScript.disabled = true;

      try {
        const generatedShots = await callRealLLMForScript(input, scriptType, scriptTone);

        currentScriptShots = generatedShots;
        localStorage.setItem('vkb_current_script', JSON.stringify(currentScriptShots));
        renderScriptShotsUI(currentScriptShots);

        if (el.scriptTitleInput) {
          el.scriptTitleInput.value = `【${scriptTone}·${scriptType}】${input.slice(0, 12)}...`;
        }

        showToast('🎉 LLM 大模型剧本脚本已扩写成功！');
        saveScriptToHistory({
          id: `script_${Date.now()}`,
          rawInput: input,
          title: el.scriptTitleInput ? el.scriptTitleInput.value : `【${scriptTone}·${scriptType}】${input.slice(0, 15)}`,
          scriptType: scriptType,
          scriptTone: scriptTone,
          shots: currentScriptShots,
          createdAt: Date.now()
        });
      } catch (err) {
        alert(`剧本生成提示: ${err.message}`);
      } finally {
        if (el.scriptGenBtnIcon) el.scriptGenBtnIcon.textContent = '✨';
        if (el.scriptGenBtnText) el.scriptGenBtnText.textContent = '生成 AI 剧本脚本';
        if (el.btnGenerateScript) el.btnGenerateScript.disabled = false;
      }
    });
  }

  // 添加分镜头
  const btnAddShot = document.getElementById('btnAddScriptShot');
  if (btnAddShot) {
    btnAddShot.addEventListener('click', () => {
      if (!currentScriptShots) currentScriptShots = [];
      const newIdx = currentScriptShots.length + 1;
      currentScriptShots.push({
        shotNum: `镜头 ${newIdx} (15s)`,
        shotType: '新增特写',
        visual: '新增镜头画面描述...',
        dialogue: '【口播】台词...',
        motion: '推镜头'
      });
      localStorage.setItem('vkb_current_script', JSON.stringify(currentScriptShots));
      renderScriptShotsUI(currentScriptShots);
      showToast('已添加新分镜头行');
    });
  }

  // 复制全套脚本
  if (el.btnCopyScriptText) {
    el.btnCopyScriptText.addEventListener('click', () => {
      const title = el.scriptTitleInput ? el.scriptTitleInput.value : '剧本脚本';
      const rows = document.querySelectorAll('.script-shot-row');
      let scriptMD = `# ${title}\n\n`;
      rows.forEach((row) => {
        const num = row.querySelector('.shot-num-input').value;
        const type = row.querySelector('.shot-type-input').value;
        const visual = row.querySelector('.shot-visual-textarea').value;
        const dialogue = row.querySelector('.shot-dialogue-textarea').value;
        const motion = row.querySelector('.shot-motion-input').value;
        scriptMD += `### ${num} [${type}]\n- 🎥 画面: ${visual}\n- 🗣️ 语音: ${dialogue}\n- 🔄 运镜: ${motion}\n\n`;
      });
      navigator.clipboard.writeText(scriptMD);
      showToast('📋 全套 Markdown 剧本已成功复制到剪贴板！');
    });
  }

  // ⚡ 一键应用到 AI 视频创作按键 (包含完整画面、口播台词、运镜与类型)
  if (el.btnApplyScriptToVideo) {
    el.btnApplyScriptToVideo.addEventListener('click', () => {
      const title = el.scriptTitleInput ? el.scriptTitleInput.value.trim() : '爆款剧本';
      const rows = document.querySelectorAll('.script-shot-row');
      
      let compiledPrompt = `【🎬 AI 分镜头剧本: ${title}】\n\n`;

      rows.forEach((row, idx) => {
        const num = row.querySelector('.shot-num-input')?.value || `镜头 ${idx + 1}`;
        const type = row.querySelector('.shot-type-input')?.value || '镜头';
        const visual = row.querySelector('.shot-visual-textarea')?.value || '';
        const dialogue = row.querySelector('.shot-dialogue-textarea')?.value || '';
        const motion = row.querySelector('.shot-motion-input')?.value || '';

        compiledPrompt += `📍 ${num} [${type}]\n`;
        if (visual) compiledPrompt += `- 🎥 画面镜头: ${visual}\n`;
        if (dialogue) compiledPrompt += `- 🗣️ 口播台词: ${dialogue}\n`;
        if (motion) compiledPrompt += `- 🔄 运镜轨迹: ${motion}\n`;
        compiledPrompt += `\n`;
      });

      compiledPrompt += `✨ 全片画质要求: 电影级4K超高清, Sora 旗舰质感与画面光影。`;

      syncChatGenerationMode('video');
      switchView('videoGen');

      if (el.aiChatTextarea) {
        el.aiChatTextarea.value = compiledPrompt;
        el.aiChatTextarea.focus();
        el.aiChatTextarea.style.height = 'auto';
        el.aiChatTextarea.style.height = Math.min(el.aiChatTextarea.scrollHeight, 260) + 'px';
      }

      showToast('⚡ 全套剧本（画面+口播台词+运镜）已完整导入 AI 视频创作框！');
    });
  }
});


function saveScriptToHistory(record) {
  if (!state.scriptHistory) state.scriptHistory = [];
  const idx = state.scriptHistory.findIndex(s => s.id === record.id);
  if (idx >= 0) {
    state.scriptHistory[idx] = record;
  } else {
    state.scriptHistory.unshift(record);
  }
  state.scriptHistory = state.scriptHistory.slice(0, 50);
  localStorage.setItem('vkb_script_history', JSON.stringify(state.scriptHistory));
  renderScriptHistoryListUI();
}

function openScriptHistoryModal() {
  console.log("openScriptHistoryModal triggered");
  const modal = document.getElementById('scriptHistoryModal');
  if (modal) {
    modal.style.setProperty('display', 'flex', 'important');
    modal.classList.remove('hidden');
  } else {
    alert('历史剧本弹窗 DOM 未找到！');
  }
  try {
    renderScriptHistoryListUI();
  } catch (err) {
    console.error("renderScriptHistoryListUI error:", err);
  }
}
window.openScriptHistoryModal = openScriptHistoryModal;

function closeScriptHistoryModal() {
  const modal = document.getElementById('scriptHistoryModal');
  if (modal) {
    modal.style.setProperty('display', 'none', 'important');
    modal.classList.add('hidden');
  }
}
window.closeScriptHistoryModal = closeScriptHistoryModal;

function renderScriptHistoryListUI() {
  const container = document.getElementById('scriptHistoryListContainer');
  const countBadge = document.getElementById('scriptHistoryCountBadge');
  if (!container) return;

  const history = state.scriptHistory || [];
  if (countBadge) countBadge.textContent = history.length;

  if (history.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 16px; font-size: 0.9rem;">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">📜</div>
        暂无历史生成剧本记录，生成后将自动保存在此处
      </div>
    `;
    return;
  }

  container.innerHTML = history.map(item => {
    if (!item) return '';
    let timeStr = '近期生成';
    try {
      if (item.createdAt) timeStr = new Date(item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch(e){}
    const shotCount = (item.shots && item.shots.length) || 0;
    
    return `
      <div class="script-history-modal-item" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 2px 8px;">${escapeHTML(item.scriptTone || '科技专业')} · ${escapeHTML(item.scriptType || '15s')}</span>
            <span style="font-size: 0.925rem; font-weight: 700; color: #0f172a;">${escapeHTML(item.title)}</span>
          </div>
          <span style="font-size: 0.75rem; color: #94a3b8;">⏱️ 生成时间: ${timeStr}</span>
        </div>

        <!-- 关键高亮：原始输入记录 -->
        <div style="font-size: 0.85rem; color: #1e293b; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; line-height: 1.5;">
          <strong style="color: #0284c7; display: block; margin-bottom: 2px;">💬 您的原始输入构想：</strong>
          <span style="color: #334155; word-break: break-all;">${escapeHTML(item.rawInput || item.title)}</span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 2px;">
          <span style="font-size: 0.775rem; color: #64748b; font-weight: 500;">🎬 已包含 ${shotCount} 个结构化分镜头画面</span>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm btn-load-hist-script" data-id="${item.id}" style="font-size: 0.775rem; padding: 6px 14px; border-radius: 8px;">📖 载入编辑</button>
            <button type="button" class="btn btn-primary btn-sm btn-apply-hist-script" data-id="${item.id}" style="font-size: 0.775rem; padding: 6px 14px; border-radius: 8px;">⚡ 一键应用到 AI 视频创作</button>
            <button type="button" class="btn btn-ghost btn-sm btn-del-hist-script" data-id="${item.id}" style="color: #ef4444; font-size: 0.775rem; padding: 6px 10px;" title="删除此记录">🗑️ 删除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-load-hist-script').forEach(btn => {
    btn.addEventListener('click', () => {
      const scriptId = btn.dataset.id;
      const item = state.scriptHistory.find(s => s.id === scriptId);
      if (item) {
        currentScriptShots = item.shots;
        localStorage.setItem('vkb_current_script', JSON.stringify(currentScriptShots));
        renderScriptShotsUI(currentScriptShots);
        const titleInput = document.getElementById('scriptTitleInput');
        const inputText = document.getElementById('scriptInputText');
        if (titleInput) titleInput.value = item.title;
        if (inputText && item.rawInput) inputText.value = item.rawInput;
        closeScriptHistoryModal();
        showToast('📖 已成功载入历史剧本分镜头及原始输入！');
      }
    });
  });

  container.querySelectorAll('.btn-apply-hist-script').forEach(btn => {
    btn.addEventListener('click', () => {
      const scriptId = btn.dataset.id;
      const item = state.scriptHistory.find(s => s.id === scriptId);
      if (item) {
        let fullScriptText = `【🎬 AI 分镜头剧本: ${item.title}】\n`;
        item.shots.forEach(s => {
          fullScriptText += `\n${s.shotNum} [${s.shotType}]\n🎥 画面: ${s.visual}\n🗣️ 台词: ${s.dialogue}\n🔄 运镜: ${s.motion}\n`;
        });
        closeScriptHistoryModal();
        syncChatGenerationMode('video');
        switchView('videoGen');
        el.aiChatTextarea.value = fullScriptText;
        el.aiChatTextarea.focus();
        showToast('⚡ 已将历史剧本一键应用至 AI 视频创作对话框！');
      }
    });
  });

  container.querySelectorAll('.btn-del-hist-script').forEach(btn => {
    btn.addEventListener('click', () => {
      const scriptId = btn.dataset.id;
      state.scriptHistory = state.scriptHistory.filter(s => s.id !== scriptId);
      localStorage.setItem('vkb_script_history', JSON.stringify(state.scriptHistory));
      renderScriptHistoryListUI();
      showToast('已从历史记录中删除该剧本');
    });
  });
}


// 全局委派：确保点击 📜 历史剧本库 无论何时都能 100% 打开与关闭弹窗
document.addEventListener('click', (e) => {
  const openBtn = e.target.closest('#btnOpenScriptHistoryModal');
  if (openBtn) {
    e.preventDefault();
    openScriptHistoryModal();
    return;
  }

  const closeBtn = e.target.closest('#btnCloseScriptHistoryModal');
  if (closeBtn) {
    e.preventDefault();
    closeScriptHistoryModal();
    return;
  }
});

// 全局委派：画布 @ 引用悬停预览
document.addEventListener('mouseover', (e) => {
  const mention = e.target.closest('.canvas-mention');
  if (!mention) return;
  const nodeId = mention.dataset.nodeId;
  if (!nodeId) return;
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (node) showCanvasMentionTooltip(node, mention);
});
document.addEventListener('mouseout', (e) => {
  const mention = e.target.closest('.canvas-mention');
  if (!mention) return;
  const related = e.relatedTarget;
  if (related && (mention.contains(related) || related.closest('.canvas-mention-tooltip'))) return;
  hideCanvasMentionTooltip();
});











/* ==========================================================================
   🎨 画布模式 (Canvas Engine) 终极磐石闭环引擎 (20 项全量 API 完整保留)
   ========================================================================== */

let canvasState = {
  selectedConnectionIds: [],
  savedLibrary: JSON.parse(localStorage.getItem('vkb_canvas_library') || '[]'),
  nodes: [],
  connections: [],
  activeDrawerTab: 'assets',
  selectedNodeIds: [],
  selectedPort: null,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  openInputNodeId: null,
  inputHover: null
};

let canvasBulkStartPlan = null;

let isSpacePressed = false;

// 端口拖拽橡皮筋连线全局状态
let lineDragState = {
  isDragging: false,
  fromNodeId: null,
  fromPortType: null,
  startX: 0,
  startY: 0
};

// 预设模板工作流数据

// 计算当前屏幕视口中心
function getCanvasViewportCenterPos() {
  const workspace = document.getElementById('canvasWorkspace');
  if (!workspace) return { x: 200, y: 150 };

  const rect = workspace.getBoundingClientRect();
  const zoom = canvasState.zoom || 1.0;
  const panX = canvasState.panX || 0;
  const panY = canvasState.panY || 0;

  const w = rect.width > 0 ? rect.width : window.innerWidth;
  const h = rect.height > 0 ? rect.height : (window.innerHeight - 70);

  const centerX = ((w / 2) - panX) / zoom;
  const centerY = ((h / 2) - panY) / zoom;

  return {
    x: Math.round(isNaN(centerX) ? 200 : centerX - 150),
    y: Math.round(isNaN(centerY) ? 150 : centerY - 80)
  };
}
window.getCanvasViewportCenterPos = getCanvasViewportCenterPos;

// 初始化画布
function initCanvasEngine() {
  initAssetAndPromptData();
  if (!SessionSystem.isInitialized()) loadCanvasState();
  bindCanvasWorkspaceZoomAndPan();
  bindCanvasWorkspaceFileDrop();

  // 1. 浮动控制条按键事件 (适应画板、放大、缩小)
  const btnReset = document.getElementById('btnCanvasResetZoom');
  if (btnReset) {
    btnReset.onclick = (e) => {
      e.stopPropagation();
      autoFitCanvasToViewport();
      showToast('🎯 视口已成功适应画面节点', 'info');
    };
  }

  const btnBulkStart = document.getElementById('btnCanvasBulkStart');
  if (btnBulkStart) {
    btnBulkStart.onclick = (e) => {
      e.stopPropagation();
      openCanvasBulkStartConfirm();
    };
  }

  const btnZoomIn = document.getElementById('btnCanvasZoomIn');
  if (btnZoomIn) {
    btnZoomIn.onclick = (e) => {
      e.stopPropagation();
      updateZoom(0.1);
    };
  }

  const btnZoomOut = document.getElementById('btnCanvasZoomOut');
  if (btnZoomOut) {
    btnZoomOut.onclick = (e) => {
      e.stopPropagation();
      updateZoom(-0.1);
    };
  }

  // 2. 节点添加按钮直接绑定事件
  const btnAddText = document.getElementById('btnCanvasAddTextNode');
  if (btnAddText) {
    btnAddText.onclick = (e) => {
      e.stopPropagation();
      const center = getCanvasViewportCenterPos();
      addCanvasNode({
        id: 'node_text_' + Date.now(),
        type: 'text',
        x: center.x,
        y: center.y,
        title: '📝 提示词节点',
        content: '描述您想要生成的视频画面...'
      });
      showToast('已在视角中心添加提示词节点', 'success');
    };
  }

  const btnAddAsset = document.getElementById('btnCanvasAddAssetNode');
  if (btnAddAsset) {
    btnAddAsset.onclick = (e) => {
      e.stopPropagation();
      const center = getCanvasViewportCenterPos();
      addCanvasNode({
        id: 'node_asset_' + Date.now(),
        type: 'asset',
        x: center.x,
        y: center.y,
        title: '🖼️ 参考图节点',
        assetName: '自定义参考图',
        imgUrl: ''
      });
      showToast('已在视角中心添加参考图节点', 'success');
    };
  }

  const btnAddVideo = document.getElementById('btnCanvasAddVideoNode');
  if (btnAddVideo) {
    btnAddVideo.onclick = (e) => {
      e.stopPropagation();
      const center = getCanvasViewportCenterPos();
      addCanvasNode({
        id: 'node_video_' + Date.now(),
        type: 'video',
        x: center.x + 80,
        y: center.y,
        title: '🎬 AI 视频生成节点',
        model: getPreferredServerModel('canvas', 'video') || DEFAULT_VIDEO_MODEL,
        aspect: '16:9',
        duration: 15,
        videoUrl: null,
        status: 'idle'
      });
      showToast('已在视角中心添加视频生成节点', 'success');
    };
  }

  // 3. 清空、保存、导出、导入按钮绑定
  const btnClear = document.getElementById('btnCanvasClear');
  if (btnClear) {
    btnClear.onclick = (e) => {
      if (e) e.stopPropagation();
      openClearCanvasConfirmModal();
    };
  }

  const btnSave = document.getElementById('btnCanvasSave');
  if (btnSave) {
    btnSave.onclick = (e) => {
      if (e) e.stopPropagation();
      openSaveCanvasLibraryModal();
    };
  }

  const btnExport = document.getElementById('btnCanvasExport');
  if (btnExport) {
    btnExport.onclick = (e) => {
      e.stopPropagation();
      exportCanvasToFile();
    };
  }

  const btnImport = document.getElementById('btnCanvasImport');
  if (btnImport) {
    btnImport.onclick = (e) => {
      e.stopPropagation();
      openImportCanvasModal();
    };
  }

  renderCanvasDrawer();
  renderCanvasNodesAndLines();
  updateCanvasBulkStartButton();
  autoFitCanvasToViewport();

  const drawer = document.getElementById('canvasDrawer');
  if (drawer) drawer.classList.add('closed');
}
window.initCanvasEngine = initCanvasEngine;

function loadCanvasState() {
  const saved = localStorage.getItem('vkb_canvas_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      canvasState.nodes = parsed.nodes || [];
      canvasState.connections = parsed.connections || [];
      canvasState.zoom = parsed.zoom || 1.0;
      canvasState.panX = parsed.panX || 0;
      canvasState.panY = parsed.panY || 0;
      syncAllCanvasInputSelections(false);
    } catch (e) {
      console.error('Failed to parse canvas state:', e);
      loadPresetCanvasNodes();
    }
  } else {
    loadPresetCanvasNodes();
  }
}

function saveCanvasState() {
  syncAllCanvasInputSelections(false);
  if (SessionSystem.isInitialized() && !SessionSystem.isApplying()) SessionSystem.scheduleSave();
  localStorage.setItem('vkb_canvas_state', JSON.stringify({
    nodes: canvasState.nodes,
    connections: canvasState.connections,
    zoom: canvasState.zoom,
    panX: canvasState.panX,
    panY: canvasState.panY
  }));

  if (state.activeCanvasProjectId && state.canvasProjects) {
    const proj = state.canvasProjects.find(p => p.id === state.activeCanvasProjectId);
    if (proj) {
      proj.nodes = canvasState.nodes;
      proj.connections = canvasState.connections;
      proj.updatedAt = Date.now();
      saveCanvasProjects();
    }
  }
}

function loadPresetCanvasNodes() {
  const defaultImg = (state.assets && state.assets[0]) ? state.assets[0].imageUrl : 'assets/logo_brand.png';
  const defaultAssetName = (state.assets && state.assets[0]) ? state.assets[0].name : '熊主任';

  canvasState.nodes = [
    {
      id: 'node_text_1',
      type: 'text',
      x: 60,
      y: 80,
      title: '📝 提示词节点',
      content: '一条具有赛博朋克光芒的巨鲸在星海泛舟，电影级8K画质，4K超高清细腻微距摄影'
    },
    {
      id: 'node_asset_1',
      type: 'asset',
      x: 60,
      y: 280,
      title: '🖼️ 参考图节点',
      assetName: defaultAssetName,
      imgUrl: defaultImg
    },
    {
      id: 'node_video_1',
      type: 'video',
      x: 480,
      y: 120,
      title: '🎬 AI 视频生成节点',
      model: getPreferredServerModel('canvas', 'video') || DEFAULT_VIDEO_MODEL,
      aspect: '16:9',
      duration: 15,
      videoUrl: null,
      status: 'idle'
    }
  ];

  canvasState.connections = [
    { fromId: 'node_text_1', toId: 'node_video_1' },
    { fromId: 'node_asset_1', toId: 'node_video_1' }
  ];
  canvasState.zoom = 1.0;
  canvasState.panX = 0;
  canvasState.panY = 0;
}

function getCanvasUpstreamLevels(targetNodeId) {
  const reverse = new Map();
  (canvasState.connections || []).forEach(connection => {
    if (!reverse.has(connection.toId)) reverse.set(connection.toId, []);
    reverse.get(connection.toId).push(connection.fromId);
  });

  const distanceById = new Map([[targetNodeId, 0]]);
  const queue = [targetNodeId];
  while (queue.length) {
    const currentId = queue.shift();
    const currentDistance = distanceById.get(currentId) || 0;
    (reverse.get(currentId) || []).forEach(sourceId => {
      if (!canvasState.nodes.some(node => node.id === sourceId)) return;
      if (sourceId === targetNodeId || distanceById.has(sourceId)) return;
      distanceById.set(sourceId, currentDistance + 1);
      queue.push(sourceId);
    });
  }

  const levels = new Map();
  distanceById.forEach((distance, nodeId) => {
    if (distance === 0) return;
    if (!levels.has(distance)) levels.set(distance, []);
    levels.get(distance).push(nodeId);
  });
  levels.forEach(ids => ids.sort((a, b) => {
    const aIndex = canvasState.nodes.findIndex(node => node.id === a);
    const bIndex = canvasState.nodes.findIndex(node => node.id === b);
    return aIndex - bIndex;
  }));
  return [...levels.entries()].sort((a, b) => a[0] - b[0]);
}

function syncCanvasNodeInputSelection(nodeId, persist = true) {
  const node = canvasState.nodes.find(item => item.id === nodeId);
  if (!node) return false;
  const levels = getCanvasUpstreamLevels(nodeId);
  const ancestorIds = new Set(levels.flatMap(([, ids]) => ids));
  const directIds = (canvasState.connections || [])
    .filter(connection => connection.toId === nodeId && ancestorIds.has(connection.fromId))
    .map(connection => connection.fromId);
  const previous = node.inputSelection || {};
  const previousKnownDirect = new Set(Array.isArray(previous.knownDirectParentIds) ? previous.knownDirectParentIds : []);
  const currentSelected = Array.isArray(previous.selectedIds) ? previous.selectedIds : [];
  const selectedIds = previous.initialized
    ? currentSelected.filter(id => ancestorIds.has(id))
    : [...directIds];
  if (previous.initialized) {
    directIds.forEach(id => {
      if (!previousKnownDirect.has(id) && !selectedIds.includes(id)) selectedIds.push(id);
    });
  }
  const next = {
    initialized: true,
    selectedIds,
    knownDirectParentIds: [...new Set(directIds)]
  };
  const changed = JSON.stringify(previous) !== JSON.stringify(next);
  node.inputSelection = next;
  if (changed && persist) saveCanvasState();
  return changed;
}

function syncAllCanvasInputSelections(persist = true) {
  let changed = false;
  canvasState.nodes.forEach(node => {
    changed = syncCanvasNodeInputSelection(node.id, false) || changed;
  });
  if (changed && persist) saveCanvasState();
  return changed;
}

function getSelectedCanvasInputNodes(nodeId) {
  syncCanvasNodeInputSelection(nodeId, false);
  const node = canvasState.nodes.find(item => item.id === nodeId);
  if (!node) return [];
  const selected = new Set(node.inputSelection?.selectedIds || []);
  return getCanvasUpstreamLevels(nodeId)
    .flatMap(([, ids]) => ids)
    .filter(id => selected.has(id))
    .map(id => canvasState.nodes.find(item => item.id === id))
    .filter(Boolean);
}

function getCanvasConnectionId(connection) {
  return `${connection.fromId}__${connection.toId}`;
}

function getCanvasSelectedRelationConnectionIds() {
  const connections = canvasState.connections || [];
  const selectedNodeIds = new Set(canvasState.selectedNodeIds || []);
  const highlightedConnectionIds = new Set();
  if (selectedNodeIds.size === 0) return highlightedConnectionIds;

  // 左侧输入：沿反向连接递归，点亮选中节点的全部上游链路。
  const visitedUpstreamNodeIds = new Set(selectedNodeIds);
  const upstreamQueue = [...selectedNodeIds];
  while (upstreamQueue.length) {
    const currentNodeId = upstreamQueue.shift();
    connections.forEach(connection => {
      if (connection.toId !== currentNodeId) return;
      highlightedConnectionIds.add(getCanvasConnectionId(connection));
      if (!visitedUpstreamNodeIds.has(connection.fromId)) {
        visitedUpstreamNodeIds.add(connection.fromId);
        upstreamQueue.push(connection.fromId);
      }
    });
  }

  // 右侧输出：只点亮从选中节点直接连出的第一级连接。
  connections.forEach(connection => {
    if (selectedNodeIds.has(connection.fromId)) {
      highlightedConnectionIds.add(getCanvasConnectionId(connection));
    }
  });
  return highlightedConnectionIds;
}

function clearCanvasInputHover() {
  canvasState.inputHover = null;
  document.querySelectorAll('.input-source-highlight, .input-path-node-highlight').forEach(element => {
    element.classList.remove('input-source-highlight', 'input-path-node-highlight');
  });
  document.querySelectorAll('#canvasSvgLayer .input-path-highlight').forEach(element => {
    element.classList.remove('input-path-highlight');
  });
  drawCanvasLines();
}

function highlightCanvasInputPath(sourceNodeId, targetNodeId) {
  const forward = new Set([sourceNodeId]);
  const forwardQueue = [sourceNodeId];
  while (forwardQueue.length) {
    const current = forwardQueue.shift();
    (canvasState.connections || []).filter(connection => connection.fromId === current).forEach(connection => {
      if (!forward.has(connection.toId)) {
        forward.add(connection.toId);
        forwardQueue.push(connection.toId);
      }
    });
  }

  const backward = new Set([targetNodeId]);
  const backwardQueue = [targetNodeId];
  while (backwardQueue.length) {
    const current = backwardQueue.shift();
    (canvasState.connections || []).filter(connection => connection.toId === current).forEach(connection => {
      if (!backward.has(connection.fromId)) {
        backward.add(connection.fromId);
        backwardQueue.push(connection.fromId);
      }
    });
  }

  const pathConnections = (canvasState.connections || []).filter(connection =>
    forward.has(connection.fromId) && backward.has(connection.toId)
  );
  const pathNodeIds = new Set([sourceNodeId, targetNodeId]);
  pathConnections.forEach(connection => {
    pathNodeIds.add(connection.fromId);
    pathNodeIds.add(connection.toId);
  });
  canvasState.inputHover = { sourceNodeId, targetNodeId, pathNodeIds, pathConnections };
  document.querySelectorAll('.input-source-highlight, .input-path-node-highlight').forEach(element => {
    element.classList.remove('input-source-highlight', 'input-path-node-highlight');
  });
  pathNodeIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.classList.add(id === sourceNodeId ? 'input-source-highlight' : 'input-path-node-highlight');
  });
  drawCanvasLines();
}

function toggleCanvasInputPanel(nodeId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  canvasState.openInputNodeId = canvasState.openInputNodeId === nodeId ? null : nodeId;
  canvasState.inputHover = null;
  renderCanvasNodesAndLines();
}
window.toggleCanvasInputPanel = toggleCanvasInputPanel;

function setCanvasNodeInputChecked(nodeId, sourceNodeId, checked, event) {
  if (event) event.stopPropagation();
  const node = canvasState.nodes.find(item => item.id === nodeId);
  if (!node) return;
  syncCanvasNodeInputSelection(nodeId, false);
  const selectedIds = new Set(node.inputSelection.selectedIds || []);
  if (checked) selectedIds.add(sourceNodeId);
  else selectedIds.delete(sourceNodeId);
  node.inputSelection.selectedIds = [...selectedIds];
  canvasState.inputHover = null;
  saveCanvasState();
  renderCanvasNodesAndLines();
}
window.setCanvasNodeInputChecked = setCanvasNodeInputChecked;

window.clearCanvasInputHover = clearCanvasInputHover;
window.highlightCanvasInputPath = highlightCanvasInputPath;

function renderCanvasInputControl(node) {
  const levels = getCanvasUpstreamLevels(node.id);
  const selectedIds = new Set(node.inputSelection?.selectedIds || []);
  const total = levels.reduce((count, [, ids]) => count + ids.length, 0);
  const selectedCount = [...selectedIds].filter(id => levels.some(([, ids]) => ids.includes(id))).length;
  const isOpen = canvasState.openInputNodeId === node.id;
  const groups = levels.map(([level, ids]) => `
    <div class="canvas-input-level">
      <div class="canvas-input-level-title">第 ${level} 层${level === 1 ? '（直接连接）' : ''}</div>
      ${ids.map(sourceId => {
        const source = canvasState.nodes.find(item => item.id === sourceId);
        const sourceTitle = (source?.title || source?.assetName || '未命名节点').replace(/^[🤖📝🖼️🎬🎧\s]+/, '');
        const sourceType = source?.type === 'text' ? '提示词' : source?.type === 'asset' ? '图片' : source?.type === 'video' ? '视频' : source?.type === 'audio' ? '音频' : '智能体';
        return `<label class="canvas-input-item" data-source-node-id="${sourceId}" data-target-node-id="${node.id}" onmouseenter="highlightCanvasInputPath('${sourceId}', '${node.id}')" onmouseleave="clearCanvasInputHover()">
          <input type="checkbox" ${selectedIds.has(sourceId) ? 'checked' : ''} onchange="setCanvasNodeInputChecked('${node.id}', '${sourceId}', this.checked, event)">
          <span class="canvas-input-item-main"><strong>${escapeHTML(sourceTitle)}</strong><small>${sourceType}</small></span>
        </label>`;
      }).join('')}
    </div>
  `).join('');
  return `
    <div class="canvas-input-control" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onwheel="event.stopPropagation()">
      <button type="button" class="canvas-input-toggle ${isOpen ? 'active' : ''}" onclick="toggleCanvasInputPanel('${node.id}', event)" title="查看并选择上游输入">
        <span>输入</span><em>${selectedCount}/${total}</em>
      </button>
      ${isOpen ? `<div class="canvas-input-panel"><div class="canvas-input-panel-head"><strong>节点输入</strong><span>${selectedCount} 项已选</span></div>${total ? groups : '<div class="canvas-input-empty">暂无上游节点</div>'}</div>` : ''}
    </div>
  `;
}

function renderCanvasSelectedInputChips(node) {
  const selectedInputs = getSelectedCanvasInputNodes(node.id);
  if (!selectedInputs.length) return '';
  const chips = selectedInputs.map(source => {
    const title = (source.title || source.assetName || '未命名节点').replace(/^[🤖📝🖼️🎬🎧\s]+/, '') || '未命名节点';
    const isImage = source.type === 'asset';
    const isVideo = source.type === 'video';
    const isAudio = source.type === 'audio';
    const imageSource = isImage ? getCanvasNodeImageSources(source)[0] : '';
    const videoSource = isVideo ? getCanvasNodeVideoSources(source)[0] : '';
    const audioSource = isAudio ? getCanvasNodeAudioSources(source)[0] : '';
    const canMention = !!(imageSource || videoSource || audioSource);
    const typeLabel = source.type === 'text' ? '文本' : source.type === 'agent' ? '智能体' : isImage ? '图片' : isVideo ? '视频' : '音频';
    const mediaPreview = imageSource
      ? `<img src="${escapeHTML(imageSource)}" alt="" />`
      : videoSource
        ? `<video data-lazy-video-src="${escapeHTML(videoSource)}" data-lazy-video-release="auto" muted playsinline preload="none" draggable="false" ondragstart="event.preventDefault(); event.stopPropagation();"></video><span class="canvas-selected-input-play">▶</span>`
        : audioSource
          ? '<span class="canvas-selected-input-fallback canvas-audio-reference">♫</span>'
          : `<span class="canvas-selected-input-fallback">${source.type === 'agent' ? '🤖' : source.type === 'text' ? '▤' : isImage ? '▧' : '▶'}</span>`;
    const hint = canMention ? `点击在光标位置 @ 引用${typeLabel}` : `${typeLabel}将自动加入上下文，不支持 @`;
    if (canMention) {
      return `<div class="canvas-selected-input-chip is-mentionable is-media-only" data-source-node-id="${escapeHTML(source.id)}" title="${escapeHTML(hint)}">
        <button type="button" class="canvas-selected-input-media-action" onmousedown="rememberCanvasEditorSelection('${node.id}'); event.preventDefault(); event.stopPropagation();" onclick="insertCanvasSelectedInputMention('${node.id}', '${source.id}', event)" aria-label="${escapeHTML(hint)}">
          <span class="canvas-selected-input-preview">${mediaPreview}</span>
        </button>
        <button type="button" class="canvas-selected-input-remove" onclick="setCanvasNodeInputChecked('${node.id}', '${source.id}', false, event)" title="移除此输入" aria-label="移除此输入">×</button>
      </div>`;
    }
    return `<div class="canvas-selected-input-chip is-context-only" data-source-node-id="${escapeHTML(source.id)}" title="${escapeHTML(hint)}">
      <span class="canvas-selected-input-preview">${mediaPreview}</span>
      <span class="canvas-selected-input-copy"><strong>${escapeHTML(title)}</strong><small>${typeLabel} · 自动输入</small></span>
    </div>`;
  }).join('');
  return `<div class="canvas-selected-inputs" aria-label="已选节点输入">${chips}</div>`;
}

// 自动适应视口 (精准计算所有节点包围盒)
function autoFitCanvasToViewport() {
  if (!canvasState.nodes || canvasState.nodes.length === 0) {
    canvasState.zoom = 1.0;
    canvasState.panX = 0;
    canvasState.panY = 0;
    applyCanvasTransform();
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  canvasState.nodes.forEach(n => {
    const w = n.width || ((n.type === 'video') ? 330 : 300);
    const h = n.height || 160;
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + w > maxX) maxX = n.x + w;
    if (n.y + h > maxY) maxY = n.y + h;
  });

  const workspace = document.getElementById('canvasWorkspace');
  if (!workspace) return;
  const rect = workspace.getBoundingClientRect();

  const contentW = maxX - minX + 140;
  const contentH = maxY - minY + 140;

  const scaleX = rect.width / contentW;
  const scaleY = rect.height / contentH;
  let fitZoom = Math.min(scaleX, scaleY, 1.0);
  fitZoom = Math.max(fitZoom, 0.4);
  fitZoom = Math.round(fitZoom * 10) / 10;

  canvasState.zoom = fitZoom;
  canvasState.panX = Math.round((rect.width - (maxX + minX) * fitZoom) / 2);
  canvasState.panY = Math.round((rect.height - (maxY + minY) * fitZoom) / 2);

  applyCanvasTransform();
  saveCanvasState();
}
window.autoFitCanvasToViewport = autoFitCanvasToViewport;

function updateZoom(deltaZoom = 0, reset = false) {
  if (reset) {
    autoFitCanvasToViewport();
  } else {
    let newZoom = canvasState.zoom + deltaZoom;
    newZoom = Math.min(Math.max(newZoom, 0.3), 2.5);
    canvasState.zoom = Math.round(newZoom * 10) / 10;
    applyCanvasTransform();
  }
}
window.updateZoom = updateZoom;

function applyCanvasTransform() {
  const container = document.getElementById('canvasNodesContainer');
  const svgLayer = document.getElementById('canvasSvgLayer');
  const zoomText = document.getElementById('canvasZoomText');

  const transformStr = `translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${canvasState.zoom})`;
  if (container) container.style.transform = transformStr;
  if (svgLayer) svgLayer.style.transform = transformStr;
  if (zoomText) zoomText.textContent = `${Math.round(canvasState.zoom * 100)}%`;
}

// 测量并精确计算节点端口的物理中心坐标 (实时换算消除 8px translateY 偏差与缩放平移偏离)
// 测量并精确计算节点端口的物理中心坐标 (实时换算消除 8px translateY 偏差与缩放平移偏离)
function getPortCanvasPos(nodeId, portType) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (!node) return { x: 0, y: 0 };

  const nodeEl = document.getElementById(nodeId);
  if (nodeEl) {
    const portEl = nodeEl.querySelector(`.canvas-port.${portType}`);
    if (portEl) {
      const nRect = nodeEl.getBoundingClientRect();
      const pRect = portEl.getBoundingClientRect();
      const zoom = canvasState.zoom || 1.0;

      // 计算圆点物理几何中心相对卡片左上角的未缩放 Canvas 坐标
      const relX = (pRect.left + (pRect.width / 2) - nRect.left) / zoom;
      const relY = (pRect.top + (pRect.height / 2) - nRect.top) / zoom;

      return {
        x: Math.round(node.x + relX),
        y: Math.round(node.y + relY)
      };
    }
  }

  const width = nodeEl ? nodeEl.offsetWidth : ((node.type === 'video') ? 330 : 300);
  const height = nodeEl ? nodeEl.offsetHeight : 150;
  return {
    x: (portType === 'output') ? (node.x + width) : node.x,
    y: Math.round(node.y + (height / 2))
  };
}
window.getPortCanvasPos = getPortCanvasPos;

let canvasLineDrawFrame = 0;
let lastCanvasConnectionSyncSignature = '';

// 实际绘制 SVG 连线。拖动/缩放期间由 drawCanvasLines 合并到每个动画帧至多执行一次。
function renderCanvasLinesNow() {
  const svgLayer = document.getElementById('canvasSvgLayer');
  if (!svgLayer) return;

  const nodeIds = new Set(canvasState.nodes.map(node => node.id));
  canvasState.connections = canvasState.connections.filter(connection => nodeIds.has(connection.fromId) && nodeIds.has(connection.toId));
  const connectionSignature = canvasState.connections.map(getCanvasConnectionId).join('|');
  if (connectionSignature !== lastCanvasConnectionSyncSignature) {
    lastCanvasConnectionSyncSignature = connectionSignature;
    syncAllCanvasInputSelections(false);
  }
  const selectedRelationConnectionIds = getCanvasSelectedRelationConnectionIds();
  const portPositionCache = new Map();
  const readPortPosition = (nodeId, portType) => {
    const key = `${nodeId}:${portType}`;
    if (!portPositionCache.has(key)) portPositionCache.set(key, getPortCanvasPos(nodeId, portType));
    return portPositionCache.get(key);
  };

  const linesHtml = canvasState.connections.map(conn => {
    const fromPos = readPortPosition(conn.fromId, 'output');
    const toPos = readPortPosition(conn.toId, 'input');
    if (!fromPos || !toPos || (fromPos.x === 0 && fromPos.y === 0) || (toPos.x === 0 && toPos.y === 0)) return '';

    const x1 = fromPos.x;
    const y1 = fromPos.y;
    const x2 = toPos.x;
    const y2 = toPos.y;

    const dx = Math.min(160, Math.max(40, Math.abs(x2 - x1) * 0.5));
    const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

    const destNode = canvasState.nodes.find(n => n.id === conn.toId);
    const isGeneratingFlow = destNode && ['submitting', 'generating'].includes(destNode.status);

    const connId = `${conn.fromId}__${conn.toId}`;
    const isSelectedConn = canvasState.selectedConnectionIds && canvasState.selectedConnectionIds.includes(connId);

    let lineClass = "canvas-svg-line";
    if (isSelectedConn) {
      lineClass = "canvas-svg-line selected-conn";
    } else if (isGeneratingFlow) {
      lineClass = "canvas-svg-line generating-flow";
    }
    if (selectedRelationConnectionIds.has(connId)) {
      lineClass += " node-relation-highlight";
    }
    if (canvasState.inputHover?.pathConnections?.some(connection => getCanvasConnectionId(connection) === connId)) {
      lineClass += " input-path-highlight";
    }

    return `
      <path d="${pathD}" class="canvas-svg-hit-path" data-connection-id="${connId}" onmousedown="event.stopPropagation()" onclick="selectCanvasConnection('${conn.fromId}', '${conn.toId}', event)" title="点击选中此连线 (按 Delete 键删除)" />
      <path d="${pathD}" class="${lineClass}" data-connection-id="${connId}" style="pointer-events: none;" />
    `;
  }).join('');

  svgLayer.innerHTML = `
    <defs>
      <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#2563eb" />
        <stop offset="100%" stop-color="#3b82f6" />
      </linearGradient>
    </defs>
    ${linesHtml}
  `;
}

function drawCanvasLines(options = {}) {
  if (options.immediate) {
    if (canvasLineDrawFrame) cancelAnimationFrame(canvasLineDrawFrame);
    canvasLineDrawFrame = 0;
    renderCanvasLinesNow();
    return;
  }
  if (canvasLineDrawFrame) return;
  canvasLineDrawFrame = requestAnimationFrame(() => {
    canvasLineDrawFrame = 0;
    renderCanvasLinesNow();
  });
}
window.drawCanvasLines = drawCanvasLines;

// 框选与选中多节点 (选中时自动触发 UI 重新渲染以展现 4角 Resize 控点与关联连线动态虚线)
// 框选与选中多节点 (选中时自动触发 UI 重新渲染以展现 4角 Resize 控点与关联连线动态虚线)
function selectCanvasNodes(nodeIds = []) {
  const prevStr = JSON.stringify(canvasState.selectedNodeIds);
  const hadSelectedConnections = Array.isArray(canvasState.selectedConnectionIds) && canvasState.selectedConnectionIds.length > 0;
  canvasState.selectedNodeIds = nodeIds;
  canvasState.selectedConnectionIds = [];
  const newStr = JSON.stringify(nodeIds);

  // 选中节点改变时重新渲染节点与连线
  if (prevStr !== newStr || hadSelectedConnections) {
    renderCanvasNodesAndLines();
  }
}
window.selectCanvasNodes = selectCanvasNodes;

function selectCanvasNode(nodeId) {
  if (!nodeId) {
    selectCanvasNodes([]);
  } else {
    selectCanvasNodes([nodeId]);
  }
}
window.selectCanvasNode = selectCanvasNode;

function getUniqueCanvasNodeTitle(baseTitle, options = {}) {
  const { isCopy = false } = options;
  const title = (baseTitle || '未命名节点').trim() || '未命名节点';
  const existingTitles = new Set(canvasState.nodes.map(n => (n.title || '').trim()));
  if (!existingTitles.has(title)) return title;
  if (isCopy) {
    let n = 1;
    while (existingTitles.has(`${title}-副本${n}`)) n++;
    return `${title}-副本${n}`;
  } else {
    let n = 1;
    while (existingTitles.has(`${title}${n}`)) n++;
    return `${title}${n}`;
  }
}
window.getUniqueCanvasNodeTitle = getUniqueCanvasNodeTitle;

// 新增节点
function addCanvasNode(node) {
  pushCanvasUndoState();
  if (node.type === 'text' && !node.model) node.model = getPreferredServerModel('canvas', 'llm');
  if (node.type === 'asset' && !node.model) node.model = getPreferredServerModel('canvas', 'image');
  if (node.type === 'video' && !node.model) node.model = getPreferredServerModel('canvas', 'video');
  if (node.title) {
    node.title = getUniqueCanvasNodeTitle(node.title, { isCopy: false });
  }
  canvasState.nodes.push(node);
  saveCanvasState();
  renderCanvasNodesAndLines();
  selectCanvasNode(node.id);
}
window.addCanvasNode = addCanvasNode;

// 删除节点
function removeCanvasNode(nodeId) {
  if (!nodeId) return;
  releaseCanvasLocalMediaUrls(canvasState.nodes.filter(node => node.id === nodeId));
  canvasState.nodes = canvasState.nodes.filter(n => n.id !== nodeId);
  canvasState.connections = canvasState.connections.filter(c => c.fromId !== nodeId && c.toId !== nodeId);
  canvasState.selectedNodeIds = canvasState.selectedNodeIds.filter(id => id !== nodeId);
  saveCanvasState();
  renderCanvasNodesAndLines();
}
window.removeCanvasNode = removeCanvasNode;

function removeSelectedCanvasNodes() {
  if (!canvasState.selectedNodeIds || canvasState.selectedNodeIds.length === 0) return;
  const count = canvasState.selectedNodeIds.length;
  releaseCanvasLocalMediaUrls(canvasState.nodes.filter(node => canvasState.selectedNodeIds.includes(node.id)));
  canvasState.nodes = canvasState.nodes.filter(n => !canvasState.selectedNodeIds.includes(n.id));
  canvasState.connections = canvasState.connections.filter(c => 
    !canvasState.selectedNodeIds.includes(c.fromId) && !canvasState.selectedNodeIds.includes(c.toId)
  );
  canvasState.selectedNodeIds = [];
  saveCanvasState();
  renderCanvasNodesAndLines();
  showToast(`🗑️ 已批量删除 ${count} 个选中节点`, 'info');
}
window.removeSelectedCanvasNodes = removeSelectedCanvasNodes;

function removeCanvasConnection(fromId, toId) {
  canvasState.connections = canvasState.connections.filter(c => !(c.fromId === fromId && c.toId === toId));
  saveCanvasState();
  renderCanvasNodesAndLines();
  showToast('✂️ 已断开连线', 'info');
}
window.removeCanvasConnection = removeCanvasConnection;

function updateCanvasNodeContent(nodeId, newContent) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (node) {
    node.content = newContent;
    // 手动修改编辑框时同步保存为 rawContent，作为【重新优化】的基础
    node.rawContent = newContent;
    saveCanvasState();
  }
}
window.updateCanvasNodeContent = updateCanvasNodeContent;

function triggerCanvasNodeUpload(nodeId) {
  const node = canvasState.nodes.find(item => item.id === nodeId);
  if (node && ['submitting', 'generating'].includes(node.status)) {
    showToast('当前节点正在生成，请等待任务完成后再上传', 'info');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleCanvasNodeImageFile(nodeId, e.target.files[0]);
    }
  };
  input.click();
}
window.triggerCanvasNodeUpload = triggerCanvasNodeUpload;

function triggerCanvasAudioNodeUpload(nodeId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.onchange = event => {
    const file = event.target.files?.[0];
    if (file) void handleCanvasNodeAudioFile(nodeId, file);
  };
  input.click();
}
window.triggerCanvasAudioNodeUpload = triggerCanvasAudioNodeUpload;

async function handleCanvasNodeAudioFile(nodeId, file) {
  const node = canvasState.nodes.find(item => item.id === nodeId && item.type === 'audio');
  if (!node || !isCanvasAudioFile(file)) {
    showToast('请选择音频文件', 'warning');
    return;
  }
  node.status = 'uploading';
  node.uploadProgress = 0;
  node.errorMsg = '';
  renderCanvasNodesAndLines();
  try {
    const uploaded = await apiUploadMedia(file, progress => {
      node.uploadProgress = progress;
      const text = document.getElementById(`upload-progress-text-${nodeId}`);
      if (text) text.textContent = `上传中 ${progress}%`;
    });
    Object.assign(node, {
      audioUrl: uploaded.url,
      mediaReference: uploaded.reference || uploaded.url,
      mediaId: uploaded.id || null,
      assetName: file.name,
      title: `🎧 ${file.name}`,
      status: 'done',
      uploadProgress: 100
    });
    saveCanvasState();
    renderCanvasNodesAndLines();
    showToast('音频上传成功', 'success');
  } catch (error) {
    node.status = 'failed';
    node.errorMsg = error.message || '音频上传失败';
    renderCanvasNodesAndLines();
    showToast(`音频上传失败：${node.errorMsg}`, 'error');
  }
}
window.handleCanvasNodeAudioFile = handleCanvasNodeAudioFile;

async function handleCanvasNodeImageFile(nodeId, file) {
  const targetNode = canvasState.nodes.find(item => item.id === nodeId);
  if (targetNode && ['submitting', 'generating'].includes(targetNode.status)) {
    showToast('当前节点正在生成，暂时不能替换图片', 'info');
    return;
  }
  if (!isCanvasImageFile(file)) {
    showToast('请上传图片文件', 'warning');
    return;
  }
  try {
    const dimensionsPromise = readCanvasFileDimensions(file, 'image').catch(() => null);
    targetNode.status = 'uploading';
    targetNode.uploadProgress = 0;
    renderCanvasNodesAndLines();
    const uploaded = await apiUploadMedia(file, progress => {
      targetNode.uploadProgress = progress;
      const text = document.getElementById(`upload-progress-text-${nodeId}`);
      if (text) text.textContent = `上传中 ${progress}%`;
    });
    const node = canvasState.nodes.find(n => n.id === nodeId);
    if (node) {
      const dimensions = await dimensionsPromise;
      const displaySize = dimensions ? calculateCanvasMediaNodeSize(dimensions.width, dimensions.height) : null;
      node.imgUrl = uploaded.url;
      node.mediaReference = uploaded.reference || uploaded.url;
      node.mediaId = uploaded.id || null;
      node.assetName = file.name;
      node.status = 'done';
      node.uploadProgress = 100;
      if (dimensions && displaySize) {
        Object.assign(node, displaySize, {
          mediaWidth: dimensions.width,
          mediaHeight: dimensions.height,
          mediaAspectRatio: dimensions.width / dimensions.height,
          mediaAutoSized: true,
          mediaAutoSizePending: false
        });
      } else {
        node.mediaAutoSizePending = true;
      }
      saveCanvasState();
      renderCanvasNodesAndLines();
      showToast('已成功上传本地参考图片', 'success');
    }
  } catch (error) {
    targetNode.status = 'failed';
    targetNode.errorMsg = error.message || '图片上传失败';
    renderCanvasNodesAndLines();
    showToast(`图片上传失败：${targetNode.errorMsg}`, 'error');
  }
}
window.handleCanvasNodeImageFile = handleCanvasNodeImageFile;

function isCanvasImageFile(file) {
  return !!file && (String(file.type || '').startsWith('image/') || /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(file.name || ''));
}

function isCanvasVideoFile(file) {
  return !!file && (String(file.type || '').startsWith('video/') || /\.(?:avi|m4v|mkv|mov|mp4|mpeg|mpg|webm)$/i.test(file.name || ''));
}

function isCanvasAudioFile(file) {
  return !!file && (String(file.type || '').startsWith('audio/') || /\.(?:aac|aiff?|flac|m4a|mp3|ogg|opus|wav|wma)$/i.test(file.name || ''));
}

const canvasMediaDimensionLoads = new Map();

function calculateCanvasMediaNodeSize(mediaWidth, mediaHeight) {
  const width = Math.max(1, Number(mediaWidth) || 1);
  const height = Math.max(1, Number(mediaHeight) || 1);
  const scale = Math.min(1, 420 / width, 520 / height);
  return {
    width: Math.max(80, Math.round(width * scale)),
    height: Math.max(80, Math.round(height * scale))
  };
}
window.calculateCanvasMediaNodeSize = calculateCanvasMediaNodeSize;

function readCanvasMediaDimensions(source, mediaType) {
  return new Promise((resolve, reject) => {
    if (!source) return reject(new Error('缺少媒体地址'));
    let media;
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      if (!media) return;
      media.onload = null;
      media.onerror = null;
      media.onloadedmetadata = null;
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('读取媒体尺寸超时'));
    }, 15000);
    if (mediaType === 'video') {
      media = document.createElement('video');
      media.preload = 'metadata';
      media.muted = true;
      media.onloadedmetadata = () => {
        const dimensions = { width: media.videoWidth, height: media.videoHeight };
        cleanup();
        dimensions.width && dimensions.height ? resolve(dimensions) : reject(new Error('视频没有有效尺寸'));
      };
    } else {
      media = new Image();
      media.onload = () => {
        const dimensions = { width: media.naturalWidth, height: media.naturalHeight };
        cleanup();
        dimensions.width && dimensions.height ? resolve(dimensions) : reject(new Error('图片没有有效尺寸'));
      };
    }
    media.onerror = () => {
      cleanup();
      reject(new Error('无法读取媒体尺寸'));
    };
    media.src = source;
  });
}

async function readCanvasFileDimensions(file, mediaType) {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await readCanvasMediaDimensions(objectUrl, mediaType);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function autoSizeCanvasMediaNode(nodeId) {
  const node = canvasState.nodes.find(item => item.id === nodeId);
  const mediaType = node?.type === 'video' ? 'video' : 'image';
  const source = mediaType === 'video' ? node?.videoUrl : node?.imgUrl;
  if (!node?.mediaAutoSizePending || !source) return;
  const key = `${nodeId}:${source}`;
  if (canvasMediaDimensionLoads.has(key)) return canvasMediaDimensionLoads.get(key);
  const promise = readCanvasMediaDimensions(source, mediaType)
    .then(dimensions => {
      const currentNode = canvasState.nodes.find(item => item.id === nodeId);
      const currentSource = mediaType === 'video' ? currentNode?.videoUrl : currentNode?.imgUrl;
      if (!currentNode || currentSource !== source) return;
      Object.assign(currentNode, calculateCanvasMediaNodeSize(dimensions.width, dimensions.height), {
        mediaWidth: dimensions.width,
        mediaHeight: dimensions.height,
        mediaAspectRatio: dimensions.width / dimensions.height,
        mediaAutoSized: true,
        mediaAutoSizePending: false
      });
      if (mediaType === 'video') currentNode.aspect = dimensions.width < dimensions.height ? '9:16' : (dimensions.width === dimensions.height ? '1:1' : '16:9');
      saveCanvasState();
      renderCanvasNodesAndLines();
      drawCanvasLines();
    })
    .catch(error => {
      const currentNode = canvasState.nodes.find(item => item.id === nodeId);
      if (currentNode && (mediaType === 'video' ? currentNode.videoUrl : currentNode.imgUrl) === source) currentNode.mediaAutoSizePending = false;
      console.warn('画布媒体原始尺寸读取失败:', error);
    })
    .finally(() => canvasMediaDimensionLoads.delete(key));
  canvasMediaDimensionLoads.set(key, promise);
  return promise;
}

function scheduleCanvasMediaAutoSizing() {
  canvasState.nodes
    // Remote videos must remain completely dormant until the user presses play.
    // Reading their metadata here would still issue one request per restored node.
    .filter(node => node?.mediaAutoSizePending && node.type === 'asset' && node.imgUrl)
    .forEach(node => void autoSizeCanvasMediaNode(node.id));
}

function applyCanvasVideoElementDimensions(video) {
  if (!(video instanceof HTMLVideoElement) || !video.videoWidth || !video.videoHeight) return;
  const key = video.dataset.canvasVideoKey || '';
  const nodeId = key.startsWith('node:') ? key.slice(5) : '';
  const node = canvasState.nodes.find(item => item.id === nodeId);
  if (!node?.mediaAutoSizePending) return;
  Object.assign(node, calculateCanvasMediaNodeSize(video.videoWidth, video.videoHeight), {
    mediaWidth: video.videoWidth,
    mediaHeight: video.videoHeight,
    mediaAspectRatio: video.videoWidth / video.videoHeight,
    mediaAutoSized: true,
    mediaAutoSizePending: false,
    aspect: video.videoWidth < video.videoHeight ? '9:16' : (video.videoWidth === video.videoHeight ? '1:1' : '16:9')
  });
  const nodeElement = document.getElementById(nodeId);
  if (nodeElement) {
    nodeElement.style.width = `${node.width}px`;
    nodeElement.style.height = `${node.height}px`;
    nodeElement.classList.add('media-native-ratio');
  }
  saveCanvasState();
  drawCanvasLines();
}

function getCanvasDroppedMediaFiles(dataTransfer) {
  if (!dataTransfer) return [];
  const itemFiles = Array.from(dataTransfer.items || [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter(Boolean);
  const files = itemFiles.length ? itemFiles : Array.from(dataTransfer.files || []);
  return files.filter(file => isCanvasImageFile(file) || isCanvasVideoFile(file) || isCanvasAudioFile(file));
}

function canvasClientPointToNodePosition(clientX, clientY, width, height) {
  const workspace = document.getElementById('canvasWorkspace');
  if (!workspace) return getCanvasViewportCenterPos();
  const rect = workspace.getBoundingClientRect();
  const zoom = canvasState.zoom || 1;
  const canvasX = (clientX - rect.left - (canvasState.panX || 0)) / zoom;
  const canvasY = (clientY - rect.top - (canvasState.panY || 0)) / zoom;
  return {
    x: Math.round(canvasX - width / 2),
    y: Math.round(canvasY - height / 2)
  };
}
window.canvasClientPointToNodePosition = canvasClientPointToNodePosition;

function releaseCanvasLocalMediaUrls(nodes) {
  (nodes || []).forEach(node => {
    if (node?._localMediaObjectUrl && String(node._localMediaObjectUrl).startsWith('blob:')) {
      URL.revokeObjectURL(node._localMediaObjectUrl);
    }
  });
}

function rehydrateCanvasLocalMediaNodes(nodes) {
  (nodes || []).forEach(node => {
    if (node?.type !== 'video' || !(node.localMediaFile instanceof Blob)) return;
    const objectUrl = URL.createObjectURL(node.localMediaFile);
    node.videoUrl = objectUrl;
    node._localMediaObjectUrl = objectUrl;
  });
}

async function createCanvasNodeFromDroppedFile(file, clientX, clientY, offsetIndex = 0) {
  const mediaType = isCanvasVideoFile(file) ? 'video' : (isCanvasImageFile(file) ? 'image' : null);
  const dimensionsPromise = mediaType ? readCanvasFileDimensions(file, mediaType).catch(() => null) : Promise.resolve(null);
  const uploaded = await apiUploadMedia(file);
  if (isCanvasImageFile(file)) {
    const dimensions = await dimensionsPromise;
    const { width, height } = dimensions
      ? calculateCanvasMediaNodeSize(dimensions.width, dimensions.height)
      : { width: 300, height: 240 };
    const position = canvasClientPointToNodePosition(clientX, clientY, width, height);
    const node = {
      id: `node_asset_drop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'asset',
      x: position.x + offsetIndex * 24,
      y: position.y + offsetIndex * 24,
      width,
      height,
      title: `🖼️ ${file.name || '本地图片'}`,
      assetName: file.name || '本地图片',
      imgUrl: uploaded.url,
      mediaReference: uploaded.reference || uploaded.url,
      mediaId: uploaded.id || null,
      source: 'canvas-file-drop',
      status: 'done',
      mediaWidth: dimensions?.width || null,
      mediaHeight: dimensions?.height || null,
      mediaAspectRatio: dimensions ? dimensions.width / dimensions.height : null,
      mediaAutoSized: !!dimensions,
      mediaAutoSizePending: !dimensions
    };
    addCanvasNode(node);
    return node;
  }
  if (isCanvasVideoFile(file)) {
    const dimensions = await dimensionsPromise;
    const { width, height } = dimensions
      ? calculateCanvasMediaNodeSize(dimensions.width, dimensions.height)
      : { width: 330, height: 260 };
    const position = canvasClientPointToNodePosition(clientX, clientY, width, height);
    const node = {
      id: `node_video_drop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'video',
      x: position.x + offsetIndex * 24,
      y: position.y + offsetIndex * 24,
      width,
      height,
      title: `🎬 ${file.name || '本地视频'}`,
      assetName: file.name || '本地视频',
      model: getPreferredServerModel('canvas', 'video'),
      aspect: dimensions ? (dimensions.width < dimensions.height ? '9:16' : (dimensions.width === dimensions.height ? '1:1' : '16:9')) : '16:9',
      duration: 15,
      videoUrl: uploaded.url,
      mediaReference: uploaded.reference || uploaded.url,
      mediaId: uploaded.id || null,
      source: 'canvas-file-drop',
      status: 'done',
      mediaWidth: dimensions?.width || null,
      mediaHeight: dimensions?.height || null,
      mediaAspectRatio: dimensions ? dimensions.width / dimensions.height : null,
      mediaAutoSized: !!dimensions,
      mediaAutoSizePending: !dimensions
    };
    addCanvasNode(node);
    return node;
  }
  if (isCanvasAudioFile(file)) {
    const width = 320;
    const height = 170;
    const position = canvasClientPointToNodePosition(clientX, clientY, width, height);
    const node = {
      id: `node_audio_drop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'audio',
      x: position.x + offsetIndex * 24,
      y: position.y + offsetIndex * 24,
      width,
      height,
      title: `🎧 ${file.name || '参考音频'}`,
      assetName: file.name || '参考音频',
      audioUrl: uploaded.url,
      mediaReference: uploaded.reference || uploaded.url,
      mediaId: uploaded.id || null,
      source: 'canvas-file-drop',
      status: 'done'
    };
    addCanvasNode(node);
    return node;
  }
  return null;
}

function bindCanvasWorkspaceFileDrop() {
  const workspace = document.getElementById('canvasWorkspace');
  if (!workspace || workspace.dataset.canvasFileDropBound === 'true') return;
  workspace.dataset.canvasFileDropBound = 'true';
  let dragDepth = 0;
  const hasFiles = event => Array.from(event.dataTransfer?.types || []).includes('Files');
  const reset = () => {
    dragDepth = 0;
    workspace.classList.remove('canvas-file-dragover');
  };
  workspace.addEventListener('dragenter', event => {
    if (!hasFiles(event) || event.target.closest('[data-canvas-image-drop-target]')) return;
    event.preventDefault();
    dragDepth += 1;
    workspace.classList.add('canvas-file-dragover');
  });
  workspace.addEventListener('dragover', event => {
    if (!hasFiles(event) || event.target.closest('[data-canvas-image-drop-target]')) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    workspace.classList.add('canvas-file-dragover');
  });
  workspace.addEventListener('dragleave', event => {
    if (!hasFiles(event) || event.target.closest('[data-canvas-image-drop-target]')) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) workspace.classList.remove('canvas-file-dragover');
  });
  workspace.addEventListener('drop', async event => {
    if (!hasFiles(event) || event.target.closest('[data-canvas-image-drop-target]')) return;
    event.preventDefault();
    event.stopPropagation();
    reset();
    const files = getCanvasDroppedMediaFiles(event.dataTransfer);
    if (!files.length) return showToast('画布仅支持拖入图片或视频文件', 'warning');
    try {
      for (let index = 0; index < files.length; index += 1) {
        await createCanvasNodeFromDroppedFile(files[index], event.clientX, event.clientY, index);
      }
      const kind = files.length === 1 ? (isCanvasImageFile(files[0]) ? '图片' : '视频') : '媒体';
      showToast(`已在拖放位置创建 ${files.length} 个${kind}节点`, 'success');
    } catch (error) {
      console.error('画布文件拖放失败:', error);
      showToast(`文件导入失败：${error.message || '无法读取文件'}`, 'error');
    }
  });
  window.addEventListener('dragend', reset);
  window.addEventListener('drop', reset, true);
}
window.bindCanvasWorkspaceFileDrop = bindCanvasWorkspaceFileDrop;

function handleCanvasNodeImageDragEnter(nodeId, event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add('drag-over');
}
window.handleCanvasNodeImageDragEnter = handleCanvasNodeImageDragEnter;

function handleCanvasNodeImageDragOver(nodeId, event) {
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  event.currentTarget.classList.add('drag-over');
}
window.handleCanvasNodeImageDragOver = handleCanvasNodeImageDragOver;

function handleCanvasNodeImageDragLeave(nodeId, event) {
  event.preventDefault();
  event.stopPropagation();
  if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
  event.currentTarget.classList.remove('drag-over');
}
window.handleCanvasNodeImageDragLeave = handleCanvasNodeImageDragLeave;

function downloadCanvasNodeAsset(nodeId) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const url = node.imgUrl || node.videoUrl || node.audioUrl;
  if (!url) {
    showToast('当前节点没有可下载的内容', 'warning');
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = node.assetName || node.title || `canvas-asset-${nodeId}`;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
window.downloadCanvasNodeAsset = downloadCanvasNodeAsset;

let canvasImagePreviewNodeId = null;

function closeCanvasImagePreview() {
  const modal = document.getElementById('canvasImagePreviewModal');
  if (modal) modal.classList.add('hidden');
  canvasImagePreviewNodeId = null;
}
window.closeCanvasImagePreview = closeCanvasImagePreview;

function openCanvasImagePreview(nodeId, event) {
  event?.preventDefault();
  event?.stopPropagation();
  const node = canvasState.nodes.find(item => item.id === nodeId && item.type === 'asset');
  if (!node?.imgUrl) return;
  let modal = document.getElementById('canvasImagePreviewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'canvasImagePreviewModal';
    modal.className = 'canvas-image-preview-modal hidden';
    modal.innerHTML = `<div class="canvas-image-preview-shell" role="dialog" aria-modal="true" aria-label="画布图片放大预览">
      <div class="canvas-image-preview-toolbar">
        <strong id="canvasImagePreviewTitle">图片预览</strong>
        <div>
          <button type="button" onclick="event.stopPropagation(); downloadCanvasImagePreview()" title="下载原图">↓ 下载</button>
          <button type="button" onclick="event.stopPropagation(); closeCanvasImagePreview()" title="关闭预览">×</button>
        </div>
      </div>
      <div class="canvas-image-preview-stage"><img id="canvasImagePreviewImage" alt="画布图片预览" draggable="false"></div>
    </div>`;
    modal.addEventListener('click', clickEvent => {
      if (clickEvent.target === modal) closeCanvasImagePreview();
    });
    document.body.appendChild(modal);
  }
  canvasImagePreviewNodeId = nodeId;
  const image = modal.querySelector('#canvasImagePreviewImage');
  const title = modal.querySelector('#canvasImagePreviewTitle');
  if (image) {
    image.src = node.imgUrl;
    image.alt = node.assetName || '画布图片预览';
  }
  if (title) title.textContent = node.assetName || node.title?.replace(/^[🤖📝🖼️🎬\s]+/, '') || '图片预览';
  modal.classList.remove('hidden');
}
window.openCanvasImagePreview = openCanvasImagePreview;

function downloadCanvasImagePreview() {
  if (canvasImagePreviewNodeId) downloadCanvasNodeAsset(canvasImagePreviewNodeId);
}
window.downloadCanvasImagePreview = downloadCanvasImagePreview;

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.getElementById('canvasImagePreviewModal')?.classList.contains('hidden')) {
    closeCanvasImagePreview();
  }
});

function handleCanvasNodeImageDrop(nodeId, event) {
  event?.preventDefault();
  event?.stopPropagation();
  event?.currentTarget?.classList.remove('drag-over');
  const node = canvasState.nodes.find(item => item.id === nodeId);
  if (node && ['submitting', 'generating'].includes(node.status)) {
    showToast('当前节点正在生成，暂时不能重复上传', 'info');
    return;
  }
  const files = getCanvasDroppedMediaFiles(event?.dataTransfer);
  const file = files.find(isCanvasImageFile);
  if (!file) {
    showToast('图片节点仅支持拖入图片文件', 'warning');
    return;
  }
  handleCanvasNodeImageFile(nodeId, file);
}
window.handleCanvasNodeImageDrop = handleCanvasNodeImageDrop;

const IMAGE_RESULT_DB_NAME = 'videoPromptKbImageResults';
const IMAGE_RESULT_STORE_NAME = 'images';
const ephemeralImageResults = new Map();

function openImageResultDb() {
  if (EPHEMERAL_SESSION_MODE) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('当前浏览器不支持图片结果持久化'));
      return;
    }
    const request = indexedDB.open(IMAGE_RESULT_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_RESULT_STORE_NAME)) {
        db.createObjectStore(IMAGE_RESULT_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('图片结果数据库打开失败'));
  });
}

async function saveImageResultData(id, source) {
  if (!id || !source) return null;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`生成图片读取失败 (HTTP ${response.status})`);
  const blob = await response.blob();
  return saveImageResultBlob(id, blob);
}

async function saveImageResultBlob(id, blob) {
  if (!id || !blob) return null;
  if (!blob.type?.startsWith('image/')) throw new Error('保存的内容不是有效图片');
  if (EPHEMERAL_SESSION_MODE) {
    ephemeralImageResults.set(id, blob);
    return id;
  }
  const db = await openImageResultDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_RESULT_STORE_NAME, 'readwrite');
    tx.objectStore(IMAGE_RESULT_STORE_NAME).put({ id, blob, savedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('图片结果保存失败'));
    tx.onabort = () => reject(tx.error || new Error('图片结果保存被中止'));
  });
  db.close();
  return id;
}

async function loadImageResultData(id) {
  if (!id) return null;
  if (state.imageResultCache.has(id)) return state.imageResultCache.get(id);
  if (EPHEMERAL_SESSION_MODE) {
    const blob = ephemeralImageResults.get(id);
    if (!blob) return null;
    const objectUrl = URL.createObjectURL(blob);
    state.imageResultCache.set(id, objectUrl);
    return objectUrl;
  }
  const db = await openImageResultDb();
  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_RESULT_STORE_NAME, 'readonly');
    const request = tx.objectStore(IMAGE_RESULT_STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('图片结果读取失败'));
  });
  db.close();
  if (!record?.blob) return null;
  const objectUrl = URL.createObjectURL(record.blob);
  state.imageResultCache.set(id, objectUrl);
  return objectUrl;
}

async function deleteImageResultData(id) {
  if (!id) return;
  const cachedUrl = state.imageResultCache.get(id);
  if (cachedUrl) URL.revokeObjectURL(cachedUrl);
  state.imageResultCache.delete(id);
  if (EPHEMERAL_SESSION_MODE) {
    ephemeralImageResults.delete(id);
    return;
  }
  const db = await openImageResultDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_RESULT_STORE_NAME, 'readwrite');
    tx.objectStore(IMAGE_RESULT_STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('图片结果删除失败'));
  });
  db.close();
}

async function hydrateStoredImageElements(root = document) {
  const nodes = root.querySelectorAll('[data-image-result-id]');
  await Promise.all(Array.from(nodes).map(async node => {
    const imageResultId = node.dataset.imageResultId;
    if (!imageResultId || node.dataset.imageLoaded === 'true') return;
    try {
      const source = await loadImageResultData(imageResultId);
      if (source) {
        node.src = source;
        node.dataset.imageLoaded = 'true';
      }
    } catch (error) {
      node.alt = `图片恢复失败：${error.message}`;
    }
  }));
}

function buildOpenAIEndpoint(baseUrl, resourcePath) {
  let endpoint = (baseUrl || '').trim();
  if (!endpoint) throw new Error('图片 API Base URL 未配置');
  if (!/^https?:\/\//i.test(endpoint)) endpoint = 'https://' + endpoint;
  endpoint = endpoint.replace(/\/+$/, '');
  if (/\/images\/(generations|edits)$/i.test(endpoint)) {
    endpoint = endpoint.replace(/\/images\/(generations|edits)$/i, resourcePath);
  } else if (endpoint.endsWith('/v1')) {
    endpoint += resourcePath;
  } else {
    endpoint += '/v1' + resourcePath;
  }
  return endpoint;
}

function getCanvasNodePromptText(node) {
  if (!node) return '';
  if (node.type === 'text') return (node.content || '').trim();
  if (node.type === 'agent') return (node.outputContent || '').trim();
  return '';
}

function parseCanvasMentionRef(raw) {
  // 支持新格式 @[nodeId|title] 和旧格式 @[title]
  if (raw.includes('|')) {
    const [nodeId, ...rest] = raw.split('|');
    return { nodeId: nodeId.trim(), title: rest.join('|').trim() };
  }
  return { nodeId: null, title: raw.trim() };
}

function findCanvasMentionTarget(raw, currentNodeId) {
  if (!currentNodeId) return null;
  const upstreamNodes = getSelectedCanvasInputNodes(currentNodeId);
  const { nodeId, title } = parseCanvasMentionRef(raw);
  if (nodeId) {
    const byId = upstreamNodes.find(node => node.id === nodeId);
    if (byId) return byId;
  }
  return upstreamNodes.find(node => {
    const nodeTitle = (node.title || node.assetName || '').replace(/^[🤖📝🖼️🎬\s]+/, '');
    return nodeTitle === title;
  });
}

function resolveCanvasAtMentionText(text, currentNodeId) {
  if (!text || !currentNodeId) return text || '';
  return text.replace(/@\[([^\]]+)\]/g, (match, raw) => {
    const targetNode = findCanvasMentionTarget(raw, currentNodeId);
    if (!targetNode) return match;
    if (targetNode.type === 'text') return targetNode.content || '';
    if (targetNode.type === 'agent') return targetNode.outputContent || '';
    // 媒体本体通过 images/videos/audios 字段发送；提示词中只保留可读引用名，避免把 Base64 塞进 JSON。
    return `@${parseCanvasMentionRef(raw).title}`;
  });
}
window.resolveCanvasAtMentionText = resolveCanvasAtMentionText;

function getCanvasAtMentionImageRefs(text, currentNodeId) {
  if (!text || !currentNodeId) return [];
  const refs = [];
  text.replace(/@\[([^\]]+)\]/g, (match, raw) => {
    const targetNode = findCanvasMentionTarget(raw, currentNodeId);
    if (targetNode) refs.push(...getCanvasNodeProviderSources(targetNode, 'asset'));
    return match;
  });
  return [...new Set(refs)];
}
window.getCanvasAtMentionImageRefs = getCanvasAtMentionImageRefs;

function getCanvasNodeImageSources(node) {
  if (!node) return [];
  const sources = [];
  if (typeof node.imgUrl === 'string' && node.imgUrl.trim()) sources.push(node.imgUrl.trim());
  if (typeof node.imageUrl === 'string' && node.imageUrl.trim()) sources.push(node.imageUrl.trim());
  if (Array.isArray(node.images)) {
    node.images.forEach(item => {
      const source = typeof item === 'string' ? item : item && item.url;
      if (typeof source === 'string' && source.trim()) sources.push(source.trim());
    });
  }
  return [...new Set(sources)].filter(source => !/^data:video\//i.test(source));
}

function getCanvasNodeVideoSources(node) {
  if (!node) return [];
  const sources = [];
  if (typeof node.videoUrl === 'string' && node.videoUrl.trim()) sources.push(node.videoUrl.trim());
  if (Array.isArray(node.videos)) {
    node.videos.forEach(item => {
      const source = typeof item === 'string' ? item : item && (item.url || item.videoUrl);
      if (typeof source === 'string' && source.trim()) sources.push(source.trim());
    });
  }
  return [...new Set(sources)];
}

function getCanvasNodeAudioSources(node) {
  if (!node) return [];
  const sources = [];
  if (typeof node.audioUrl === 'string' && node.audioUrl.trim()) sources.push(node.audioUrl.trim());
  if (Array.isArray(node.audios)) node.audios.forEach(item => {
    const source = typeof item === 'string' ? item : item && (item.url || item.audioUrl);
    if (typeof source === 'string' && source.trim()) sources.push(source.trim());
  });
  return [...new Set(sources)];
}

function getCanvasNodeProviderSources(node, kind) {
  if (!node) return [];
  if (node.mediaReference && node.type === kind) return [node.mediaReference];
  if (kind === 'asset') return getCanvasNodeImageSources(node);
  if (kind === 'video') return getCanvasNodeVideoSources(node);
  if (kind === 'audio') return getCanvasNodeAudioSources(node);
  return [];
}

function canvasMediaFilename(node, kind, mimeType = '') {
  const existing = String(node?.assetName || node?.title || '').replace(/^[🤖📝🖼️🎬🎧\s]+/, '').trim();
  if (existing && /\.[a-z0-9]{2,8}$/i.test(existing)) return existing;
  const subtype = String(mimeType || '').split('/')[1]?.replace(/[^a-z0-9.+-]/gi, '') || '';
  const extension = subtype === 'jpeg' ? 'jpg' : (subtype.split('+')[0] || (kind === 'asset' ? 'png' : kind === 'video' ? 'mp4' : 'mp3'));
  return `${existing || `canvas-${kind}`}.${extension}`;
}

async function ensureCanvasNodeMediaReference(node) {
  if (!node || !['asset', 'video', 'audio'].includes(node.type)) return null;
  const storedReference = typeof node.mediaReference === 'string' ? node.mediaReference.trim() : '';
  if (/^(?:media:\/\/|https?:\/\/)/i.test(storedReference)) return storedReference;
  const kind = node.type;
  const source = storedReference || (kind === 'asset' ? node.imgUrl : kind === 'video' ? node.videoUrl : node.audioUrl);
  if (typeof source !== 'string' || !source.trim()) return null;
  const normalizedSource = source.trim();
  if (/^media:\/\//i.test(normalizedSource) || /^https?:\/\//i.test(normalizedSource)) return normalizedSource;

  const response = await fetch(normalizedSource);
  if (!response.ok) throw new Error(`旧${kind === 'asset' ? '图片' : kind === 'video' ? '视频' : '音频'}素材读取失败 (HTTP ${response.status})`);
  const blob = await response.blob();
  const uploadBody = typeof File === 'function'
    ? new File([blob], canvasMediaFilename(node, kind, blob.type), { type: blob.type || 'application/octet-stream' })
    : blob;
  const uploaded = await apiUploadMedia(uploadBody);
  node.mediaReference = uploaded.reference || uploaded.url;
  node.mediaId = uploaded.id || null;
  if (kind === 'asset') node.imgUrl = uploaded.url;
  else if (kind === 'video') node.videoUrl = uploaded.url;
  else node.audioUrl = uploaded.url;
  node.errorMsg = '';
  saveCanvasState();
  return node.mediaReference;
}

async function ensureCanvasInputMediaReferences(nodes) {
  const mediaNodes = (nodes || []).filter(node => ['asset', 'video', 'audio'].includes(node?.type));
  for (const mediaNode of mediaNodes) await ensureCanvasNodeMediaReference(mediaNode);
}

function getCanvasImageGenerationInputs(nodeId) {
  const prompts = [];
  const images = [];
  const targetNode = canvasState.nodes.find(item => item.id === nodeId);
  const ownPrompt = (targetNode?.prompt || '').trim();
  if (ownPrompt) prompts.push(resolveCanvasAtMentionText(ownPrompt, nodeId));
  getSelectedCanvasInputNodes(nodeId).forEach(sourceNode => {
    const rawPrompt = getCanvasNodePromptText(sourceNode);
    if (rawPrompt) {
      prompts.push(resolveCanvasAtMentionText(rawPrompt, sourceNode.id));
      images.push(...getCanvasAtMentionImageRefs(rawPrompt, sourceNode.id));
    }
    images.push(...getCanvasNodeProviderSources(sourceNode, 'asset'));
  });
  return {
    prompt: prompts.join('\n'),
    images: [...new Set(images)]
  };
}

function getCanvasBulkNodeMeta(node) {
  const fallback = node?.type === 'asset'
    ? '图片节点'
    : node?.type === 'video'
      ? '视频节点'
      : node?.type === 'text'
        ? '文本节点'
        : node?.type === 'audio'
          ? '音频节点'
          : node?.type === 'agent'
            ? '智能体节点'
            : '未知节点';
  const name = String(node?.title || node?.assetName || fallback)
    .replace(/^[🤖📝🖼️🎬🎧\s]+/, '')
    .trim() || fallback;
  const icon = node?.type === 'asset' ? '▧' : node?.type === 'video' ? '▶' : node?.type === 'text' ? 'T' : node?.type === 'audio' ? '♫' : '◇';
  const typeLabel = node?.type === 'asset' ? '图片' : node?.type === 'video' ? '视频' : fallback.replace('节点', '');
  return { name, icon, typeLabel };
}

function hasCanvasVideoGenerationInputs(node) {
  if (!node) return false;
  if (String(node.prompt || '').trim()) return true;
  return getSelectedCanvasInputNodes(node.id).some(sourceNode => {
    const rawPrompt = getCanvasNodePromptText(sourceNode);
    if (rawPrompt) return true;
    if (getCanvasNodeProviderSources(sourceNode, 'asset').length) return true;
    if (getCanvasNodeProviderSources(sourceNode, 'video').length) return true;
    if (getCanvasNodeProviderSources(sourceNode, 'audio').length) return true;
    return false;
  });
}

function inspectCanvasBulkStartNode(node) {
  const meta = getCanvasBulkNodeMeta(node);
  const result = { nodeId: node?.id || '', type: node?.type || '', ...meta, executable: false, reason: '' };
  if (!node || !['asset', 'video'].includes(node.type)) {
    result.reason = `${meta.typeLabel}节点不支持批量生成`;
    return result;
  }
  if (['submitting', 'generating'].includes(node.status)) {
    result.reason = '当前正在生成';
    return result;
  }
  if (!BackendClient.isAuthenticated()) {
    result.reason = '账号未登录';
    return result;
  }
  if (SessionSystem.getActive()?.type !== 'canvas') {
    result.reason = '当前画布会话不可用';
    return result;
  }
  if (node.type === 'asset') {
    if (!getPreferredServerModel('canvas', 'image', node.model || state.apiConfig.imageModel)) {
      result.reason = '没有可用图片模型';
      return result;
    }
    const inputs = getCanvasImageGenerationInputs(node.id);
    if (!inputs.prompt && inputs.images.length === 0) {
      result.reason = '缺少提示词或上游参考图';
      return result;
    }
  } else {
    if (!getPreferredServerModel('canvas', 'video', node.model)) {
      result.reason = '没有可用视频模型';
      return result;
    }
    if (!hasCanvasVideoGenerationInputs(node)) {
      result.reason = '缺少提示词或当前可用的上游素材';
      return result;
    }
  }
  result.executable = true;
  result.reason = node.type === 'asset' ? '生成图片' : '生成视频';
  return result;
}

function analyzeCanvasBulkStart(nodeIds = canvasState.selectedNodeIds) {
  const uniqueIds = [...new Set(Array.isArray(nodeIds) ? nodeIds : [])];
  const entries = uniqueIds
    .map(id => canvasState.nodes.find(node => node.id === id))
    .filter(Boolean)
    .map(inspectCanvasBulkStartNode);
  return {
    selectedIds: uniqueIds,
    executable: entries.filter(entry => entry.executable),
    blocked: entries.filter(entry => !entry.executable)
  };
}

function renderCanvasBulkStartItems(entries, emptyText) {
  if (!entries.length) return `<div class="canvas-bulk-start-empty">${escapeHTML(emptyText)}</div>`;
  return entries.map(entry => `
    <div class="canvas-bulk-start-item">
      <div class="canvas-bulk-start-item-main">
        <span class="canvas-bulk-start-item-icon">${escapeHTML(entry.icon)}</span>
        <span class="canvas-bulk-start-item-name" title="${escapeHTML(entry.name)}">${escapeHTML(entry.name)}</span>
      </div>
      <span class="canvas-bulk-start-item-reason">${escapeHTML(entry.reason)}</span>
    </div>
  `).join('');
}

function renderCanvasBulkStartPlan(plan) {
  const readyList = document.getElementById('canvasBulkReadyList');
  const blockedList = document.getElementById('canvasBulkBlockedList');
  const readyCount = document.getElementById('canvasBulkReadyCount');
  const blockedCount = document.getElementById('canvasBulkBlockedCount');
  const summary = document.getElementById('canvasBulkStartSummary');
  const confirmButton = document.getElementById('btnConfirmCanvasBulkStart');
  if (readyList) readyList.innerHTML = renderCanvasBulkStartItems(plan.executable, '没有可以执行的节点');
  if (blockedList) blockedList.innerHTML = renderCanvasBulkStartItems(plan.blocked, '全部选中节点均可执行');
  if (readyCount) readyCount.textContent = String(plan.executable.length);
  if (blockedCount) blockedCount.textContent = String(plan.blocked.length);
  if (summary) summary.textContent = `已选择 ${plan.selectedIds.length} 个节点，其中 ${plan.executable.length} 个可以执行，${plan.blocked.length} 个不能执行。`;
  if (confirmButton) {
    confirmButton.disabled = plan.executable.length === 0;
    confirmButton.textContent = plan.executable.length ? `同时开始 ${plan.executable.length} 个任务` : '没有可执行任务';
  }
}

function updateCanvasBulkStartButton() {
  const button = document.getElementById('btnCanvasBulkStart');
  if (!button) return;
  const count = Array.isArray(canvasState.selectedNodeIds) ? canvasState.selectedNodeIds.length : 0;
  button.disabled = count === 0;
  button.title = count ? `批量开始（已选择 ${count} 个节点）` : '请先选择要执行的图片或视频节点';
  button.setAttribute('aria-label', count ? `批量开始已选择的 ${count} 个节点` : '批量开始选中的图片和视频节点');
}
window.updateCanvasBulkStartButton = updateCanvasBulkStartButton;

function openCanvasBulkStartConfirm() {
  const selectedIds = [...(canvasState.selectedNodeIds || [])];
  if (!selectedIds.length) {
    showToast('请先选择要执行的节点', 'info');
    return;
  }
  canvasBulkStartPlan = analyzeCanvasBulkStart(selectedIds);
  renderCanvasBulkStartPlan(canvasBulkStartPlan);
  document.getElementById('modalCanvasBulkStartConfirm')?.classList.remove('hidden');
}
window.openCanvasBulkStartConfirm = openCanvasBulkStartConfirm;

function closeCanvasBulkStartConfirm() {
  document.getElementById('modalCanvasBulkStartConfirm')?.classList.add('hidden');
  canvasBulkStartPlan = null;
}
window.closeCanvasBulkStartConfirm = closeCanvasBulkStartConfirm;

function confirmCanvasBulkStart() {
  if (!canvasBulkStartPlan) return;
  const latestPlan = analyzeCanvasBulkStart(canvasBulkStartPlan.selectedIds);
  if (!latestPlan.executable.length) {
    canvasBulkStartPlan = latestPlan;
    renderCanvasBulkStartPlan(latestPlan);
    showToast('选中的节点当前都不能执行', 'warning');
    return;
  }
  const executable = [...latestPlan.executable];
  closeCanvasBulkStartConfirm();
  showToast(`正在同时开始 ${executable.length} 个画布任务`, 'info');
  const executions = executable.map(entry => entry.type === 'asset'
    ? runCanvasImageGeneration(entry.nodeId)
    : runCanvasVideoGeneration(entry.nodeId));
  void Promise.allSettled(executions).then(results => {
    const rejected = results.filter(result => result.status === 'rejected').length;
    if (rejected) showToast(`${rejected} 个节点启动时发生异常，请查看节点提示`, 'error');
  });
}
window.confirmCanvasBulkStart = confirmCanvasBulkStart;

async function canvasImageSourceToBlob(source, index) {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`第 ${index + 1} 张参考图读取失败 (HTTP ${response.status})`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error(`第 ${index + 1} 个上游内容不是有效图片`);
  return blob;
}

function extractImageSourcesFromOutput(output) {
  const candidates = [];
  const append = value => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }
    if (typeof value !== 'object') return;
    const imageUrl = value.url || value.image_url || value.imageUrl || value.result_url || value.resultUrl;
    if (typeof imageUrl === 'string' && imageUrl.trim()) candidates.push(imageUrl.trim());
    const base64 = value.b64_json || value.base64 || value.image_base64;
    if (typeof base64 === 'string' && base64.trim()) {
      candidates.push(base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`);
    }
  };
  append(output?.data);
  append(output?.result);
  append(output?.images);
  append(output);
  return [...new Set(candidates)];
}

async function parseImageApiResponse(response) {
  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    throw new Error(`图片 API 返回了无法解析的响应 (HTTP ${response.status})`);
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  const sources = extractImageSourcesFromOutput(data);
  if (sources.length) return sources;
  throw new Error('图片 API 未返回 url 或 b64_json 图片数据');
}

async function apiGenerateCanvasImage(prompt, imageSources, imageOptions = {}) {
  const mode = imageOptions.mode || 'creation';
  const model = getPreferredServerModel(mode, 'image', imageOptions.model || state.apiConfig.imageModel);
  const size = imageOptions.size || (mode === 'canvas' ? '1024x1024' : undefined);
  if (!model) throw new Error(`${mode === 'canvas' ? '画布' : '创作'}模式暂无可用图片模型，请联系管理员启用模型`);
  const created = await BackendClient.createGeneration({
    mode,
    operation: 'image',
    model,
    prompt: prompt || '基于所有参考图片生成一张风格与主体一致的新图片',
    input: {
      size,
      images: imageSources || [],
      n: mode === 'creation' ? clampImageCount(imageOptions.count || 1) : 1,
      ...(mode === 'canvas' ? {
        client_context: {
          session_id: imageOptions.sessionId || undefined,
          node_id: imageOptions.canvasNodeId || undefined
        }
      } : {})
    },
    count: mode === 'creation' ? clampImageCount(imageOptions.count || 1) : 1,
    requestId: imageOptions.frontendTaskId,
    signal: imageOptions.signal,
    onProgress: imageOptions.onProgress
  });
  // 创建后端任务后立即把 backendTaskId 写回前端 task 对象，保证轮询器能查到
  if (created?.task?.id && imageOptions.frontendTaskId) {
    const frontendTask = state.activeTasks.find(t => t.taskId === imageOptions.frontendTaskId);
    if (frontendTask && !frontendTask.backendTaskId) {
      frontendTask.backendTaskId = created.task.id;
      await SessionSystem.trackTask(frontendTask);
    }
  }
  const task = await BackendClient.waitForGeneration(created.task, {
    signal: imageOptions.signal,
    timeoutMs: mode === 'canvas' ? 600_000 : 300_000,
    onProgress: imageOptions.onProgress
  });
  const sources = extractImageSourcesFromOutput(task.output || {});
  if (sources.length) return { source: sources[0], sources, task, pricing: created.pricing };
  throw new Error('服务端任务未返回图片地址或图片数据');
}

const activeCanvasImageSubmissions = new Set();
const activeCanvasImageReconciliations = new Set();
const canvasImageReconcileTimers = new Map();

async function patchCanvasTaskNode(task, patch) {
  if (!task?.sessionId || !task?.canvasNodeId) return;
  await SessionSystem.updateSessionData(task.sessionId, data => {
    const targetNode = (data.nodes || []).find(item => item.id === task.canvasNodeId);
    if (targetNode) Object.assign(targetNode, patch);
    return data;
  }, { touch: false });
  if (SessionSystem.getActive()?.id !== task.sessionId) return;
  const activeNode = canvasState.nodes.find(item => item.id === task.canvasNodeId);
  if (activeNode) Object.assign(activeNode, patch);
  renderCanvasNodesAndLines();
}

function scheduleCanvasImageTaskReconcile(task) {
  if (!task?.taskId || activeCanvasImageSubmissions.has(task.taskId) || canvasImageReconcileTimers.has(task.taskId)) return;
  const timer = window.setTimeout(() => {
    canvasImageReconcileTimers.delete(task.taskId);
    void reconcileCanvasImageTask(task).catch(error => console.warn('画布图片任务恢复查询失败:', error));
  }, 2500);
  canvasImageReconcileTimers.set(task.taskId, timer);
}

async function reconcileCanvasImageTask(task) {
  if (!task?.taskId
    || SessionSystem.isTaskCanceled(task.taskId)
    || activeCanvasImageSubmissions.has(task.taskId)
    || activeCanvasImageReconciliations.has(task.taskId)) return task;
  activeCanvasImageReconciliations.add(task.taskId);
  try {
    if (!task.backendTaskId) {
      const backendTasks = await BackendClient.listGenerations(100);
      const matchedTask = backendTasks.find(item => item.requestId === task.taskId);
      if (!matchedTask) {
        if (Date.now() - Number(task.createdAt || 0) > 20 * 60 * 1000) {
          const message = '未找到对应的后台图片任务，请重新生成';
          const failedTask = completeTask(task.taskId, 'failed', null, message, task.prompt, task.model);
          await patchCanvasTaskNode(task, { status: 'failed', progress: 100, errorMsg: message, taskId: task.taskId });
          return failedTask;
        }
        scheduleCanvasImageTaskReconcile(task);
        return task;
      }
      task.backendTaskId = matchedTask.id;
    }

    const backendTask = await BackendClient.getGeneration(task.backendTaskId);
    applyBackendTaskBilling(task, backendTask);
    if (!['completed', 'refunded', 'failed', 'canceled'].includes(backendTask.status)) {
      task.status = backendTask.status === 'queued' ? 'queued' : 'in_progress';
      task.progress = Math.min(92, Math.max(Number(task.progress || 5) + 2, Number(backendTask.progress || 0)));
      await SessionSystem.trackTask(task);
      await patchCanvasTaskNode(task, { status: 'generating', progress: task.progress, taskId: task.taskId, errorMsg: '' });
      scheduleCanvasImageTaskReconcile(task);
      return task;
    }

    const pendingTimer = canvasImageReconcileTimers.get(task.taskId);
    if (pendingTimer) window.clearTimeout(pendingTimer);
    canvasImageReconcileTimers.delete(task.taskId);
    if (backendTask.status === 'completed') {
      const sources = extractImageSourcesFromOutput(backendTask.output || {});
      if (!sources.length) throw new Error('后台任务已完成，但没有返回图片地址或图片数据');
      const source = sources[0];
      const remoteSources = sources.filter(item => /^https?:\/\//i.test(item));
      if (remoteSources.length) {
        task.imageUrls = remoteSources;
        task.imageUrl = remoteSources[0];
      }
      const completedTask = completeTask(task.taskId, 'completed', null, null, task.prompt, task.model, backendTask);
      await patchCanvasTaskNode(task, {
        imgUrl: source,
        assetName: 'AI 生成图片',
        title: '🖼️ 参考图节点',
        status: 'done',
        progress: 100,
        taskId: task.taskId,
        errorMsg: '',
        mediaAutoSizePending: true
      });
      return completedTask;
    }

    const message = backendTask.errorMessage || (backendTask.status === 'canceled' ? '任务已取消' : '图片生成失败，积分已退回');
    const finalStatus = backendTask.status === 'canceled' ? 'canceled' : backendTask.status;
    const failedTask = completeTask(task.taskId, finalStatus, null, message, task.prompt, task.model, backendTask);
    await patchCanvasTaskNode(task, {
      status: finalStatus === 'canceled' ? 'idle' : 'failed',
      progress: finalStatus === 'canceled' ? 0 : 100,
      taskId: task.taskId,
      errorMsg: message
    });
    return failedTask;
  } catch (error) {
    scheduleCanvasImageTaskReconcile(task);
    throw error;
  } finally {
    activeCanvasImageReconciliations.delete(task.taskId);
  }
}

function startCanvasImageProgress(task, nodeId) {
  let progress = Math.max(8, Number(task?.progress || 8));
  const update = () => {
    if (SessionSystem.isTaskCanceled(task.taskId)) return;
    progress = Math.min(92, progress + (progress < 55 ? 4 : progress < 78 ? 2 : 1));
    task.progress = progress;
    const currentNode = canvasState.nodes.find(item => item.id === nodeId);
    if (currentNode && ['submitting', 'generating'].includes(currentNode.status)) currentNode.progress = progress;
    const fill = document.getElementById(`progress-fill-${nodeId}`);
    const text = document.getElementById(`progress-text-${nodeId}`);
    const progressbar = fill?.closest('[role="progressbar"]');
    if (fill) fill.style.width = `${progress}%`;
    if (text) text.textContent = `图片生成进行中 ${progress}%`;
    if (progressbar) progressbar.setAttribute('aria-valuenow', String(progress));
  };
  const timer = window.setInterval(update, 1200);
  return () => window.clearInterval(timer);
}

async function runCanvasImageGeneration(nodeId) {
  const node = canvasState.nodes.find(item => item.id === nodeId && item.type === 'asset');
  if (!node || ['submitting', 'generating'].includes(node.status)) return;
  node.status = 'submitting';
  node.progress = 5;
  node.errorMsg = '';
  renderCanvasNodesAndLines();
  try {
    await ensureCanvasInputMediaReferences(getSelectedCanvasInputNodes(nodeId));
  } catch (error) {
    node.status = 'failed';
    node.progress = 0;
    node.errorMsg = `参考素材上传失败：${error.message || error}`;
    renderCanvasNodesAndLines();
    showToast(node.errorMsg, 'error');
    return;
  }
  const inputs = getCanvasImageGenerationInputs(nodeId);
  if (!inputs.prompt && inputs.images.length === 0) {
    node.status = 'idle';
    renderCanvasNodesAndLines();
    showToast('请填写当前节点提示词，或在“输入”中选择含提示词或图片的上游节点');
    return;
  }

  let originSession = null;
  try {
    originSession = await SessionSystem.ensureActivePersisted();
  } catch (error) {
    console.error('保存画布会话失败:', error);
  }
  const originSessionId = originSession?.type === 'canvas' ? originSession.id : null;
  if (!originSessionId) {
    node.status = 'failed';
    node.errorMsg = '无法保存当前画布会话';
    renderCanvasNodesAndLines();
    return;
  }

  const imageModel = getPreferredServerModel('canvas', 'image', node.model || state.apiConfig.imageModel);
  if (!imageModel) {
    node.status = 'failed';
    node.progress = 0;
    node.errorMsg = '暂无可用图片模型，请先在 API 设置中配置';
    renderCanvasNodesAndLines();
    showToast(node.errorMsg, 'error');
    return;
  }
  node.model = imageModel;
  const taskId = `canvas_image_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const controller = new AbortController();
  const task = SessionSystem.assignTask({
    source: 'canvas',
    mediaType: 'image',
    canvasNodeId: nodeId,
    taskId,
    prompt: inputs.prompt,
    model: imageModel,
    status: 'in_progress',
    progress: 10,
    createdAt: Date.now(),
    sessionId: originSessionId,
    sessionType: 'canvas'
  }, 'canvas');
  node.status = 'generating';
  node.taskId = taskId;
  node.errorMsg = '';
  state.activeTasks.unshift(task);
  SessionSystem.registerPendingRequest(originSessionId, controller);
  void SessionSystem.trackTask(task).catch(error => console.warn('Canvas image task session save failed:', error));
  saveCanvasState();
  renderCanvasNodesAndLines();
  updateStatusIndicators();
  showToast(`正在使用 ${inputs.prompt ? '提示词' : ''}${inputs.prompt && inputs.images.length ? '和' : ''}${inputs.images.length ? `${inputs.images.length} 张参考图` : ''}生成图片`);

  let nodePatch = null;
  activeCanvasImageSubmissions.add(taskId);
  const stopProgress = startCanvasImageProgress(task, nodeId);
  try {
    const generated = await apiGenerateCanvasImage(inputs.prompt, inputs.images, {
      mode: 'canvas',
      model: imageModel,
      signal: controller.signal,
      frontendTaskId: taskId,
      sessionId: originSessionId,
      canvasNodeId: nodeId
    });
    if (controller.signal.aborted || SessionSystem.isTaskCanceled(taskId)) return;
    applyBackendTaskBilling(task, generated.task, generated.pricing);
    nodePatch = { imgUrl: generated.source, assetName: 'AI 生成图片', title: '🖼️ 参考图节点', status: 'done', progress: 100, taskId, errorMsg: '', mediaAutoSizePending: true, reservedCredits: task.reservedCredits, consumedCredits: task.consumedCredits };
    completeTask(taskId, 'completed', null, null, inputs.prompt, task.model, generated.task);
    showToast('图片生成成功，已写入原画布会话的参考图节点');
  } catch (error) {
    if (controller.signal.aborted || SessionSystem.isTaskCanceled(taskId)) return;
    nodePatch = { status: 'failed', progress: 100, taskId, errorMsg: error.message || '图片生成失败' };
    completeTask(taskId, 'failed', null, nodePatch.errorMsg, inputs.prompt, task.model, error.task || null);
    showToast(`图片生成失败：${nodePatch.errorMsg}`);
  } finally {
    stopProgress();
    activeCanvasImageSubmissions.delete(taskId);
    SessionSystem.unregisterPendingRequest(originSessionId, controller);
  }
  if (!nodePatch) return;
  await SessionSystem.updateSessionData(originSessionId, data => {
    const targetNode = (data.nodes || []).find(item => item.id === nodeId);
    if (targetNode) Object.assign(targetNode, nodePatch);
    return data;
  });
  if (SessionSystem.getActive()?.id === originSessionId) {
    const activeNode = canvasState.nodes.find(item => item.id === nodeId);
    if (activeNode) Object.assign(activeNode, nodePatch);
    renderCanvasNodesAndLines();
  }
}
window.runCanvasImageGeneration = runCanvasImageGeneration;

function startCanvasVideoTaskPoller(task, node) {
  const taskId = task.taskId;
  if (SessionSystem.hasPoller(taskId)) return;
  const MAX_CANVAS_VIDEO_POLL_ERRORS = 8;
  const MAX_CANVAS_VIDEO_POLL_DURATION_MS = 45 * 60 * 1000;
  let consecutivePollErrors = 0;
  const nodeId = task.canvasNodeId || node?.id;
  const promptSummary = task.prompt || '';
  const model = task.model || getPreferredServerModel('canvas', 'video');
  const startTime = Date.now();
  let currentProgress = Math.max(5, parseInt(task.progress, 10) || 5);

  const poller = setInterval(async () => {
    if (SessionSystem.isTaskCanceled(taskId)) {
      clearInterval(poller);
      SessionSystem.unregisterPoller(taskId, poller);
      return;
    }
    // 必须用后端 UUID 查询，前端 taskId（image_xxx/video_xxx）会导致后端 500
    const pollId = task.backendTaskId || task.taskId || taskId;
    if (!pollId) {
      clearInterval(poller);
      SessionSystem.unregisterPoller(taskId, poller);
      task.status = 'failed';
      task.errorMsg = '接口未返回有效任务 ID';
      const activeNode = SessionSystem.getActive()?.id === task.sessionId ? canvasState.nodes.find(item => item.id === nodeId) : null;
      if (activeNode) Object.assign(activeNode, { status: 'failed', progress: 0, errorMsg: task.errorMsg });
      completeTask(taskId, 'failed', null, task.errorMsg, promptSummary, model);
      renderCanvasNodesAndLines();
      return;
    }
    try {
      if (Date.now() - startTime > MAX_CANVAS_VIDEO_POLL_DURATION_MS) throw new Error('画布视频状态查询已超过 45 分钟');
      const info = await apiPollVideo(pollId);
      consecutivePollErrors = 0;
      if (SessionSystem.isTaskCanceled(taskId)) return;
      const parsed = parseVideoTaskResponse(info, startTime);
      const isOriginCanvasOpen = SessionSystem.getActive()?.id === task.sessionId;
      const activeNode = isOriginCanvasOpen ? canvasState.nodes.find(item => item.id === nodeId) : null;

      if (parsed.status === 'completed') {
        clearInterval(poller);
        SessionSystem.unregisterPoller(taskId, poller);
        const videoUrl = safeMediaUrl(parsed.videoUrl || info.metadata?.url || info.video_url || info.url);
        if (!videoUrl) {
          task.status = 'failed';
          task.errorMsg = '供应商返回了不安全或缺失的视频地址';
          if (activeNode) Object.assign(activeNode, { status: 'failed', progress: 100, errorMsg: task.errorMsg });
          completeTask(taskId, 'failed', null, task.errorMsg, promptSummary, model, info);
          if (activeNode) renderCanvasNodesAndLines();
          return;
        }
        task.videoUrl = videoUrl;
        if (activeNode) {
          activeNode.status = 'done';
          activeNode.progress = 100;
          activeNode.videoUrl = videoUrl;
          activeNode.mediaAutoSizePending = true;
          saveCanvasState();
        }
        completeTask(taskId, 'completed', videoUrl, null, promptSummary, model);
        if (activeNode) renderCanvasNodesAndLines();
      } else if (['failed', 'refunded', 'canceled'].includes(parsed.status)) {
        clearInterval(poller);
        SessionSystem.unregisterPoller(taskId, poller);
        const errorMsg = parsed.errorMsg || (parsed.status === 'refunded' ? '渲染失败，积分已退回' : (parsed.status === 'canceled' ? '任务已取消' : '渲染接口返回失败'));
        if (activeNode) {
          activeNode.status = parsed.status === 'canceled' ? 'idle' : 'failed';
          activeNode.progress = parsed.status === 'canceled' ? 0 : 100;
          activeNode.errorMsg = errorMsg;
          saveCanvasState();
        }
        completeTask(taskId, parsed.status, null, errorMsg, promptSummary, model, info);
        if (activeNode) renderCanvasNodesAndLines();
      } else {
        currentProgress = Math.min(99, Math.max(currentProgress + 3, parsed.progress || 0));
        task.status = ['reconciling', 'needs_review'].includes(parsed.status) ? parsed.status : 'rendering';
        task.progress = currentProgress;
        if (activeNode) {
          activeNode.status = 'generating';
          activeNode.progress = currentProgress;
          activeNode.recoveryState = parsed.status;
          activeNode.statusMessage = parsed.status === 'needs_review'
            ? '等待供应商状态确认'
            : parsed.status === 'reconciling'
              ? '网络波动，后台自动恢复中'
              : '';
          const fillEl = document.getElementById(`progress-fill-${nodeId}`);
          const textEl = document.getElementById(`progress-text-${nodeId}`);
          if (fillEl) fillEl.style.width = `${currentProgress}%`;
          if (textEl) textEl.textContent = `${activeNode.statusMessage || '服务端渲染中'} ${currentProgress}%`;
        }
      }
    } catch (error) {
      consecutivePollErrors += 1;
      console.warn('画布视频任务状态查询失败:', error);
      const activeNode = SessionSystem.getActive()?.id === task.sessionId
        ? canvasState.nodes.find(item => item.id === nodeId)
        : null;
      if (consecutivePollErrors >= MAX_CANVAS_VIDEO_POLL_ERRORS) {
        clearInterval(poller);
        SessionSystem.unregisterPoller(taskId, poller);
        task.status = 'needs_review';
        task.errorMsg = `状态查询连续失败 ${consecutivePollErrors} 次，已停止自动重试：${error.message}`;
        if (activeNode) {
          activeNode.status = 'failed';
          activeNode.recoveryState = 'needs_review';
          activeNode.progress = currentProgress;
          activeNode.errorMsg = task.errorMsg;
          activeNode.statusMessage = '状态查询已停止，请检查 API 或网络后重试';
        }
        void SessionSystem.trackTask(task).catch(saveError => console.warn('画布待确认状态保存失败:', saveError));
        renderCanvasNodesAndLines();
        showToast('画布视频状态查询已停止，请检查 API 或网络后重试', 'warning');
        return;
      }
      task.status = 'reconciling';
      if (activeNode) {
        activeNode.status = 'generating';
        activeNode.recoveryState = 'reconciling';
        activeNode.statusMessage = '网络波动，后台自动恢复中';
        const textEl = document.getElementById(`progress-text-${nodeId}`);
        if (textEl) textEl.textContent = `网络波动，后台自动恢复中 ${currentProgress}%`;
      }
    }
  }, 2000);
  SessionSystem.registerPoller(taskId, poller);
}

function resumeCanvasVideoTask(task) {
  const node = canvasState.nodes.find(item => item.id === task.canvasNodeId);
  if (node) {
    node.status = 'generating';
    node.progress = Math.max(5, parseInt(task.progress, 10) || 5);
    renderCanvasNodesAndLines();
  }
  startCanvasVideoTaskPoller(task, node);
}
window.resumeCanvasVideoTask = resumeCanvasVideoTask;

function resumeCanvasSessionTasks(savedTasks = []) {
  window.queueMicrotask(() => {
    const activeSessionId = SessionSystem.getActive()?.id;
    savedTasks
      .filter(task => task?.taskId && ['queued', 'in_progress', 'running', 'rendering', 'paused', 'reconciling', 'needs_review'].includes(task.status))
      .forEach(savedTask => {
        const task = state.activeTasks.find(item => item.taskId === savedTask.taskId) || savedTask;
        if (task.sessionId && activeSessionId && task.sessionId !== activeSessionId) return;
        const node = canvasState.nodes.find(item => item.id === task.canvasNodeId);
        if (!node) return;
        node.taskId = task.taskId;
        node.status = 'generating';
        node.progress = Math.max(5, Number(task.progress || node.progress || 5));
        if (task.mediaType === 'image' || task.operation === 'image') {
          if (!activeCanvasImageSubmissions.has(task.taskId)) {
            task.status = 'in_progress';
            void SessionSystem.trackTask(task).catch(error => console.warn('画布图片任务状态保存失败:', error));
            void reconcileCanvasImageTask(task).catch(error => console.warn('画布图片任务恢复失败:', error));
          }
          return;
        }
        task.status = 'rendering';
        void SessionSystem.trackTask(task).catch(error => console.warn('画布视频任务状态保存失败:', error));
        resumeCanvasVideoTask(task);
      });
    renderCanvasNodesAndLines();
  });
}
window.resumeCanvasSessionTasks = resumeCanvasSessionTasks;

async function runCanvasVideoGeneration(nodeId) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (!node || ['submitting', 'generating'].includes(node.status)) return;
  node.status = 'submitting';
  node.errorMsg = '';
  renderCanvasNodesAndLines();

  let selectedInputNodes = getSelectedCanvasInputNodes(nodeId);
  if (selectedInputNodes.some(inputNode => ['submitting', 'generating'].includes(inputNode.status))) {
    try {
      await SessionSystem.reconcileBackendGenerationTasks();
      selectedInputNodes = getSelectedCanvasInputNodes(nodeId);
    } catch (error) {
      console.warn('提交视频前恢复上游画布任务失败:', error);
    }
  }
  try {
    await ensureCanvasInputMediaReferences(selectedInputNodes);
    selectedInputNodes = getSelectedCanvasInputNodes(nodeId);
  } catch (error) {
    node.status = 'failed';
    node.progress = 0;
    node.errorMsg = `未提交：参考素材上传失败：${error.message || error}`;
    renderCanvasNodesAndLines();
    showToast(node.errorMsg, 'error');
    return;
  }
  const connectedPrompts = [];
  const connectedImages = [];
  const connectedVideos = [];
  const connectedAudios = [];
  const ownPrompt = (node.prompt || '').trim();
  if (ownPrompt) connectedPrompts.push(resolveCanvasAtMentionText(ownPrompt, nodeId));
  selectedInputNodes.forEach(srcNode => {
    const rawPrompt = getCanvasNodePromptText(srcNode);
    if (rawPrompt) {
      connectedPrompts.push(resolveCanvasAtMentionText(rawPrompt, srcNode.id));
      getCanvasAtMentionImageRefs(rawPrompt, srcNode.id).forEach(url => connectedImages.push({ url, name: srcNode.assetName || srcNode.title || '参考图' }));
    }
    getCanvasNodeProviderSources(srcNode, 'asset').forEach(url => connectedImages.push({ url, name: srcNode.assetName || srcNode.title || '参考图' }));
    getCanvasNodeProviderSources(srcNode, 'video').forEach(url => connectedVideos.push({ url, name: srcNode.title || '参考视频' }));
    getCanvasNodeProviderSources(srcNode, 'audio').forEach(url => connectedAudios.push({ url, name: srcNode.title || '参考音频' }));
  });
  if (connectedPrompts.length === 0 && connectedImages.length === 0 && connectedVideos.length === 0 && connectedAudios.length === 0) {
    const pendingUpstreamCount = selectedInputNodes.filter(inputNode => ['submitting', 'generating'].includes(inputNode.status)).length;
    node.status = 'failed';
    node.progress = 0;
    node.errorMsg = pendingUpstreamCount
      ? `未提交：${pendingUpstreamCount} 个上游节点仍在生成，且当前节点没有可用提示词或参考素材`
      : '未提交：请填写当前节点提示词，或在“输入”中选择含提示词、图片、视频或音频的上游节点';
    renderCanvasNodesAndLines();
    showToast(node.errorMsg, 'warning');
    return;
  }
  const promptSummary = connectedPrompts.join(' ; ');
  const model = getPreferredServerModel('canvas', 'video', node.model);
  if (!model) {
    node.status = 'failed';
    node.errorMsg = '画布模式暂无可用视频模型，请联系管理员启用模型';
    renderCanvasNodesAndLines();
    showToast(node.errorMsg, 'error');
    return;
  }
  node.model = model;
  const aspectRatio = node.aspect || '16:9';
  const requestedDuration = parseInt(node.duration || 15, 10);
  const duration = isCustomDurationVideoModel(model)
    ? clampVideoDuration(requestedDuration, 4, 30, 5)
    : requestedDuration;
  node.duration = duration;
  const options = {
    model,
    aspectRatio,
    duration,
    images: [...new Set(connectedImages.map(image => image.url))],
    videos: [...new Set(connectedVideos.map(video => video.url))].slice(0, 3),
    audios: [...new Set(connectedAudios.map(audio => audio.url))]
  };

  let originSession = null;
  try {
    originSession = await SessionSystem.ensureActivePersisted();
  } catch (error) {
    console.error('保存画布会话失败:', error);
  }
  const originSessionId = originSession?.type === 'canvas' ? originSession.id : null;
  if (!originSessionId) {
    node.status = 'failed';
    node.errorMsg = '未提交：无法保存当前画布会话';
    renderCanvasNodesAndLines();
    showToast(node.errorMsg, 'error');
    return;
  }
  if (!BackendClient.isAuthenticated()) {
    const errMsg = '请先登录后再提交生成任务。';
    node.status = 'failed';
    node.errorMsg = errMsg;
    const failedTask = SessionSystem.assignTask({
      source: 'canvas',
      mediaType: 'video',
      canvasNodeId: nodeId,
      taskId: `canvas_err_${Date.now()}`,
      prompt: promptSummary,
      model: model,
      duration: duration,
      options: options,
      status: 'failed',
      progress: 100,
      createdAt: Date.now(),
      errorMsg: errMsg,
      sessionId: originSessionId,
      sessionType: 'canvas'
    }, 'canvas');
    saveTaskToHistory(failedTask);
    void SessionSystem.handleTaskFinished(failedTask, 'failed').catch(error => console.warn('Canvas task session save failed:', error));
    if (SessionSystem.getActive()?.id === originSessionId) {
      renderCanvasNodesAndLines();
      drawCanvasLines();
    }
    showToast(`❌ 提交失败: ${errMsg}`, 'error');
    return;
  }

  // 2. 真实发起 API 提交
  showToast(`🚀 正在向服务器提交视频渲染请求 (模型: ${model}, 比例: ${aspectRatio})...`, 'info');
  
  let taskId = null;
  let submitResponse = null;

  const submitController = new AbortController();
  SessionSystem.registerPendingRequest(originSessionId, submitController);
  try {
    submitResponse = await apiSubmitVideo(promptSummary, {
      ...options,
      mode: 'canvas',
      sessionId: originSessionId,
      canvasNodeId: nodeId,
      signal: submitController.signal
    });
    if (submitController.signal.aborted) throw new DOMException('提交已取消', 'AbortError');
    taskId = extractVideoTaskId(submitResponse);
    if (!taskId) throw new Error('接口未返回有效任务 ID，请检查供应商响应格式');
  } catch (err) {
    const errMsg = submitController.signal.aborted ? '提交已取消' : (err.message || err.toString() || '视频 API 提交失败');
    console.error('❌ 画布视频 API 提交失败:', err);
    node.status = 'failed';
    node.errorMsg = errMsg;
    node.progress = 0;
    
    const failedTask = SessionSystem.assignTask({
      source: 'canvas',
      mediaType: 'video',
      canvasNodeId: nodeId,
      taskId: `canvas_err_${Date.now()}`,
      prompt: promptSummary,
      model: model,
      duration: duration,
      options: options,
      status: 'failed',
      progress: 100,
      createdAt: Date.now(),
      errorMsg: errMsg,
      sessionId: originSessionId,
      sessionType: 'canvas'
    }, 'canvas');
    saveTaskToHistory(failedTask);
    void SessionSystem.handleTaskFinished(failedTask, 'failed').catch(error => console.warn('Canvas task session save failed:', error));
    
    if (SessionSystem.getActive()?.id === originSessionId) {
      renderCanvasNodesAndLines();
      drawCanvasLines();
    }
    showToast(`❌ 视频 API 提交失败: ${errMsg}`, 'error');
    return;
  } finally {
    SessionSystem.unregisterPendingRequest(originSessionId, submitController);
  }

  // 3. 提交成功，推入全局生成队列并开启真实状态轮询
  const newTask = SessionSystem.assignTask({
    source: 'canvas',
    mediaType: 'video',
    canvasNodeId: nodeId,
    taskId: taskId,
    backendTaskId: taskId,
    requestId: submitResponse?.requestId || null,
    prompt: promptSummary,
    model: model,
    duration: duration,
    options: options,
    status: 'rendering',
    progress: 5,
    createdAt: Date.now(),
    sessionId: originSessionId,
    sessionType: 'canvas'
  }, 'canvas');
  if (!state.activeTasks) state.activeTasks = [];
  state.activeTasks.unshift(newTask);
  updateStatusIndicators();
  updateTaskQueueUI();
  void SessionSystem.trackTask(newTask).catch(error => console.warn('Canvas task session save failed:', error));

  // 提交结果始终写回原画布会话；只有原会话仍打开时才更新当前 DOM。
  await SessionSystem.updateSessionData(originSessionId, data => {
    const targetNode = (data.nodes || []).find(item => item.id === nodeId);
    if (targetNode) Object.assign(targetNode, { status: 'generating', progress: 5, taskId, errorMsg: null });
    return data;
  });
  if (SessionSystem.getActive()?.id === originSessionId) {
    const activeNode = canvasState.nodes.find(item => item.id === nodeId);
    if (activeNode) Object.assign(activeNode, { status: 'generating', progress: 5, taskId, errorMsg: null });
    renderCanvasNodesAndLines();
    drawCanvasLines();
  }

  showToast(`✅ 已成功提交渲染任务！Task ID: ${taskId}`, 'success');

  startCanvasVideoTaskPoller(newTask, node);
}
window.runCanvasVideoGeneration = runCanvasVideoGeneration;

// 渲染抽屉
function renderCanvasDrawer() {
  const drawer = document.getElementById('canvasDrawer');
  const contentEl = document.getElementById('canvasDrawerContent');
  const drawerHeaderTitle = document.querySelector('#canvasDrawer .canvas-drawer-header span');
  const drawerTabs = document.querySelector('#canvasDrawer .canvas-drawer-tabs');
  if (!contentEl) return;

  if (drawer) {
    if (canvasState.isDrawerClosed) {
      drawer.classList.add('closed');
    } else {
      drawer.classList.remove('closed');
    }
  }

  initAssetAndPromptData();

  if (canvasState.activeDrawerTab === 'templates') {
    if (drawerHeaderTitle) drawerHeaderTitle.textContent = '🎨 预设模板';
    if (drawerTabs) drawerTabs.style.display = 'none';

    contentEl.innerHTML = CANVAS_PRESET_TEMPLATES.map(tpl => `
      <div class="drawer-item-card" data-template-id="${tpl.id}" style="flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px; border-radius: 12px; background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.03); cursor: pointer;">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <span class="drawer-item-name" style="font-size: 0.875rem; font-weight: 700; color: #0f172a;">${tpl.name}</span>
          <button type="button" class="btn btn-primary btn-sm" style="font-size: 0.75rem; padding: 4px 10px; border-radius: 8px;">+ 添加</button>
        </div>
        <span class="drawer-item-sub" style="font-size: 0.775rem; color: #64748b; line-height: 1.4;">${tpl.desc}</span>
      </div>
    `).join('');

    contentEl.querySelectorAll('.drawer-item-card').forEach(card => {
      card.onclick = () => {
        const tplId = card.dataset.templateId;
        const targetTpl = CANVAS_PRESET_TEMPLATES.find(t => t.id === tplId);
        if (targetTpl) {
          // 在原画布基础上追加预设模板节点 (不覆盖已有节点)
          if (!canvasState.nodes) canvasState.nodes = [];
          if (!canvasState.connections) canvasState.connections = [];

          // 计算新添加节点的水平位移 (拼接在现有节点的最右侧，避免重叠)
          let offsetX = 0;
          if (canvasState.nodes.length > 0) {
            const maxX = Math.max(...canvasState.nodes.map(n => n.x + (n.width || 300)));
            const minTplX = Math.min(...targetTpl.nodes.map(n => n.x));
            offsetX = (maxX + 80) - minTplX;
          }

          // ID 重新映射，生成全新唯一 ID 避免冲突
          const idMap = {};
          const newNodes = targetTpl.nodes.map((origNode, idx) => {
            const newId = `node_tpl_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`;
            idMap[origNode.id] = newId;
            const nodeCopy = JSON.parse(JSON.stringify(origNode));
            nodeCopy.id = newId;
            nodeCopy.x = (nodeCopy.x || 0) + offsetX;
            return nodeCopy;
          });

          // 重新映射新节点的连线
          const newConnections = targetTpl.connections.map(origConn => ({
            fromId: idMap[origConn.fromId] || origConn.fromId,
            toId: idMap[origConn.toId] || origConn.toId
          })).filter(c => c.fromId && c.toId);

          // 追加节点与连线
          canvasState.nodes.push(...newNodes);
          canvasState.connections.push(...newConnections);

          // 关键：默认将新添加进来的这些预设节点全部设为【选中】状态
          const newAddedNodeIds = newNodes.map(n => n.id);
          canvasState.selectedNodeIds = newAddedNodeIds;

          saveCanvasState();
          renderCanvasNodesAndLines();
          showToast(`已将【${targetTpl.name}】追加添加到画布并选中！`, 'success');
        }
      };
    });
    return;
  }

  if (drawerHeaderTitle) drawerHeaderTitle.textContent = '📦 资产库';
  if (drawerTabs) drawerTabs.style.display = 'flex';

  document.querySelectorAll('.drawer-tab').forEach(tab => {
    if ((tab.id === 'tabDrawerAssets' && canvasState.activeDrawerTab === 'assets') ||
        (tab.id === 'tabDrawerPrompts' && canvasState.activeDrawerTab === 'prompts')) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  if (canvasState.activeDrawerTab === 'assets') {
    const curCat = canvasState.drawerAssetCategory || 'all';
    
    // 1. 渲染分类 Pills
    const categoryBarHtml = `
      <div class="drawer-category-filter-bar">
        <button type="button" class="drawer-cat-btn ${curCat === 'all' ? 'active' : ''}" data-cat="all">📦 全部</button>
        <button type="button" class="drawer-cat-btn ${curCat === '人物' ? 'active' : ''}" data-cat="人物">👤 人物</button>
        <button type="button" class="drawer-cat-btn ${curCat === '道具' ? 'active' : ''}" data-cat="道具">⚒️ 道具</button>
        <button type="button" class="drawer-cat-btn ${curCat === '场景' ? 'active' : ''}" data-cat="场景">🏙️ 场景</button>
        <button type="button" class="drawer-cat-btn ${curCat === 'uploaded' ? 'active' : ''}" data-cat="uploaded">☁️ 已上传</button>
      </div>
    `;

    // 2. 组合资产库 items (完全实时同步 state.assets 与 state.uploadedResources 真实数据)
    let displayList = [];
    const allAssets = state.assets || [];
    const allUploaded = state.uploadedResources || [];

    if (curCat === 'uploaded') {
      displayList = allUploaded.map(r => ({
        id: r.id,
        name: r.name || '已上传参考资源',
        category: '已上传',
        imageUrl: r.url,
        mediaReference: r.mediaReference || r.reference || '',
        mediaId: r.mediaId || null,
        media: [{ ...r, id: r.mediaId || r.id, reference: r.mediaReference || r.reference || '' }],
        primaryMedia: { ...r, id: r.mediaId || r.id, reference: r.mediaReference || r.reference || '' },
        isUploadedResource: true
      }));
    } else if (curCat === 'all') {
      const mappedAssets = allAssets.map(a => ({ ...a }));
      const mappedUploaded = allUploaded.map(r => ({
        id: r.id,
        name: r.name || '已上传参考资源',
        category: '已上传',
        imageUrl: r.url,
        mediaReference: r.mediaReference || r.reference || '',
        mediaId: r.mediaId || null,
        media: [{ ...r, id: r.mediaId || r.id, reference: r.mediaReference || r.reference || '' }],
        primaryMedia: { ...r, id: r.mediaId || r.id, reference: r.mediaReference || r.reference || '' },
        isUploadedResource: true
      }));
      displayList = [...mappedAssets, ...mappedUploaded];
    } else {
      displayList = allAssets.filter(a => a.category === curCat);
    }

    if (displayList.length === 0) {
      contentEl.innerHTML = categoryBarHtml + '<div style="padding:24px 16px; text-align:center; color:#94a3b8; font-size:0.8rem;">暂无该分类的资产数据</div>';
    } else {
      contentEl.innerHTML = categoryBarHtml + '<div class="drawer-item-list" style="display:flex; flex-direction:column; gap:8px; padding:10px;">' + displayList.map(a => `
        <div class="drawer-item-card" data-asset-id="${a.id}">
          ${a.primaryMedia?.type === 'video' ? `<span class="drawer-item-img drawer-media-icon">▶</span>` : a.primaryMedia?.type === 'audio' ? `<span class="drawer-item-img drawer-media-icon">♫</span>` : `<img src="${a.imageUrl || a.primaryMedia?.url || 'assets/logo_brand.png'}" class="drawer-item-img" alt="${escapeHTML(a.name)}" />`}
          <div class="drawer-item-info">
            <span class="drawer-item-name">${escapeHTML(a.name)}</span>
            <span class="drawer-item-sub">分类: ${escapeHTML(a.category || '通用')}</span>
          </div>
          <span style="font-size:0.75rem; color:#2563eb; font-weight:600;">+ 拖入</span>
        </div>
      `).join('') + '</div>';
    }

    // 绑定分类 Filter 按钮点击
    contentEl.querySelectorAll('.drawer-cat-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        canvasState.drawerAssetCategory = btn.dataset.cat;
        renderCanvasDrawer();
      };
    });

    // 绑定资产卡片点击拖入画布
    contentEl.querySelectorAll('.drawer-item-card').forEach(card => {
      card.onclick = () => {
        const assetId = card.dataset.assetId;
        const targetAsset = displayList.find(a => a.id === assetId);
        if (targetAsset) {
          addAssetMediaToCanvas(targetAsset);
          showToast(`已成功添加【${targetAsset.name}】资产节点`, 'success');
        }
      };
    });

  } else {
    const prompts = state.promptTemplates || [];
    if (prompts.length === 0) {
      contentEl.innerHTML = '<div style="padding:16px; text-align:center; color:#94a3b8; font-size:0.8rem;">暂无提示词库素材</div>';
      return;
    }
    contentEl.innerHTML = '<div class="drawer-item-list" style="display:flex; flex-direction:column; gap:8px; padding:10px;">' + prompts.map(p => `
      <div class="drawer-item-card" data-prompt-id="${p.id}">
        <div class="drawer-item-info">
          <span class="drawer-item-name">📝 ${escapeHTML(p.title || '提示词模板')}</span>
          <span class="drawer-item-sub">${escapeHTML(p.prompt ? p.prompt.slice(0, 30) + '...' : '')}</span>
        </div>
        <span style="font-size:0.75rem; color:#2563eb; font-weight:600;">+ 引入</span>
      </div>
    `).join('') + '</div>';

    contentEl.querySelectorAll('.drawer-item-card').forEach(card => {
      card.onclick = () => {
        const pId = card.dataset.promptId;
        const targetP = prompts.find(p => p.id === pId);
        if (targetP) {
          const center = getCanvasViewportCenterPos();
          addCanvasNode({
            id: 'node_text_' + Date.now(),
            type: 'text',
            x: center.x,
            y: center.y,
            title: '📝 ' + (targetP.title || '提示词'),
            content: targetP.prompt
          });
          showToast('已成功引入【提示词库】节点', 'success');
        }
      };
    });
  }
}
window.renderCanvasDrawer = renderCanvasDrawer;

function getCanvasContentNodeMeta(node) {
  if (node.type === 'text') return { icon: 'T', label: (node.title || '文本').replace(/^[🤖📝🖼️🎬\s]+/, '') || '文本' };
  if (node.type === 'asset') return { icon: '▣', label: (node.title || node.assetName || '图片').replace(/^[🤖📝🖼️🎬\s]+/, '') || '图片' };
  if (node.type === 'audio') return { icon: '♫', label: (node.title || node.assetName || '音频').replace(/^[🤖📝🖼️🎬🎧\s]+/, '') || '音频' };
  return { icon: '▸', label: (node.title || '视频').replace(/^[🤖📝🖼️🎬\s]+/, '') || '视频' };
}

function updateCanvasNodePrompt(nodeId, value) {
  const node = canvasState.nodes.find(item => item.id === nodeId);
  if (!node) return;
  node.prompt = value;
  saveCanvasState();
}
window.updateCanvasNodePrompt = updateCanvasNodePrompt;

function beginCanvasNodeRename(nodeId, labelElement, event) {
  event?.preventDefault();
  event?.stopPropagation();
  const node = canvasState.nodes.find(item => item.id === nodeId);
  if (!node || !labelElement || labelElement.querySelector('input')) return;
  const meta = getCanvasContentNodeMeta(node);
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'canvas-node-type-name-input';
  input.value = meta.label;
  labelElement.replaceChildren(input);
  input.focus();
  input.select();
  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    const nextTitle = input.value.trim() || meta.label;
    const prefix = node.type === 'text' ? '📝 ' : node.type === 'asset' ? '🖼️ ' : node.type === 'audio' ? '🎧 ' : '🎬 ';
    node.title = `${prefix}${nextTitle}`;
    saveCanvasState();
    renderCanvasNodesAndLines();
  };
  input.addEventListener('keydown', keyboardEvent => {
    if (keyboardEvent.key === 'Enter') commit();
    if (keyboardEvent.key === 'Escape') {
      committed = true;
      renderCanvasNodesAndLines();
    }
  });
  input.addEventListener('blur', commit);
}
window.beginCanvasNodeRename = beginCanvasNodeRename;

function renderCanvasContentNodeLabel(node) {
  const meta = getCanvasContentNodeMeta(node);
  return `<div class="canvas-node-type-label" ondblclick="beginCanvasNodeRename('${node.id}', this, event)" title="双击重命名"><span>${meta.icon}</span><strong>${escapeHTML(meta.label)}</strong></div>`;
}

function renderCanvasTextNodeComposer(node, inputControlHtml) {
  const isExpanding = !!canvasNodeExpandingState[node.id];
  const hasExpanded = !!(node.rawContent && node.content && node.content !== node.rawContent);
  const buttonText = isExpanding ? '⏳ 扩写中...' : (hasExpanded ? '✨ 重新优化' : '✨ AI扩写');
  return `<div class="canvas-node-composer canvas-text-node-composer" data-node-id="${node.id}" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onwheel="event.stopPropagation()">
    ${renderCanvasSelectedInputChips(node)}
    <div class="canvas-composer-editor canvas-node-editor canvas-node-content-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="输入文本内容，或使用 @ 引用已接入的图片/视频" onfocus="rememberCanvasEditorSelection('${node.id}', this)" oninput="onCanvasNodeEditorInput('${node.id}', this)" onkeydown="onCanvasNodeEditorKeydown(event, '${node.id}')" onkeyup="onCanvasNodeEditorKeyup(event, '${node.id}')" onclick="onCanvasNodeEditorClick(event, '${node.id}')" onpaste="onCanvasNodeEditorPaste(event, '${node.id}')">${node.content ? renderCanvasNodeContentWithMentions(node.content, node.id) : ''}</div>
    <div class="canvas-composer-toolbar">
      <div class="canvas-composer-tools">
        ${renderCanvasNodeModelPicker(node, 'llm')}
        ${inputControlHtml}
        <button type="button" class="canvas-composer-tool" onclick="openCanvasPromptPicker('${node.id}')">📚 提示词库</button>
        <button type="button" class="canvas-composer-tool btn-ai-expand-canvas" data-node-id="${node.id}" ${isExpanding ? 'disabled' : ''}>${buttonText}</button>
      </div>
    </div>
  </div>`;
}

function renderCanvasAssetNodeComposer(node, inputControlHtml, isGenerating) {
  return `<div class="canvas-node-composer canvas-media-node-composer" data-node-id="${node.id}" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onwheel="event.stopPropagation()">
    ${renderCanvasSelectedInputChips(node)}
    <div class="canvas-composer-editor canvas-node-editor canvas-node-prompt-editor ${isGenerating ? 'is-disabled' : ''}" contenteditable="${isGenerating ? 'false' : 'true'}" role="textbox" aria-multiline="true" data-placeholder="描述想要生成的图片内容，可使用 @ 引用已接入的图片/视频" onfocus="rememberCanvasEditorSelection('${node.id}', this)" oninput="onCanvasNodePromptEditorInput('${node.id}', this)" onkeydown="onCanvasNodeEditorKeydown(event, '${node.id}')" onkeyup="onCanvasNodeEditorKeyup(event, '${node.id}')" onclick="onCanvasNodeEditorClick(event, '${node.id}')" onpaste="onCanvasNodeEditorPaste(event, '${node.id}')">${node.prompt ? renderCanvasNodeContentWithMentions(node.prompt, node.id) : ''}</div>
    <div class="canvas-composer-toolbar">
      <div class="canvas-composer-tools">
        ${renderCanvasNodeModelPicker(node, 'image')}
        ${inputControlHtml}
        <button type="button" class="canvas-composer-tool" onclick="triggerCanvasNodeUpload('${node.id}')" ${isGenerating ? 'disabled' : ''}>⬆ 上传</button>
        <button type="button" class="canvas-composer-tool" onclick="openCanvasAssetPicker('${node.id}')" ${isGenerating ? 'disabled' : ''}>📦 资产库</button>
      </div>
      <button type="button" class="canvas-composer-send" onclick="runCanvasImageGeneration('${node.id}')" ${isGenerating ? 'disabled' : ''} aria-label="发送图片生成请求">
        <span>${isGenerating ? '生成中' : '➤ 发送'}</span>
        <small id="canvas-image-price-${node.id}">--</small>
      </button>
    </div>
  </div>`;
}

function renderCanvasVideoNodeComposer(node, inputControlHtml, isGenerating) {
  const canvasVideoModel = getPreferredServerModel('canvas', 'video', node.model);
  const durationSpec = getCanvasVideoDurationSpec(canvasVideoModel, node.duration);
  return `<div class="canvas-node-composer canvas-media-node-composer canvas-video-node-composer" data-node-id="${node.id}" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onwheel="event.stopPropagation()">
    ${renderCanvasSelectedInputChips(node)}
    <div class="canvas-composer-editor canvas-node-editor canvas-node-prompt-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="描述想要生成的视频内容，可使用 @ 引用已接入的图片/视频" onfocus="rememberCanvasEditorSelection('${node.id}', this)" oninput="onCanvasNodePromptEditorInput('${node.id}', this)" onkeydown="onCanvasNodeEditorKeydown(event, '${node.id}')" onkeyup="onCanvasNodeEditorKeyup(event, '${node.id}')" onclick="onCanvasNodeEditorClick(event, '${node.id}')" onpaste="onCanvasNodeEditorPaste(event, '${node.id}')">${node.prompt ? renderCanvasNodeContentWithMentions(node.prompt, node.id) : ''}</div>
    <div class="canvas-composer-video-settings">
      <div class="canvas-video-model-dropdown" data-node-id="${node.id}">
        <button type="button" class="canvas-video-model-trigger" aria-label="视频生成模型" aria-expanded="false" onclick="toggleCanvasVideoModelDropdown('${node.id}', event)">
          <span class="canvas-video-model-dot"></span><span class="canvas-video-model-label">${escapeHTML(getServerModelLabel('canvas', 'video', canvasVideoModel) || '暂无可用视频模型')}</span><span class="canvas-video-model-chevron">⌄</span>
        </button>
        <div class="canvas-video-model-menu">${getCanvasVideoModelOptionsHtml(node)}</div>
      </div>
      <div class="canvas-composer-setting-group"><span>比例</span><div class="canvas-video-pill-group">
        <button type="button" class="pill-opt ${node.aspect === '16:9' || !node.aspect ? 'active' : ''}" onclick="onCanvasVideoNodeParamChange('${node.id}', 'aspect', '16:9')">16:9</button>
        <button type="button" class="pill-opt ${node.aspect === '9:16' ? 'active' : ''}" onclick="onCanvasVideoNodeParamChange('${node.id}', 'aspect', '9:16')">9:16</button>
        <button type="button" class="pill-opt ${node.aspect === '1:1' ? 'active' : ''}" onclick="onCanvasVideoNodeParamChange('${node.id}', 'aspect', '1:1')">1:1</button>
      </div></div>
      <div class="canvas-composer-setting-group"><span>时长</span>
        <div class="canvas-video-duration-slider"><div class="canvas-video-duration-input-box" title="输入秒数；悬停显示滑杆"><input type="number" aria-label="视频时长秒数" min="${durationSpec.min}" max="${durationSpec.max}" step="${durationSpec.step}" value="${durationSpec.value}" oninput="syncCanvasVideoDurationControl('${node.id}', this.value, 'number', false)" onchange="syncCanvasVideoDurationControl('${node.id}', this.value, 'number', true)" onblur="syncCanvasVideoDurationControl('${node.id}', this.value, 'number', true)"><span>秒</span></div><div class="canvas-video-duration-popover"><input type="range" aria-label="视频时长滑杆" min="${durationSpec.min}" max="${durationSpec.max}" step="${durationSpec.step}" value="${durationSpec.value}" oninput="syncCanvasVideoDurationControl('${node.id}', this.value, 'range', false)" onchange="syncCanvasVideoDurationControl('${node.id}', this.value, 'range', true)"></div></div>
      </div>
    </div>
    <div class="canvas-composer-toolbar">
      <div class="canvas-composer-tools">${inputControlHtml}</div>
      <button type="button" class="canvas-composer-send btn-run-canvas-video" data-node-id="${node.id}" ${isGenerating ? 'disabled' : ''} aria-label="发送视频生成请求">
        <span>${isGenerating ? '生成中' : '➤ 发送'}</span><small id="canvas-video-price-${node.id}">--</small>
      </button>
    </div>
  </div>`;
}

function renderCanvasAudioNodeComposer(node, inputControlHtml) {
  return `<div class="canvas-node-composer canvas-media-node-composer canvas-audio-node-composer" data-node-id="${node.id}" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onwheel="event.stopPropagation()">
    ${renderCanvasSelectedInputChips(node)}
    <div class="canvas-composer-toolbar">
      <div class="canvas-composer-tools">${inputControlHtml}</div>
      <button type="button" class="canvas-composer-tool canvas-audio-upload-action" onclick="triggerCanvasAudioNodeUpload('${node.id}')">⬆ 上传音频</button>
    </div>
  </div>`;
}

function renderCanvasContentOnlyNode(node, context) {
  const { isSelected, isGenerating, isPortSelected, inputConnectedClass, outputConnectedClass, widthStyle, heightStyle, resizeHandlesHtml, inputControlHtml } = context;
  let contentHtml = '';
  let composerHtml = '';
  const canShowComposer = isSelected && canvasState.selectedNodeIds.length === 1;
  if (node.type === 'text') {
    contentHtml = `<div class="canvas-pure-content canvas-pure-text">${renderCanvasNodeContentWithMentions(node.content || '文本', node.id)}</div>`;
    if (canShowComposer) composerHtml = renderCanvasTextNodeComposer(node, inputControlHtml);
  } else if (node.type === 'asset') {
    contentHtml = node.imgUrl && !isGenerating ? `<div class="canvas-pure-content canvas-pure-image"><img src="${escapeHTML(node.imgUrl)}" alt="${escapeHTML(node.assetName || '图片')}" draggable="false" ondragstart="event.preventDefault(); event.stopPropagation();" ondblclick="openCanvasImagePreview('${node.id}', event)" title="双击放大预览" />
      <button type="button" class="canvas-node-download-btn" onclick="event.stopPropagation(); downloadCanvasNodeAsset('${node.id}')" title="下载原图">↓</button></div>`
      : `<div class="canvas-pure-content canvas-pure-empty"><span>▧</span><small>${isGenerating ? '图片生成中…' : '图片'}</small></div>`;
    if (node.status === 'failed' && node.errorMsg && !node.imgUrl) contentHtml += `<div class="canvas-content-status is-error">${escapeHTML(node.errorMsg)}</div>`;
    if (isGenerating && Number(node.progress || 0) < 100) contentHtml += `<div class="canvas-content-progress canvas-image-content-progress" role="progressbar" aria-label="图片生成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${node.progress || 5}"><i id="progress-fill-${node.id}" style="width:${node.progress || 5}%"></i><span id="progress-text-${node.id}">图片生成进行中 ${node.progress || 5}%</span></div>`;
    if (canShowComposer) composerHtml = renderCanvasAssetNodeComposer(node, inputControlHtml, isGenerating);
  } else if (node.type === 'audio') {
    contentHtml = node.audioUrl
      ? `<div class="canvas-pure-content canvas-pure-audio"><span class="canvas-audio-node-icon">♫</span><audio src="${escapeHTML(node.audioUrl)}" controls preload="metadata"></audio><button type="button" class="canvas-node-download-btn" onclick="event.stopPropagation(); downloadCanvasNodeAsset('${node.id}')" title="下载音频">↓</button></div>`
      : `<div class="canvas-pure-content canvas-pure-empty canvas-audio-empty" onclick="triggerCanvasAudioNodeUpload('${node.id}')"><span>♫</span><small>点击上传音频</small></div>`;
    if (node.status === 'uploading') contentHtml += `<div class="canvas-content-progress"><i style="width:${node.uploadProgress || 1}%"></i><span id="upload-progress-text-${node.id}">上传中 ${node.uploadProgress || 0}%</span></div>`;
    if (node.status === 'failed' && node.errorMsg) contentHtml += `<div class="canvas-content-status is-error">${escapeHTML(node.errorMsg)}</div>`;
    if (canShowComposer) composerHtml = renderCanvasAudioNodeComposer(node, inputControlHtml);
  } else {
    contentHtml = node.videoUrl && !isGenerating ? `<div class="canvas-pure-content canvas-pure-video canvas-video-awaiting-play"><video data-canvas-video-key="node:${escapeHTML(node.id)}" data-lazy-video-src="${escapeHTML(node.videoUrl)}" muted loop playsinline preload="none" draggable="false" onloadedmetadata="prepareCanvasVideoCover(this)" onloadeddata="prepareCanvasVideoCover(this)" onseeked="prepareCanvasVideoCover(this)" onplay="syncCanvasVideoPreviewState(this)" onpause="syncCanvasVideoPreviewState(this)" onended="syncCanvasVideoPreviewState(this)" ondragstart="event.preventDefault(); event.stopPropagation();"></video>
      <button type="button" class="canvas-video-cover-play" onclick="playCanvasVideoPreview(event, this)" aria-label="播放视频" title="播放视频"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor"></path></svg></button>
      <button type="button" class="canvas-node-download-btn" onclick="event.stopPropagation(); downloadCanvasNodeAsset('${node.id}')" title="下载原视频">↓</button></div>`
      : `<div class="canvas-pure-content canvas-pure-empty canvas-video-empty"><span>▶</span><small>${isGenerating ? '视频生成中…' : '视频'}</small></div>`;
    if (node.status === 'failed' && !node.videoUrl) contentHtml += `<div class="canvas-content-status is-error">${escapeHTML(node.errorMsg || '视频生成失败')}</div>`;
    if (isGenerating && Number(node.progress || 0) < 100) contentHtml += `<div class="canvas-content-progress"><i id="progress-fill-${node.id}" style="width:${node.progress || 5}%"></i><span id="progress-text-${node.id}">${node.progress || 5}%</span></div>`;
    if (canShowComposer) composerHtml = renderCanvasVideoNodeComposer(node, inputControlHtml, isGenerating);
  }
  const assetDropAttributes = node.type === 'asset' && !isGenerating
    ? `data-canvas-image-drop-target="${node.id}" ondragenter="handleCanvasNodeImageDragEnter('${node.id}', event)" ondragover="handleCanvasNodeImageDragOver('${node.id}', event)" ondragleave="handleCanvasNodeImageDragLeave('${node.id}', event)" ondrop="handleCanvasNodeImageDrop('${node.id}', event)"`
    : '';
  return `<div class="canvas-node canvas-content-only-node canvas-content-${node.type} ${node.mediaAutoSized ? 'media-native-ratio' : ''} ${isSelected ? 'selected' : ''} ${isGenerating ? 'generating-neon-border' : ''} ${canvasState.openInputNodeId === node.id ? 'input-panel-open' : ''}" id="${node.id}" style="left:${node.x}px; top:${node.y}px; ${widthStyle} ${heightStyle}">
    ${resizeHandlesHtml}${renderCanvasContentNodeLabel(node)}
    <div class="canvas-port input ${inputConnectedClass} ${isPortSelected && canvasState.selectedPort?.portType === 'input' ? 'selected' : ''}" data-node-id="${node.id}" data-port-type="input" title="输入端"></div>
    <div class="canvas-content-frame ${node.type === 'asset' && !isGenerating ? 'canvas-asset-drop-target' : ''}" ${assetDropAttributes}>${contentHtml}</div>
    <div class="canvas-port output ${outputConnectedClass} ${isPortSelected && canvasState.selectedPort?.portType === 'output' ? 'selected' : ''}" data-node-id="${node.id}" data-port-type="output" title="输出端"></div>
    ${composerHtml}
  </div>`;
}

function captureCanvasStableVideoElements(container) {
  const preserved = new Map();
  container.querySelectorAll('video[data-canvas-video-key]').forEach(video => {
    const key = video.dataset.canvasVideoKey;
    if (key && !preserved.has(key)) preserved.set(key, video);
  });
  return preserved;
}

function restoreCanvasStableVideoElements(container, preserved) {
  if (!preserved?.size) return;
  container.querySelectorAll('video[data-canvas-video-key]').forEach(nextVideo => {
    const previousVideo = preserved.get(nextVideo.dataset.canvasVideoKey);
    if (!previousVideo) return;
    if (getManagedVideoSource(previousVideo) !== getManagedVideoSource(nextVideo)) return;
    nextVideo.replaceWith(previousVideo);
    syncCanvasVideoPreviewState(previousVideo);
  });
}

function syncCanvasVideoPreviewState(video) {
  if (!(video instanceof HTMLVideoElement)) return;
  const wrapper = video.closest('.canvas-pure-video');
  if (!wrapper) return;
  wrapper.classList.toggle('canvas-video-awaiting-play', video.dataset.managedVideoActive !== '1');
  wrapper.classList.toggle('is-video-playing', !video.paused && !video.ended);
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) wrapper.classList.remove('canvas-video-cover-loading');
}
window.syncCanvasVideoPreviewState = syncCanvasVideoPreviewState;

function prepareCanvasVideoCover(video) {
  if (!(video instanceof HTMLVideoElement)) return;
  const wrapper = video.closest('.canvas-pure-video');
  if (!wrapper) return;
  applyCanvasVideoElementDimensions(video);
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) wrapper.classList.remove('canvas-video-cover-loading');
  if (video.paused && video.readyState >= HTMLMediaElement.HAVE_METADATA && video.dataset.coverFrameRequested !== '1') {
    video.dataset.coverFrameRequested = '1';
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const coverTime = duration > 0 ? Math.min(0.08, Math.max(0.01, duration / 100)) : 0.01;
    try { video.currentTime = coverTime; } catch (error) {}
  }
  syncCanvasVideoPreviewState(video);
}
window.prepareCanvasVideoCover = prepareCanvasVideoCover;

function playCanvasVideoPreview(event, button) {
  event?.preventDefault();
  event?.stopPropagation();
  const wrapper = button?.closest('.canvas-pure-video');
  const video = wrapper?.querySelector('video');
  if (!(video instanceof HTMLVideoElement)) return;
  video.controls = true;
  activateManagedVideo(video);
  pauseOtherManagedVideos(video);
  void video.play().then(() => syncCanvasVideoPreviewState(video)).catch(error => {
    syncCanvasVideoPreviewState(video);
    showToast(`视频暂时无法播放：${error.message}`, 'error');
  });
}
window.playCanvasVideoPreview = playCanvasVideoPreview;

// 渲染节点 HTML (支持 📝 / 🖼️ 固定标签、提示词库导入、AI扩写、素材库导入及 4角 Resize)
function renderCanvasNodesAndLines() {
  const container = document.getElementById('canvasNodesContainer');
  const svgLayer = document.getElementById('canvasSvgLayer');
  if (!container || !svgLayer) return;

  applyCanvasTransform();
  updateCanvasBulkStartButton();

  const isInputConnected = (nodeId) => canvasState.connections.some(c => c.toId === nodeId);
  const isOutputConnected = (nodeId) => canvasState.connections.some(c => c.fromId === nodeId);

  const preservedVideos = captureCanvasStableVideoElements(container);
  unobserveManagedVideos(container);
  container.innerHTML = canvasState.nodes.map(node => {
    const isSelected = canvasState.selectedNodeIds.includes(node.id);
    const isGenerating = ['submitting', 'generating'].includes(node.status);
    const isPortSelected = canvasState.selectedPort && canvasState.selectedPort.nodeId === node.id;
    const inputConnectedClass = isInputConnected(node.id) ? 'connected' : '';
    const outputConnectedClass = isOutputConnected(node.id) ? 'connected' : '';

    const widthStyle = node.width ? `width: ${node.width}px;` : ((node.type === 'video' || node.type === 'audio') ? 'width: 330px;' : 'width: 300px;');
    const heightStyle = node.height ? `height: ${node.height}px;` : '';
    syncCanvasNodeInputSelection(node.id, false);
    const inputControlHtml = renderCanvasInputControl(node);

    const resizeHandlesHtml = isSelected ? `
      <div class="resize-handle tl" data-node-id="${node.id}" data-handle="tl"></div>
      <div class="resize-handle tr" data-node-id="${node.id}" data-handle="tr"></div>
      <div class="resize-handle bl" data-node-id="${node.id}" data-handle="bl"></div>
      <div class="resize-handle br" data-node-id="${node.id}" data-handle="br"></div>
    ` : '';

    if (node.type === 'text' || node.type === 'asset' || node.type === 'video' || node.type === 'audio') {
      return renderCanvasContentOnlyNode(node, {
        isSelected,
        isGenerating,
        isPortSelected,
        inputConnectedClass,
        outputConnectedClass,
        widthStyle,
        heightStyle,
        resizeHandlesHtml,
        inputControlHtml
      });
    }

    if (node.type === 'text') {
      const cleanTitle = (node.title || '提示词节点').replace(/^[🤖📝🖼️🎬\s]+/, '');
      const isExpanding = !!canvasNodeExpandingState[node.id];
      const hasExpanded = !!(node.rawContent && node.content && node.content !== node.rawContent);
      const btnText = isExpanding ? '⏳ 扩写中...' : (hasExpanded ? '✨ 重新优化' : '✨ AI扩写');

      return `
        <div class="canvas-node ${isSelected ? 'selected' : ''} ${isGenerating ? 'generating-neon-border' : ''} ${canvasState.openInputNodeId === node.id ? 'input-panel-open' : ''}" id="${node.id}" style="left: ${node.x}px; top: ${node.y}px; ${widthStyle} ${heightStyle}">
          ${resizeHandlesHtml}
          <div class="canvas-port input ${inputConnectedClass}" data-node-id="${node.id}" data-port-type="input" title="左侧输入端"></div>

          <div class="canvas-node-header">
            <span class="canvas-node-title"><span class="node-title-badge">📝</span> ${escapeHTML(cleanTitle)}</span>
            <button type="button" class="canvas-node-del" onclick="event.stopPropagation(); removeCanvasNode('${node.id}')" title="删除该节点">✕</button>
          </div>

          <div style="display: flex; gap: 6px; padding: 6px 12px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; align-items: center;">
            ${inputControlHtml}
            <button type="button" class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); openCanvasPromptPicker('${node.id}')">📚 从提示词库导入</button>
            <button type="button" class="btn btn-xs btn-ai-expand-canvas" data-node-id="${node.id}" ${isExpanding ? 'disabled' : ''}>${btnText}</button>
          </div>

          <div class="canvas-node-body" style="flex:1; display:flex;">
            <div class="canvas-node-editor" contenteditable="true" style="flex:1;" oninput="onCanvasNodeEditorInput('${node.id}', this)" onkeydown="onCanvasNodeEditorKeydown(event, '${node.id}')" onkeyup="onCanvasNodeEditorKeyup(event, '${node.id}')" onclick="onCanvasNodeEditorClick(event, '${node.id}')" onpaste="onCanvasNodeEditorPaste(event, '${node.id}')">${renderCanvasNodeContentWithMentions(node.content || '', node.id)}</div>
          </div>

          <div class="canvas-port output ${outputConnectedClass} ${isPortSelected && canvasState.selectedPort && canvasState.selectedPort.portType === 'output' ? 'selected' : ''}" data-node-id="${node.id}" data-port-type="output" title="右侧输出端"></div>
        </div>
      `;
    } else if (node.type === 'asset') {
      const cleanTitle = (node.title || node.assetName || '参考图节点').replace(/^[🤖📝🖼️🎬\s]+/, '');

      return `
        <div class="canvas-node ${isSelected ? 'selected' : ''} ${isGenerating ? 'generating-neon-border' : ''} ${canvasState.openInputNodeId === node.id ? 'input-panel-open' : ''}" id="${node.id}" style="left: ${node.x}px; top: ${node.y}px; ${widthStyle} ${heightStyle}">
          ${resizeHandlesHtml}
          <div class="canvas-port input ${inputConnectedClass}" data-node-id="${node.id}" data-port-type="input" title="左侧输入端"></div>

          <div class="canvas-node-header">
            <span class="canvas-node-title"><span class="node-title-badge">🖼️</span> ${escapeHTML(cleanTitle)}</span>
            <button type="button" class="canvas-node-del" onclick="event.stopPropagation(); removeCanvasNode('${node.id}')" title="删除该节点">✕</button>
          </div>

          <div style="display: flex; gap: 6px; padding: 6px 12px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; align-items: center;">
            ${inputControlHtml}
            <button type="button" class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); openCanvasAssetPicker('${node.id}')">📦 从资产库导入</button>
            <button type="button" class="btn btn-primary btn-xs" onclick="event.stopPropagation(); runCanvasImageGeneration('${node.id}')" ${isGenerating ? 'disabled' : ''}>${isGenerating ? '生成中...' : '生成图片'} <span id="canvas-image-price-${node.id}" class="send-price-badge send-price-badge-light">积分预算：--</span></button>
          </div>

          <div class="canvas-node-body canvas-asset-dropzone" data-node-id="${node.id}" ondragover="event.preventDefault(); event.stopPropagation(); this.classList.add('drag-over');" ondragleave="event.preventDefault(); event.stopPropagation(); this.classList.remove('drag-over');" ondrop="event.preventDefault(); event.stopPropagation(); this.classList.remove('drag-over'); handleCanvasNodeImageDrop('${node.id}', event);" style="flex: 1; display: flex; flex-direction: column; padding: 10px; overflow: hidden; min-height: 150px; background: #ffffff; border-bottom-left-radius: 14px; border-bottom-right-radius: 14px;">
            ${node.imgUrl ? `
              <div style="flex: 1; width: 100%; height: 100%; min-height: 140px; overflow: hidden; border-radius: 8px; position: relative; background: #f8fafc;">
                <img src="${node.imgUrl}" class="canvas-node-img-preview" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px; cursor: pointer;" alt="" onclick="triggerCanvasNodeUpload('${node.id}')" title="点击更换图片 / 上传" />
                <button type="button" class="canvas-node-download-btn" onclick="event.stopPropagation(); downloadCanvasNodeAsset('${node.id}')" title="下载原图">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
              </div>
            ` : `
              <div class="canvas-node-upload-box" style="flex: 1; min-height: 140px; border-radius: 8px;" onclick="triggerCanvasNodeUpload('${node.id}')">
                <span style="font-size: 1.4rem;">📷</span>
                <span>点击上传本地图片</span>
              </div>
            `}
            ${node.status === 'failed' && node.errorMsg ? `
              <div style="margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 0.725rem; line-height: 1.4; overflow-wrap: anywhere;">
                ${escapeHTML(node.errorMsg)}
              </div>
            ` : ''}
          </div>

          <div class="canvas-port output ${outputConnectedClass} ${isPortSelected && canvasState.selectedPort && canvasState.selectedPort.portType === 'output' ? 'selected' : ''}" data-node-id="${node.id}" data-port-type="output" title="右侧输出端"></div>
        </div>
      `;
    } else if (node.type === 'agent') {
      const cleanTitle = (node.title || 'AI 智能体节点').replace(/^[🤖📝🖼️🎬\s]+/, '');
      const incomingCount = (canvasState.connections || []).filter(c => c.toId === node.id).length;

      return `
        <div class="canvas-node ${isSelected ? 'selected' : ''} ${isGenerating ? 'generating-neon-border' : ''} ${canvasState.openInputNodeId === node.id ? 'input-panel-open' : ''}" id="${node.id}" style="left: ${node.x}px; top: ${node.y}px; ${widthStyle} ${heightStyle}">
          ${resizeHandlesHtml}
          <div class="canvas-port input ${inputConnectedClass} ${isPortSelected && canvasState.selectedPort && canvasState.selectedPort.portType === 'input' ? 'selected' : ''}" data-node-id="${node.id}" data-port-type="input" title="左侧输入端 (接入上游节点)"></div>

          <div class="canvas-node-header">
            <span class="canvas-node-title"><span class="node-title-badge">🤖</span> ${escapeHTML(cleanTitle)}</span>
            <div class="canvas-node-header-actions">${inputControlHtml}<button type="button" class="canvas-node-del" onclick="event.stopPropagation(); removeCanvasNode('${node.id}')" title="删除该节点">✕</button></div>
          </div>
          <div class="canvas-node-body" style="flex: 1; display: flex; flex-direction: column; padding: 12px; min-height: 0; overflow: hidden; background: #ffffff; border-bottom-left-radius: 14px; border-bottom-right-radius: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-shrink: 0;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #6b21a8;">🤖 智能体指令 / 提示词</span>
              <span style="font-size:0.7rem; color:#94a3b8;">接入 ${incomingCount} 项</span>
            </div>

            <!-- 快捷模式注入栏 (Dramatron 剧情故事大纲 & MoneyPrinter 分镜分解) -->
            <div style="display: flex; gap: 4px; margin-bottom: 6px; flex-shrink: 0;">
              <button type="button" class="btn btn-xs" onclick="event.stopPropagation(); setAgentPresetPrompt('${node.id}', 'outline')" style="flex: 1; font-size: 0.675rem; font-weight: 600; padding: 3px 2px; background: #faf5ff; color: #7c3aed; border: 1px solid #e9d5ff; border-radius: 6px;" title="一键填入 Dramatron 剧情故事大纲提示词">📖 剧情故事大纲</button>
              <button type="button" class="btn btn-xs" onclick="event.stopPropagation(); setAgentPresetPrompt('${node.id}', 'storyboard')" style="flex: 1; font-size: 0.675rem; font-weight: 600; padding: 3px 2px; background: #f0f9ff; color: #0284c7; border: 1px solid #bae6fd; border-radius: 6px;" title="一键填入 MoneyPrinter 画面分镜分解提示词">🎬 画面分镜分解</button>
            </div>

            <textarea class="canvas-node-textarea agent-input-textarea" placeholder="快捷点击上方模式，或自行输入指令..." oninput="onAgentNodePromptInput('${node.id}', this.value)" onclick="event.stopPropagation()" onwheel="event.stopPropagation()" style="height: 50px; min-height: 38px; max-height: 100px; font-size: 0.8rem; padding: 8px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; overflow-y: auto; resize: vertical; flex-shrink: 0;">${escapeHTML(node.systemPrompt || '')}</textarea>

              <button type="button" class="btn btn-sm" onclick="event.stopPropagation(); runCanvasAgentNode('${node.id}')" style="width: 100%; margin-top: 8px; font-weight: 700; background: linear-gradient(135deg, #7c3aed, #2563eb); color: #ffffff; border: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25); flex-shrink: 0;">
              ${isGenerating ? '⏳ 智能体思考分析中...' : '⚡ 运行智能体生成输出'} <span id="canvas-agent-price-${node.id}" class="send-price-badge">积分预算：--</span>
            </button>

            ${node.outputContent ? `
              <div class="agent-output-box" style="margin-top: 10px; flex: 1; min-height: 140px; display: flex; flex-direction: column; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 10px 12px; overflow: hidden;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px; border-bottom: 1px solid #f3e8ff; padding-bottom: 6px; flex-shrink: 0;">
                  <strong style="font-size:0.775rem; color:#6b21a8;">✨ AI 智能体输出结果：</strong>
                  <button type="button" class="btn btn-ghost btn-xs" onclick="event.stopPropagation(); copyAgentOutput('${node.id}')" style="font-size:0.725rem; color:#7c3aed; padding:2px 8px; background:#f3e8ff; border-radius:6px; font-weight:600;">📋 复制</button>
                </div>
                <div class="agent-output-content" onwheel="event.stopPropagation()" style="flex: 1; overflow-y: auto; font-size: 0.825rem; color: #4c1d95; line-height: 1.6; white-space: pre-wrap; word-break: break-word; padding-right: 4px;">
                  ${escapeHTML(node.outputContent)}
                </div>
              </div>
            ` : `
              <div style="margin-top: 10px; flex: 1; min-height: 80px; display: flex; align-items: center; justify-content: center; padding: 10px; text-align:center; background:#f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; color:#94a3b8; font-size:0.775rem;">
                👉 输入指令并点击运行，在此处输出处理结果
              </div>
            `}
          </div>

          <div class="canvas-port output ${outputConnectedClass} ${isPortSelected && canvasState.selectedPort && canvasState.selectedPort.portType === 'output' ? 'selected' : ''}" data-node-id="${node.id}" data-port-type="output" title="右侧输出端 (连接下游节点)"></div>
        </div>
      `;
    } else if (node.type === 'video') {
      const isGenerating = ['submitting', 'generating'].includes(node.status);
      const canvasVideoModel = getPreferredServerModel('canvas', 'video', node.model);
      const durationSpec = getCanvasVideoDurationSpec(canvasVideoModel, node.duration);
      return `
        <div class="canvas-node ${isSelected ? 'selected' : ''} ${isGenerating ? 'generating-neon-border' : ''} ${canvasState.openInputNodeId === node.id ? 'input-panel-open' : ''}" id="${node.id}" style="left: ${node.x}px; top: ${node.y}px; ${widthStyle} ${heightStyle}">
          ${resizeHandlesHtml}
          <div class="canvas-port input ${inputConnectedClass} ${isPortSelected && canvasState.selectedPort && canvasState.selectedPort.portType === 'input' ? 'selected' : ''}" data-node-id="${node.id}" data-port-type="input" title="左侧输入端"></div>

          <div class="canvas-node-header">
            <span class="canvas-node-title"><span class="node-title-badge">🎬</span> AI 视频生成节点</span>
            <div class="canvas-node-header-actions">${inputControlHtml}<button type="button" class="canvas-node-del" onclick="event.stopPropagation(); removeCanvasNode('${node.id}')" title="删除该节点">✕</button></div>
          </div>
          <div class="canvas-node-body" style="flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 12px; min-height: 0;">
            <div class="canvas-video-node-controls" style="display: flex; flex-direction: column; gap: 8px; padding: 2px 0; font-size: 0.775rem; flex-shrink: 0;">
              <div class="canvas-video-control-row canvas-video-model-row">
                <span class="canvas-video-control-label">模型</span>
                <div class="canvas-video-model-dropdown" data-node-id="${node.id}" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()">
                  <button type="button" class="canvas-video-model-trigger" aria-label="视频生成模型" aria-expanded="false" onclick="toggleCanvasVideoModelDropdown('${node.id}', event)">
                    <span class="canvas-video-model-dot"></span>
                    <span class="canvas-video-model-label">${escapeHTML(getServerModelLabel('canvas', 'video', canvasVideoModel) || '暂无可用视频模型')}</span>
                    <span class="canvas-video-model-chevron">⌄</span>
                  </button>
                  <div class="canvas-video-model-menu">
                    ${getCanvasVideoModelOptionsHtml(node)}
                  </div>
                </div>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                <span style="color: #64748b; font-weight: 500; width: 32px; flex-shrink: 0;">比例</span>
                <div class="canvas-video-pill-group">
                  <button type="button" class="pill-opt ${node.aspect === '16:9' || !node.aspect ? 'active' : ''}" onclick="onCanvasVideoNodeParamChange('${node.id}', 'aspect', '16:9')">16:9</button>
                  <button type="button" class="pill-opt ${node.aspect === '9:16' ? 'active' : ''}" onclick="onCanvasVideoNodeParamChange('${node.id}', 'aspect', '9:16')">9:16</button>
                  <button type="button" class="pill-opt ${node.aspect === '1:1' ? 'active' : ''}" onclick="onCanvasVideoNodeParamChange('${node.id}', 'aspect', '1:1')">1:1</button>
                </div>
              </div>

              <div class="canvas-video-control-row">
                <span class="canvas-video-control-label">时长</span>
                <div class="canvas-video-duration-slider" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onwheel="event.stopPropagation()">
                  <div class="canvas-video-duration-input-box" title="输入秒数；悬停显示滑杆">
                    <input type="number" min="${durationSpec.min}" max="${durationSpec.max}" step="${durationSpec.step}" value="${durationSpec.value}" aria-label="视频时长秒数" oninput="syncCanvasVideoDurationControl('${node.id}', this.value, 'number', false)" onchange="syncCanvasVideoDurationControl('${node.id}', this.value, 'number', true)" onblur="syncCanvasVideoDurationControl('${node.id}', this.value, 'number', true)">
                    <span>秒</span>
                  </div>
                  <div class="canvas-video-duration-popover">
                    <input type="range" min="${durationSpec.min}" max="${durationSpec.max}" step="${durationSpec.step}" value="${durationSpec.value}" aria-label="视频时长滑杆" oninput="syncCanvasVideoDurationControl('${node.id}', this.value, 'range', false)" onchange="syncCanvasVideoDurationControl('${node.id}', this.value, 'range', true)">
                  </div>
                </div>
              </div>
            </div>

            <div class="video-preview-wrapper" style="flex: 1; min-height: 120px; width: 100%; position: relative; display: flex; flex-direction: column; overflow: hidden; border-radius: 8px;">
              ${node.videoUrl ? `
                <video data-lazy-video-src="${escapeHTML(node.videoUrl)}" data-lazy-video-release="auto" class="canvas-node-video-preview" style="width: 100%; height: 100%; flex: 1; object-fit: cover; border-radius: 8px;" controls muted loop playsinline preload="none"></video>
                <button type="button" class="canvas-node-download-btn" onclick="event.stopPropagation(); downloadCanvasNodeAsset('${node.id}')" title="下载原视频">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
              ` : `
                <div style="flex: 1; width: 100%; height: 100%; min-height: 120px; background: #0f172a; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.85rem;">
                  <span style="font-size: 2rem; margin-bottom: 8px;">🎬</span>
                  <span>${isGenerating ? '🔄 视频生成中，请稍候...' : '拖拽左右蓝色圆点即可连线...'}</span>
                </div>
              `}
            </div>

            ${node.status === 'paused' && node.taskId ? `
              <div class="session-task-resume canvas-task-resume">
                页面刷新后任务查询已暂停。
                <div class="canvas-task-resume-actions">
                  <button type="button" class="btn btn-secondary btn-sm" data-resume-task="${escapeHTML(node.taskId)}">恢复查询</button>
                  <button type="button" class="btn btn-secondary btn-sm danger" data-cancel-task="${escapeHTML(node.taskId)}">取消任务</button>
                </div>
              </div>
            ` : node.status === 'failed' ? `
              <div style="width: 100%; border-radius: 8px; padding: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #ef4444; font-size: 0.775rem; line-height: 1.4; display: flex; flex-direction: column; gap: 6px; margin-top: auto; flex-shrink: 0;">
                <div style="font-weight: 700; display: flex; align-items: center; justify-content: space-between;">
                  <span>❌ 视频生成失败</span>
                  <button type="button" class="btn btn-xs danger" onclick="event.stopPropagation(); runCanvasVideoGeneration('${node.id}')" style="font-size: 0.725rem; padding: 3px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6"></path>
                    <path d="M2 11.5a10 10 0 0 1-18.8 4.2L2.5 16"></path>
                  </svg>
                  <span>重新提交</span>
                </button>
                </div>
                <div style="font-size: 0.725rem; word-break: break-all; opacity: 0.9;">
                  ${escapeHTML(node.errorMsg || '服务端处理异常')}
                </div>
              </div>
            ` : (isGenerating ? `
              <div class="canvas-video-progress-box" style="width: 100%; height: 34px; border-radius: 8px; margin-top: auto; flex-shrink: 0; position: relative; overflow: hidden; background: #f1f5f9; border: 1px solid #cbd5e1;">
                <div class="canvas-video-progress-fill" id="progress-fill-${node.id}" style="position: absolute; top:0; left:0; bottom:0; width: ${node.progress || 5}%; background: linear-gradient(90deg, #2563eb, #3b82f6); transition: width 0.3s ease;"></div>
                <div id="progress-text-${node.id}" style="position: absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#0f172a; font-weight:700; font-size:0.8rem; z-index:2;">
                  ⏳ 服务端渲染中 ${node.progress || 5}%
                </div>
              </div>
            ` : `
              <button type="button" class="btn btn-primary btn-run-canvas-video" data-node-id="${node.id}" style="width: 100%; border-radius: 8px; margin-top: auto; flex-shrink: 0;">
                ⚡ 运行节点生成视频 <span id="canvas-video-price-${node.id}" class="send-price-badge">积分预算：--</span>
              </button>
            `)}
          </div>

          <div class="canvas-port output ${outputConnectedClass} ${isPortSelected && canvasState.selectedPort && canvasState.selectedPort.portType === 'output' ? 'selected' : ''}" data-node-id="${node.id}" data-port-type="output" title="右侧输出端"></div>
        </div>
      `;
    }
    return '';
  }).join('');
  restoreCanvasStableVideoElements(container, preservedVideos);
  observeManagedVideos(container);
  scheduleCanvasMediaAutoSizing();

  void updateCanvasPricePreviews();
  container.querySelectorAll('.btn-run-canvas-video').forEach(btn => {
    btn.onclick = () => runCanvasVideoGeneration(btn.dataset.nodeId);
  });

  // 绑定后台不间断 AI 扩写与从原始 prompt 重新优化逻辑
  container.querySelectorAll('.btn-ai-expand-canvas').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId;
      const node = canvasState.nodes.find(n => n.id === nodeId);
      if (!node) return;

      if (!node.rawContent) node.rawContent = node.content;
      canvasNodeExpandingState[nodeId] = true;
      renderCanvasNodesAndLines();

      try {
        const automaticContext = getSelectedCanvasInputNodes(nodeId)
          .map(inputNode => ({ nodeId: inputNode.id, text: getCanvasNodePromptText(inputNode) }))
          .filter(item => item.text)
          .map(item => resolveCanvasAtMentionText(item.text, item.nodeId));
        const ownText = resolveCanvasAtMentionText(node.rawContent || '', nodeId);
        const expansionInput = [ownText, ...automaticContext].filter(Boolean).join('\n');
        const textModel = getPreferredServerModel('canvas', 'llm', node.model || state.apiConfig.llmModelName);
        if (!textModel) throw new Error('暂无可用语言模型，请先在 API 设置中配置');
        node.model = textModel;
        const expandedText = await runAIExpandTask(expansionInput, textModel);
        node.content = expandedText;
        canvasNodeExpandingState[nodeId] = false;
        saveCanvasState();
        renderCanvasNodesAndLines();
        showToast('✨ 节点提示词 AI 扩写成功！', 'success');
      } catch (err) {
        canvasNodeExpandingState[nodeId] = false;
        renderCanvasNodesAndLines();
        showToast('❌ 扩写失败: ' + err.message, 'error');
      }
    };
  });

  bindCanvasPortEvents();
  makeCanvasNodesDraggable();
  bindNodeResizeEvents();

  drawCanvasLines();
}

window.renderCanvasNodesAndLines = renderCanvasNodesAndLines;


// 绑定 4 个角控制点的拖拽拉伸大小逻辑
function bindNodeResizeEvents() {
  document.querySelectorAll('.resize-handle').forEach(handle => {
    handle.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const nodeId = handle.dataset.nodeId;
      const type = handle.dataset.handle;
      const node = canvasState.nodes.find(n => n.id === nodeId);
      const nodeEl = document.getElementById(nodeId);
      if (!node || !nodeEl) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = node.width || nodeEl.offsetWidth;
      const startH = node.height || nodeEl.offsetHeight;
      const startNodeX = node.x;
      const startNodeY = node.y;
      const zoom = canvasState.zoom || 1.0;

      const onMouseMove = (moveEvt) => {
        const dx = (moveEvt.clientX - startX) / zoom;
        const dy = (moveEvt.clientY - startY) / zoom;

        let newW = startW;
        let newH = startH;
        let newX = startNodeX;
        let newY = startNodeY;

        if (type.includes('r')) newW = Math.max(180, startW + dx);
        if (type.includes('b')) newH = Math.max(120, startH + dy);

        if (type.includes('l')) {
          const possibleW = startW - dx;
          if (possibleW >= 180) {
            newW = possibleW;
            newX = startNodeX + dx;
          }
        }
        if (type.includes('t')) {
          const possibleH = startH - dy;
          if (possibleH >= 120) {
            newH = possibleH;
            newY = startNodeY + dy;
          }
        }

        node.width = Math.round(newW);
        node.height = Math.round(newH);
        node.x = Math.round(newX);
        node.y = Math.round(newY);

        nodeEl.style.width = node.width + 'px';
        nodeEl.style.height = node.height + 'px';
        nodeEl.style.left = node.x + 'px';
        nodeEl.style.top = node.y + 'px';

        drawCanvasLines();
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveCanvasState();
        renderCanvasNodesAndLines();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  });
}
window.bindNodeResizeEvents = bindNodeResizeEvents;


// 绑定 4 个角控制点的拖拽拉伸大小逻辑
function bindNodeResizeEvents() {
  document.querySelectorAll('.resize-handle').forEach(handle => {
    handle.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const nodeId = handle.dataset.nodeId;
      const type = handle.dataset.handle;
      const node = canvasState.nodes.find(n => n.id === nodeId);
      const nodeEl = document.getElementById(nodeId);
      if (!node || !nodeEl) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = node.width || nodeEl.offsetWidth;
      const startH = node.height || nodeEl.offsetHeight;
      const startNodeX = node.x;
      const startNodeY = node.y;
      const zoom = canvasState.zoom || 1.0;

      const onMouseMove = (moveEvt) => {
        const dx = (moveEvt.clientX - startX) / zoom;
        const dy = (moveEvt.clientY - startY) / zoom;

        let newW = startW;
        let newH = startH;
        let newX = startNodeX;
        let newY = startNodeY;

        if (type.includes('r')) newW = Math.max(180, startW + dx);
        if (type.includes('b')) newH = Math.max(120, startH + dy);

        if (type.includes('l')) {
          const possibleW = startW - dx;
          if (possibleW >= 180) {
            newW = possibleW;
            newX = startNodeX + dx;
          }
        }
        if (type.includes('t')) {
          const possibleH = startH - dy;
          if (possibleH >= 120) {
            newH = possibleH;
            newY = startNodeY + dy;
          }
        }

        node.width = Math.round(newW);
        node.height = Math.round(newH);
        node.x = Math.round(newX);
        node.y = Math.round(newY);

        nodeEl.style.width = node.width + 'px';
        nodeEl.style.height = node.height + 'px';
        nodeEl.style.left = node.x + 'px';
        nodeEl.style.top = node.y + 'px';

        drawCanvasLines();
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveCanvasState();
        renderCanvasNodesAndLines();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  });
}
window.bindNodeResizeEvents = bindNodeResizeEvents;


// 节点拖拽
function makeCanvasNodesDraggable() {
  canvasState.nodes.forEach(node => {
    const nodeEl = document.getElementById(node.id);
    if (!nodeEl) return;

    nodeEl.onmousedown = (e) => {
      if (e.button !== 0) return; // 关键：忽略鼠标右键，防止右键导致拖拽/框选残留
      if (isSpacePressed) return;

      // 编辑区、输入控件、按钮、端口、删除键不参与节点拖拽
      if (e.target.closest('.canvas-node-composer') || e.target.closest('.canvas-node-editor') || e.target.closest('.canvas-node-textarea')) return;
      const targetTag = e.target.tagName.toLowerCase();
      if (targetTag === 'textarea' || targetTag === 'input' || targetTag === 'select' || targetTag === 'button' || e.target.classList.contains('canvas-port') || e.target.classList.contains('canvas-node-del')) {
        return;
      }

      if (!canvasState.selectedNodeIds.includes(node.id)) {
        if (e.shiftKey) {
          selectCanvasNodes([...canvasState.selectedNodeIds, node.id]);
        } else {
          selectCanvasNode(node.id);
        }
      }

      let isDragging = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const currentZoom = canvasState.zoom || 1.0;

      const initialPositions = canvasState.selectedNodeIds.map(id => {
        const n = canvasState.nodes.find(item => item.id === id);
        return n ? { id: n.id, initialX: n.x, initialY: n.y } : null;
      }).filter(Boolean);

      const onMouseMove = (moveEvt) => {
        if (!isDragging) return;
        const dx = (moveEvt.clientX - startX) / currentZoom;
        const dy = (moveEvt.clientY - startY) / currentZoom;

        initialPositions.forEach(pos => {
          const targetNode = canvasState.nodes.find(n => n.id === pos.id);
          const targetEl = document.getElementById(pos.id);
          if (targetNode && targetEl) {
            targetNode.x = Math.round(pos.initialX + dx);
            targetNode.y = Math.round(pos.initialY + dy);
            targetEl.style.left = targetNode.x + 'px';
            targetEl.style.top = targetNode.y + 'px';
          }
        });
        drawCanvasLines();
      };

      const onMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          saveCanvasState();
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  });
}

// 画布缩放平移
function bindCanvasWorkspaceZoomAndPan() {
  const workspace = document.getElementById('canvasWorkspace');
  if (!workspace) return;
  if (workspace.dataset.canvasNavigationBound === 'true') return;
  workspace.dataset.canvasNavigationBound = 'true';

  let isPanning = false;
  let isBoxSelecting = false;
  let startX, startY;
  let boxEl = null;

  workspace.addEventListener('mousedown', (e) => {
    // 按住 Space 键 或 鼠标中键 -> 全局任意位置平移画布 (无需避开卡片)
    if (isSpacePressed || e.button === 1) {
      isPanning = true;
      startX = e.clientX - canvasState.panX;
      startY = e.clientY - canvasState.panY;
      document.documentElement.classList.add('space-panning-active'); document.body.classList.add('space-panning-active');
      return;
    }

    if (e.button !== 0) return; // 关键：仅限鼠标左键！防止右键拉出无法消失的选择框
    if (e.target.closest('.canvas-node') || e.target.closest('.canvas-drawer') || e.target.closest('.canvas-top-toolbar') || e.target.closest('#canvasZoomFloatingBar') || e.target.closest('.canvas-svg-hit-path') || e.target.closest('.canvas-svg-line')) return;

    const rect = workspace.getBoundingClientRect();

    canvasState.selectedConnectionIds = [];
    selectCanvasNodes([]);
    drawCanvasLines();
    isBoxSelecting = true;
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    boxEl = document.createElement('div');
    boxEl.className = 'canvas-selection-box';
    boxEl.style.left = startX + 'px';
    boxEl.style.top = startY + 'px';
    boxEl.style.width = '0px';
    boxEl.style.height = '0px';
    workspace.appendChild(boxEl);
  });

  document.addEventListener('mousemove', (e) => {
    const rect = workspace.getBoundingClientRect();

    if (isPanning) {
      canvasState.panX = e.clientX - startX;
      canvasState.panY = e.clientY - startY;
      applyCanvasTransform();
    } else if (isBoxSelecting && boxEl) {
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      boxEl.style.left = left + 'px';
      boxEl.style.top = top + 'px';
      boxEl.style.width = width + 'px';
      boxEl.style.height = height + 'px';

      const zoom = canvasState.zoom || 1.0;
      const boxCanvasX1 = (left - canvasState.panX) / zoom;
      const boxCanvasY1 = (top - canvasState.panY) / zoom;
      const boxCanvasX2 = (left + width - canvasState.panX) / zoom;
      const boxCanvasY2 = (top + height - canvasState.panY) / zoom;

      const selectedIds = [];
      const selectedConnIds = [];

      canvasState.nodes.forEach(node => {
        const nodeWidth = (node.type === 'video') ? 330 : 300;
        const nodeHeight = 150;
        const nodeX1 = node.x;
        const nodeY1 = node.y;
        const nodeX2 = node.x + nodeWidth;
        const nodeY2 = node.y + nodeHeight;

        const intersects = !(nodeX2 < boxCanvasX1 || nodeX1 > boxCanvasX2 || nodeY2 < boxCanvasY1 || nodeY1 > boxCanvasY2);
        if (intersects) {
          selectedIds.push(node.id);
        }
      });

      canvasState.connections.forEach(c => {
        const fromPos = getPortCanvasPos(c.fromId, 'output');
        const toPos = getPortCanvasPos(c.toId, 'input');
        const x1 = fromPos.x;
        const y1 = fromPos.y;
        const x2 = toPos.x;
        const y2 = toPos.y;
        const dx = Math.abs(x2 - x1) * 0.5;

        // 25-point Cubic Bezier Curve Sampling: 保证框选仅在选择框与三次贝塞尔曲线实际轨迹交汇时才选中
        let lineIntersectsBox = false;
        const steps = 25;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const cx1 = x1 + dx;
          const cx2 = x2 - dx;

          const bx = Math.pow(1 - t, 3) * x1 + 3 * Math.pow(1 - t, 2) * t * cx1 + 3 * (1 - t) * Math.pow(t, 2) * cx2 + Math.pow(t, 3) * x2;
          const by = Math.pow(1 - t, 3) * y1 + 3 * Math.pow(1 - t, 2) * t * y1 + 3 * (1 - t) * Math.pow(t, 2) * y2 + Math.pow(t, 3) * y2;

          if (bx >= boxCanvasX1 && bx <= boxCanvasX2 && by >= boxCanvasY1 && by <= boxCanvasY2) {
            lineIntersectsBox = true;
            break;
          }
        }

        if (lineIntersectsBox) {
          selectedConnIds.push(`${c.fromId}__${c.toId}`);
        }
      });

      canvasState.selectedConnectionIds = selectedConnIds;
      selectCanvasNodes(selectedIds);
      drawCanvasLines();
    }
  });

  document.addEventListener('contextmenu', () => {
    if (isBoxSelecting || boxEl) {
      isBoxSelecting = false;
      document.querySelectorAll('.canvas-selection-box').forEach(el => el.remove());
      boxEl = null;
      renderCanvasNodesAndLines();
    }
  });

  document.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      if (!isSpacePressed) { document.documentElement.classList.remove('space-panning', 'space-panning-active'); document.body.classList.remove('space-panning', 'space-panning-active'); } else { document.documentElement.classList.remove('space-panning-active'); document.body.classList.remove('space-panning-active'); }
      saveCanvasState();
    }
    if (isBoxSelecting || boxEl) {
      isBoxSelecting = false;
      document.querySelectorAll('.canvas-selection-box').forEach(el => el.remove());
      boxEl = null;
      renderCanvasNodesAndLines();
    }
  });
}

// 端口绑连
function bindCanvasPortEvents() {
  document.querySelectorAll('.canvas-port').forEach(port => {
    port.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nodeId = port.dataset.nodeId;
      const portType = port.dataset.portType;

      if (!canvasState.selectedPort) {
        canvasState.selectedPort = { nodeId, portType };
        showToast('📍 已选中起点圆点，请点击目标节点的圆点完成连线', 'info');
        renderCanvasNodesAndLines();
      } else {
        if (canvasState.selectedPort.nodeId !== nodeId) {
          const fromId = canvasState.selectedPort.portType === 'output' ? canvasState.selectedPort.nodeId : nodeId;
          const toId = canvasState.selectedPort.portType === 'output' ? nodeId : canvasState.selectedPort.nodeId;

          const exists = canvasState.connections.some(c => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId));
          if (!exists) {
            pushCanvasUndoState();
            canvasState.connections.push({ fromId, toId });
            saveCanvasState();
            showToast('🔗 节点连线成功！', 'success');
          }
        }
        canvasState.selectedPort = null;
        renderCanvasNodesAndLines();
      }
    };

    port.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const nodeId = port.dataset.nodeId;
      const portType = port.dataset.portType;
      const portPos = getPortCanvasPos(nodeId, portType);

      lineDragState.isDragging = true;
      lineDragState.fromNodeId = nodeId;
      lineDragState.fromPortType = portType;
      lineDragState.startX = portPos.x;
      lineDragState.startY = portPos.y;

      port.classList.add('selected');
    };
  });
}
window.bindCanvasPortEvents = bindCanvasPortEvents;

// 键盘 Delete 批量删除
document.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  const activeTag = activeEl ? activeEl.tagName.toLowerCase() : '';
  if (activeTag === 'textarea' || activeTag === 'input' || (activeEl && activeEl.isContentEditable)) return;

  const isDeleteKey = (e.key === 'Delete' || e.key === 'Backspace' || e.code === 'Delete' || e.code === 'Backspace' || e.keyCode === 46 || e.keyCode === 8);

  if (isDeleteKey && canvasState.selectedNodeIds && canvasState.selectedNodeIds.length > 0) {
    e.preventDefault();
    removeSelectedCanvasNodes();
  }
});

// JSON 导出与导入
function exportCanvasToFile() {
  saveCanvasState();
  const data = {
    title: (state.canvasProjects && state.activeCanvasProjectId) ? (state.canvasProjects.find(p=>p.id===state.activeCanvasProjectId)?.title || '画布项目') : '画布项目',
    nodes: canvasState.nodes,
    connections: canvasState.connections,
    zoom: canvasState.zoom,
    panX: canvasState.panX,
    panY: canvasState.panY,
    exportedAt: Date.now()
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute("href", dataStr);
  anchor.setAttribute("download", `AI_Canvas_${Date.now()}.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  showToast('📥 已成功导出画布 JSON 文件！', 'success');
}
window.exportCanvasToFile = exportCanvasToFile;

function openImportCanvasModal() {
  const modal = document.getElementById('modalImportCanvas');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}
window.openImportCanvasModal = openImportCanvasModal;

function closeImportCanvasModal() {
  const modal = document.getElementById('modalImportCanvas');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}
window.closeImportCanvasModal = closeImportCanvasModal;

function parseAndLoadCanvasJson(jsonText) {
  try {
    const imported = JSON.parse(jsonText);
    if (imported.nodes) canvasState.nodes = imported.nodes;
    if (imported.connections) canvasState.connections = imported.connections;
    if (imported.zoom) canvasState.zoom = imported.zoom;
    if (imported.panX !== undefined) canvasState.panX = imported.panX;
    if (imported.panY !== undefined) canvasState.panY = imported.panY;

    saveCanvasState();
    renderCanvasNodesAndLines();
    closeImportCanvasModal();
    showToast('📂 已成功导入并加载画布项目！', 'success');
  } catch (err) {
    alert('JSON 解析失败：' + err.message);
  }
}
window.parseAndLoadCanvasJson = parseAndLoadCanvasJson;

// 全局工具栏代理事件
document.addEventListener('click', (e) => {
  if (canvasState.openInputNodeId && !e.target.closest('.canvas-input-control')) {
    canvasState.openInputNodeId = null;
    canvasState.inputHover = null;
    renderCanvasNodesAndLines();
  }
  const isEditingCanvasNode = e.target.closest('.canvas-node-textarea') || e.target.closest('.canvas-node-editor');
  if (canvasAtMentionState.activeNodeId && !e.target.closest('.canvas-at-mention-dropdown') && !isEditingCanvasNode) {
    hideCanvasAtMentionDropdown();
    canvasAtMentionState = { activeNodeId: null, query: '', startIndex: -1, selectedIndex: 0 };
  }
  if (canvasAtMentionState.activeNodeId && e.target.closest('.canvas-node') && !isEditingCanvasNode) {
    const targetNodeEl = e.target.closest('.canvas-node');
    const targetNodeId = targetNodeEl.id;
    const currentNodeId = canvasAtMentionState.activeNodeId;
    if (targetNodeId && targetNodeId !== currentNodeId) {
      const upstreamIds = getCanvasAtMentionCandidates(currentNodeId).map(n => n.id);
      if (upstreamIds.includes(targetNodeId)) {
        const targetNode = canvasState.nodes.find(n => n.id === targetNodeId);
        const cleanTitle = (targetNode?.title || targetNode?.assetName || '未命名节点').replace(/^[🤖📝🖼️🎬\s]+/, '');
        insertCanvasAtMention(currentNodeId, targetNodeId, cleanTitle);
      } else {
        showToast('请先接入该节点到当前提示词节点左侧', 'warning');
      }
    }
  }
  if (e.target.closest('#btnCanvasAddTextNode')) {
    const center = getCanvasViewportCenterPos();
    addCanvasNode({
      id: 'node_text_' + Date.now(),
      type: 'text',
      x: center.x,
      y: center.y,
      title: '📝 提示词节点',
      content: '描述您想要生成的视频画面...'
    });
    showToast('已在视角中心添加提示词节点', 'success');
  } else if (e.target.closest('#btnCanvasAddAssetNode')) {
    const center = getCanvasViewportCenterPos();
    addCanvasNode({
      id: 'node_asset_' + Date.now(),
      type: 'asset',
      x: center.x,
      y: center.y,
      title: '🖼️ 参考图节点',
      assetName: '自定义参考图',
      imgUrl: ''
    });
    showToast('已在视角中心添加参考图节点', 'success');
  } else if (e.target.closest('#btnCanvasAddAgentNode')) {
    addCanvasAgentNode(e);
  } else if (e.target.closest('#btnCanvasAddVideoNode')) {
    const center = getCanvasViewportCenterPos();
    addCanvasNode({
      id: 'node_video_' + Date.now(),
      type: 'video',
      x: center.x + 80,
      y: center.y,
      title: '🎬 AI 视频生成节点',
      model: getPreferredServerModel('canvas', 'video') || DEFAULT_VIDEO_MODEL,
      aspect: '16:9',
      duration: 15,
      videoUrl: null,
      status: 'idle'
    });
    showToast('已在视角中心添加视频生成节点', 'success');
  } else if (e.target.closest('#btnCanvasToggleDrawer')) {
    const drawer = document.getElementById('canvasDrawer');
    const isClosed = drawer ? drawer.classList.contains('closed') : true;

    if (isClosed) {
      canvasState.isDrawerClosed = false;
      canvasState.drawerPresetOnly = false;
      canvasState.activeDrawerTab = 'assets';
      showToast('📦 已打开【资产库】抽屉', 'info');
    } else if (canvasState.drawerPresetOnly || canvasState.activeDrawerTab === 'templates') {
      canvasState.isDrawerClosed = false;
      canvasState.drawerPresetOnly = false;
      canvasState.activeDrawerTab = 'assets';
      showToast('🔄 已切换至【📦 资产库】', 'info');
    } else {
      canvasState.isDrawerClosed = true;
    }
    renderCanvasDrawer();
  } else if (e.target.closest('#btnCanvasLoadPreset')) {
    const drawer = document.getElementById('canvasDrawer');
    const isClosed = drawer ? drawer.classList.contains('closed') : true;

    if (isClosed) {
      canvasState.isDrawerClosed = false;
      canvasState.drawerPresetOnly = true;
      canvasState.activeDrawerTab = 'templates';
      showToast('📂 已打开【预设模版】库', 'info');
    } else if (!canvasState.drawerPresetOnly && canvasState.activeDrawerTab !== 'templates') {
      canvasState.isDrawerClosed = false;
      canvasState.drawerPresetOnly = true;
      canvasState.activeDrawerTab = 'templates';
      showToast('🔄 已切换至【📂 预设模版】', 'info');
    } else {
      canvasState.isDrawerClosed = true;
    }
    renderCanvasDrawer();
  } else if (e.target.closest('#btnCloseCanvasDrawer')) {
    canvasState.isDrawerClosed = true;
    renderCanvasDrawer();
  } else if (e.target.closest('#btnCanvasClear')) {
    openClearCanvasConfirmModal();
  } else if (e.target.closest('#btnCanvasSave')) {
    openSaveCanvasLibraryModal();
  } else if (e.target.closest('#btnCanvasExport')) {
    exportCanvasToFile();
  } else if (e.target.closest('#btnCanvasImport')) {
    openImportCanvasModal();
  } else if (e.target.closest('#btnCloseImportCanvasModal')) {
    closeImportCanvasModal();
  } else if (e.target.closest('#btnSelectCanvasFile')) {
    const fileInput = document.getElementById('canvasModalFileInput');
    if (fileInput) fileInput.click();
  } else if (e.target.id === 'tabDrawerAssets') {
    canvasState.activeDrawerTab = 'assets';
    renderCanvasDrawer();
  } else if (e.target.id === 'tabDrawerPrompts') {
    canvasState.activeDrawerTab = 'prompts';
    renderCanvasDrawer();
  } else if (e.target.id === 'tabDrawerTemplates') {
    canvasState.activeDrawerTab = 'templates';
    renderCanvasDrawer();
  }
});

// JSON 文件上传与 DropZone
document.addEventListener('change', (e) => {
  if (e.target.id === 'canvasModalFileInput' && e.target.files && e.target.files[0]) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      parseAndLoadCanvasJson(evt.target.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  bindCanvasDropZone();
});

function bindCanvasDropZone() {
  const dropZone = document.getElementById('canvasDropZone');
  if (!dropZone || dropZone.dataset.bound) return;
  dropZone.dataset.bound = "true";

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        parseAndLoadCanvasJson(evt.target.result);
      };
      reader.readAsText(file);
    }
  });

  dropZone.onclick = (e) => {
    if (e.target.id !== 'btnSelectCanvasFile') {
      const fileInput = document.getElementById('canvasModalFileInput');
      if (fileInput) fileInput.click();
    }
  };
}
window.bindCanvasDropZone = bindCanvasDropZone;

// 动态橡皮筋虚线 Drag Event Listeners
document.addEventListener('mousemove', (e) => {
  if (!lineDragState.isDragging) return;

  const svgLayer = document.getElementById('canvasSvgLayer');
  const container = document.getElementById('canvasNodesContainer');
  if (!svgLayer || !container) return;

  const cRect = container.getBoundingClientRect();
  const currentZoom = canvasState.zoom || 1.0;

  const mouseCanvasX = (e.clientX - cRect.left) / currentZoom;
  const mouseCanvasY = (e.clientY - cRect.top) / currentZoom;

  const x1 = lineDragState.startX;
  const y1 = lineDragState.startY;
  const x2 = mouseCanvasX;
  const y2 = mouseCanvasY;

  const dx = Math.max(30, Math.abs(x2 - x1) / 2);
  const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

  let tempPath = svgLayer.querySelector('.canvas-temp-line');
  if (!tempPath) {
    tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('class', 'canvas-temp-line');
    svgLayer.appendChild(tempPath);
  }
  tempPath.setAttribute('d', pathD);

  document.querySelectorAll('.canvas-port.target-hover').forEach(p => p.classList.remove('target-hover'));
  const elemUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
  if (elemUnderCursor) {
    const portEl = elemUnderCursor.closest('.canvas-port');
    if (portEl && portEl.dataset.nodeId !== lineDragState.fromNodeId) {
      portEl.classList.add('target-hover');
    }
  }
});

document.addEventListener('mouseup', (e) => {
  if (!lineDragState.isDragging) return;

  const svgLayer = document.getElementById('canvasSvgLayer');
  if (svgLayer) {
    const tempPath = svgLayer.querySelector('.canvas-temp-line');
    if (tempPath) tempPath.remove();
  }

  document.querySelectorAll('.canvas-port.target-hover').forEach(p => p.classList.remove('target-hover'));

  const elemUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
  let toNodeId = null;

  if (elemUnderCursor) {
    const targetPort = elemUnderCursor.closest('.canvas-port');
    const targetNode = elemUnderCursor.closest('.canvas-node');
    if (targetPort) {
      toNodeId = targetPort.dataset.nodeId;
    } else if (targetNode) {
      toNodeId = targetNode.id;
    }
  }

  if (toNodeId && toNodeId !== lineDragState.fromNodeId) {
    const fromId = lineDragState.fromNodeId;
    const exists = canvasState.connections.some(c => (c.fromId === fromId && c.toId === toNodeId) || (c.fromId === toNodeId && c.toId === fromId));
    if (!exists) {
      pushCanvasUndoState();
      canvasState.connections.push({ fromId: fromId, toId: toNodeId });
      saveCanvasState();
      showToast('🔗 节点连线成功！', 'success');
    }
  }

  lineDragState.isDragging = false;
  document.querySelectorAll('.canvas-port.selected').forEach(p => p.classList.remove('selected'));
  renderCanvasNodesAndLines();
});


/* ==========================================================================
   📌 三大专项修复：
   1. Ctrl / Cmd / Space + 滚轮 -> 100% 以鼠标光标指针为绝对几何中心进行缩放
   2. 按住 Space -> 全局 Capture 捕抓鼠标拖拽平移画布，且 Space + 滚轮无盲区缩放
   3. 节点标题编辑 -> 必须先选中节点，再次点击标题即可编辑，点击其他地方 blur 自动保存
   ========================================================================== */

// 1 & 2. 窗口级全局 Wheel 监听 (Ctrl + 滚轮 或 Space + 滚轮 强制以鼠标中心缩放)
// 唯一全局 Wheel 滚轮引擎 (鼠标在 textarea 文本框内优先流畅上下滚屏，空白区平移，Ctrl/Space以鼠标中心缩放)
window.addEventListener('wheel', (e) => {
  const workspace = document.getElementById('canvasWorkspace');
  if (!workspace) return;

  const isScrollableArea = e.target.closest('.canvas-node-textarea') || e.target.closest('.canvas-node-editor') || e.target.closest('.agent-output-content') || e.target.closest('.agent-output-box');

  // 如果鼠标在 textarea 或 智能体输出文本框内部，且没有按住 Ctrl/Cmd/Space 缩放修饰键 -> 允许原生上下流畅滚屏
  if (isScrollableArea && !e.ctrlKey && !e.metaKey && !isSpacePressed) {
    e.stopPropagation();
    return;
  }

  if (e.target.closest('#canvasWorkspace')) {
    if (e.ctrlKey || e.metaKey || isSpacePressed) {
      e.preventDefault();

      const rect = workspace.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldZoom = canvasState.zoom || 1.0;
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      let newZoom = Math.min(Math.max(oldZoom + delta, 0.3), 2.5);
      newZoom = Math.round(newZoom * 100) / 100;

      if (newZoom !== oldZoom) {
        const canvasX = (mouseX - canvasState.panX) / oldZoom;
        const canvasY = (mouseY - canvasState.panY) / oldZoom;

        canvasState.panX = Math.round(mouseX - canvasX * newZoom);
        canvasState.panY = Math.round(mouseY - canvasY * newZoom);
        canvasState.zoom = newZoom;
        applyCanvasTransform();
        saveCanvasState();
      }
    } else {
      e.preventDefault();
      canvasState.panX -= e.deltaX;
      canvasState.panY -= e.deltaY;
      applyCanvasTransform();
    }
  }
}, { passive: false });

// 3. 节点标题重命名 (必须先选中画板，再次点击标题即可编辑，点击任意地方自动退出并保存)
function makeNodeTitlesEditable() {
  document.querySelectorAll('.canvas-node-title').forEach(titleEl => {
    titleEl.onclick = (e) => {
      e.stopPropagation();
      const nodeEl = titleEl.closest('.canvas-node');
      if (!nodeEl) return;

      const nodeId = nodeEl.id;
      const isSelected = canvasState.selectedNodeIds.includes(nodeId);

      // 必须先选中了画板卡片，再次点击名字才可以开始编辑
      if (!isSelected) {
        selectCanvasNode(nodeId);
        return;
      }

      // 如果已经是 input 正在编辑状态，不做处理
      if (titleEl.querySelector('input')) return;

      const currentTitle = titleEl.textContent ? titleEl.textContent.trim() : '';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'canvas-node-title-input';
      input.value = currentTitle;

      titleEl.innerHTML = '';
      titleEl.appendChild(input);
      input.focus();
      input.select();

      let isSaved = false;
      const saveTitle = () => {
        if (isSaved) return;
        isSaved = true;
        document.removeEventListener('mousedown', onGlobalClickOutside, true);

        const newTitle = input.value.trim() || currentTitle;
        const node = canvasState.nodes.find(n => n.id === nodeId);
        if (node) {
          node.title = newTitle;
          saveCanvasState();
        }
        renderCanvasNodesAndLines();
        showToast('📝 节点名称已修改保存', 'success');
      };

      // 点击页面任意位置 (全局 Capture 捕获) 即自动保存并退出编辑
      const onGlobalClickOutside = (evt) => {
        if (!titleEl.contains(evt.target)) {
          saveTitle();
        }
      };

      input.onblur = saveTitle;
      input.onkeydown = (evt) => {
        if (evt.key === 'Enter') {
          saveTitle();
        }
      };

      // 延迟注册全局点击监听，防止当前点击事件误触发
      setTimeout(() => {
        document.addEventListener('mousedown', onGlobalClickOutside, true);
      }, 50);
    };
  });
}
window.makeNodeTitlesEditable = makeNodeTitlesEditable;

/* ==========================================================================
   🚀 专治按住 Space 键 + 鼠标左键平移画布引擎 (终极防闪烁 & 右键防御)
   ========================================================================== */

let isPanningCanvas = false;
let panStartX = 0;
let panStartY = 0;

window.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  const activeTag = active ? active.tagName.toLowerCase() : '';
  const isEditing = activeTag === 'textarea' || activeTag === 'input' || (active && active.isContentEditable);

  // 1. 撤回快捷键 (Cmd+Z 或 Ctrl+Z)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    if (isEditing) return;
    e.preventDefault();
    performCanvasUndo();
    return;
  }

  // 复制 / 粘贴快捷键 (Cmd+C / Ctrl+C, Cmd+V / Ctrl+V)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
    if (isEditing) return;
    if (canvasState.selectedNodeIds && canvasState.selectedNodeIds.length > 0) {
      e.preventDefault();
      copySelectedCanvasNodes();
      return;
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
    if (isEditing) return;
    e.preventDefault();
    pasteCanvasNodes();
    return;
  }

  // 2. 键盘删除键 (Delete 或 Backspace) 删除选中的节点与连线
  const isDeleteKey = (e.key === 'Delete' || e.key === 'Backspace' || e.code === 'Delete' || e.code === 'Backspace' || e.keyCode === 46 || e.keyCode === 8);
  if (isDeleteKey) {
    if (isEditing) return;

    let hasDeleted = false;
    if (canvasState.selectedConnectionIds && canvasState.selectedConnectionIds.length > 0) {
      pushCanvasUndoState();
      canvasState.connections = canvasState.connections.filter(c => !canvasState.selectedConnectionIds.includes(`${c.fromId}__${c.toId}`));
      canvasState.selectedConnectionIds = [];
      hasDeleted = true;
    }

    if (canvasState.selectedNodeIds && canvasState.selectedNodeIds.length > 0) {
      pushCanvasUndoState();
      const nodeIdsToRemove = canvasState.selectedNodeIds;
      canvasState.nodes = canvasState.nodes.filter(n => !nodeIdsToRemove.includes(n.id));
      canvasState.connections = canvasState.connections.filter(c => !nodeIdsToRemove.includes(c.fromId) && !nodeIdsToRemove.includes(c.toId));
      canvasState.selectedNodeIds = [];
      hasDeleted = true;
    }

    if (hasDeleted) {
      e.preventDefault();
      pushCanvasUndoState();
      saveCanvasState();
      renderCanvasNodesAndLines();
      drawCanvasLines();
      showToast('🗑️ 已删除选中的元素', 'info');
      return;
    }
  }

  if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
    const active = document.activeElement;
    const activeTag = active ? active.tagName.toLowerCase() : '';

    // 如果用户正在 textarea / input / contenteditable 内部打字编辑文本，则响应正常空格输入
    if (activeTag === 'textarea' || activeTag === 'input' || (active && active.isContentEditable)) {
      return;
    }

    // 关键：阻止 OS 按键自动重复 (key repeat) 触发导致的画面闪烁
    if (e.repeat) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    isSpacePressed = true;
    document.documentElement.classList.add('space-panning');
    document.body.classList.add('space-panning');
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
    const active = document.activeElement;
    const activeTag = active ? active.tagName.toLowerCase() : '';
    if (activeTag === 'textarea' || activeTag === 'input') {
      return;
    }

    isSpacePressed = false;
    isPanningCanvas = false;
    document.documentElement.classList.remove('space-panning', 'space-panning-active');
    document.body.classList.remove('space-panning', 'space-panning-active');
  }
});

// 全局 Capture Phase 监听 Mousedown：按住 Space 键 或 鼠标中键 -> 优先平移画布
window.addEventListener('mousedown', (e) => {
  if (e.button === 2) return; // 忽略鼠标右键

  const workspace = document.getElementById('canvasWorkspace');
  if (!workspace || !e.target.closest('#canvasWorkspace')) return;

  if (isSpacePressed || e.button === 1) {
    isPanningCanvas = true;
    panStartX = e.clientX - (canvasState.panX || 0);
    panStartY = e.clientY - (canvasState.panY || 0);
    document.documentElement.classList.add('space-panning-active');
    document.body.classList.add('space-panning-active');

    // 关键：拖拽平移时临时关闭子元素的 pointer-events，防止快速划过节点时光标间歇性消失/闪烁
    const container = document.getElementById('canvasNodesContainer');
    const svgLayer = document.getElementById('canvasSvgLayer');
    if (container) container.style.pointerEvents = 'none';
    if (svgLayer) svgLayer.style.pointerEvents = 'none';

    e.preventDefault();
    e.stopPropagation();
  }
}, true);

window.addEventListener('mousemove', (e) => {
  if (isPanningCanvas) {
    canvasState.panX = e.clientX - panStartX;
    canvasState.panY = e.clientY - panStartY;
    applyCanvasTransform();
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

window.addEventListener('mouseup', (e) => {
  if (isPanningCanvas) {
    isPanningCanvas = false;
    document.documentElement.classList.remove('space-panning-active');
    document.body.classList.remove('space-panning-active');
    if (!isSpacePressed) {
      document.documentElement.classList.remove('space-panning');
      document.body.classList.remove('space-panning');
    }

    // 恢复子元素的 pointer-events
    const container = document.getElementById('canvasNodesContainer');
    const svgLayer = document.getElementById('canvasSvgLayer');
    if (container) container.style.pointerEvents = '';
    if (svgLayer) svgLayer.style.pointerEvents = '';

    saveCanvasState();
    e.preventDefault();
    e.stopPropagation();
  }
}, true);


// 📚 从提示词库选择模板导入到画布节点
function openCanvasPromptPicker(nodeId) {
  initAssetAndPromptData();
  const modal = document.getElementById('modalCanvasPromptPicker');
  const container = document.getElementById('canvasPromptPickerList');
  if (!modal || !container) return;

  const items = state.promptTemplates || [];
  if (items.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">暂无提示词模板</div>';
  } else {
    container.innerHTML = items.map(t => `
      <div class="canvas-prompt-item-card" onclick="applyCanvasPromptTemplate('${nodeId}', \`${escapeHTML(t.prompt).replace(/`/g, '\`')}\`)">
        <div style="font-weight:700; font-size:0.9rem; color:#0f172a; margin-bottom:4px;">${escapeHTML(t.title)} <span style="font-size:0.7rem; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; margin-left:6px;">${escapeHTML(t.category)}</span></div>
        <div style="font-size:0.8rem; color:#475569; line-height:1.4;">${escapeHTML(t.prompt)}</div>
      </div>
    `).join('');
  }

  modal.classList.remove('hidden');
}
window.openCanvasPromptPicker = openCanvasPromptPicker;

function applyCanvasPromptTemplate(nodeId, promptText) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (node) {
    node.content = promptText;
    saveCanvasState();
    renderCanvasNodesAndLines();
    showToast('📚 提示词模板已成功导入该节点！', 'success');
  }
  const modal = document.getElementById('modalCanvasPromptPicker');
  if (modal) modal.classList.add('hidden');
}
window.applyCanvasPromptTemplate = applyCanvasPromptTemplate;


// 📦 从资产库选择图片/视频导入到画布节点 (支持 5 大分类 Pill 切换)
let currentCanvasAssetPickerNodeId = null;
let currentCanvasAssetCategory = 'all';

function openCanvasAssetPicker(nodeId) {
  const node = canvasState.nodes.find(item => item.id === nodeId);
  if (node && ['submitting', 'generating'].includes(node.status)) {
    showToast('当前节点正在生成，请等待任务完成后再选择资产', 'info');
    return;
  }
  currentCanvasAssetPickerNodeId = nodeId;
  currentCanvasAssetCategory = 'all';
  const modal = document.getElementById('modalCanvasAssetPicker');
  if (!modal) return;

  switchCanvasAssetCategory('all');
  modal.classList.remove('hidden');
}
window.openCanvasAssetPicker = openCanvasAssetPicker;

function switchCanvasAssetCategory(category) {
  currentCanvasAssetCategory = category;
  document.querySelectorAll('#canvasAssetCategoryTabs .canvas-asset-tab').forEach(btn => {
    if (btn.getAttribute('onclick').includes(`'${category}'`)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  renderCanvasAssetPickerGrid();
}
window.switchCanvasAssetCategory = switchCanvasAssetCategory;

function renderCanvasAssetPickerGrid() {
  const container = document.getElementById('canvasAssetPickerGrid');
  if (!container || !currentCanvasAssetPickerNodeId) return;

  initAssetAndPromptData();
  const allAssets = state.assets || [];
  const mediaList = state.chatRefMediaList || [];

  let filtered = [];
  if (currentCanvasAssetCategory === 'all') {
    filtered = allAssets;
  } else if (currentCanvasAssetCategory === 'renwu') {
    filtered = allAssets.filter(a => (a.category || '人物') === '人物');
  } else if (currentCanvasAssetCategory === 'daoju') {
    filtered = allAssets.filter(a => a.category === '道具');
  } else if (currentCanvasAssetCategory === 'changjing') {
    filtered = allAssets.filter(a => a.category === '场景');
  } else if (currentCanvasAssetCategory === 'uploaded') {
    if (mediaList.length === 0) {
      container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; grid-column: 1/-1;">暂无已上传的本地图片/视频资源</div>';
      return;
    }
    container.innerHTML = mediaList.map(item => `
      <div class="canvas-asset-picker-card" onclick="applyCanvasAsset('${currentCanvasAssetPickerNodeId}', '${item.url}', \`${escapeHTML(item.fileName).replace(/`/g, '\`')}\`)">
        ${item.type === 'video' ? `<video data-lazy-video-src="${escapeHTML(item.url)}" data-lazy-video-release="auto" style="width:100%; height:90px; object-fit:cover; display:block;" muted playsinline preload="none"></video>` : `<img src="${item.url}" style="width:100%; height:90px; object-fit:cover; display:block;" alt="" />`}
        <div style="font-size:0.75rem; font-weight:600; padding:6px; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(item.fileName)}</div>
      </div>
    `).join('');
    observeManagedVideos(container);
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; grid-column: 1/-1;">暂无该分类的资产</div>';
    return;
  }

  container.innerHTML = filtered.map(a => {
    const imgUrl = a.imageUrl || 'assets/logo_brand.png';
    return `
      <div class="canvas-asset-picker-card" onclick="applyCanvasAsset('${currentCanvasAssetPickerNodeId}', '${imgUrl}', \`${escapeHTML(a.name).replace(/`/g, '\`')}\`)">
        <img src="${imgUrl}" style="width:100%; height:90px; object-fit:cover; display:block;" alt="" />
        <div style="font-size:0.75rem; font-weight:600; padding:6px; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(a.name)}</div>
      </div>
    `;
  }).join('');
}
window.renderCanvasAssetPickerGrid = renderCanvasAssetPickerGrid;

function applyCanvasAsset(nodeId, imgUrl, assetName) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (node && ['submitting', 'generating'].includes(node.status)) {
    showToast('当前节点正在生成，暂时不能替换图片', 'info');
    return;
  }
  if (node) {
    const sourceAsset = (state.assets || []).find(asset => asset.imageUrl === imgUrl)
      || (state.chatRefMediaList || []).find(asset => asset.url === imgUrl);
    node.imgUrl = imgUrl;
    node.mediaReference = sourceAsset?.mediaReference || sourceAsset?.reference || '';
    node.mediaId = sourceAsset?.mediaId || sourceAsset?.id || null;
    node.assetName = assetName;
    node.title = assetName;
    node.errorMsg = '';
    saveCanvasState();
    renderCanvasNodesAndLines();
    showToast(`📦 已将【${assetName}】成功导入该参考图节点！`, 'success');
  }
  const modal = document.getElementById('modalCanvasAssetPicker');
  if (modal) modal.classList.add('hidden');
}
window.applyCanvasAsset = applyCanvasAsset;

// ---------- 提示词节点可视化 @ 引用（contenteditable） ----------

function renderCanvasNodeContentWithMentions(text, currentNodeId) {
  if (!text) return '<br>';
  const parts = [];
  let lastIndex = 0;
  const mentionRegex = /@\[([^\]]+)\]/g;
  text.replace(mentionRegex, (match, raw, offset) => {
    if (offset > lastIndex) {
      parts.push(escapeHTML(text.slice(lastIndex, offset)).replace(/\n/g, '<br>'));
    }
    const { nodeId, title } = parseCanvasMentionRef(raw);
    const targetNode = findCanvasMentionTarget(raw, currentNodeId);
    const safeTitle = escapeHTML(title || '未知节点');
    const safeNodeId = escapeHTML(nodeId || targetNode?.id || '');
    const typeAttr = targetNode ? `data-type="${targetNode.type}"` : '';
    if (!targetNode) {
      parts.push(`<span class="canvas-mention canvas-mention-broken" contenteditable="false" data-node-id="${safeNodeId}" data-title="${safeTitle}" ${typeAttr}><span class="canvas-mention-tag">${safeTitle}</span></span>`);
    } else if (targetNode.type === 'asset' && getCanvasNodeImageSources(targetNode)[0]) {
      const imageSource = escapeHTML(getCanvasNodeImageSources(targetNode)[0]);
      parts.push(`<span class="canvas-mention canvas-mention-image" contenteditable="false" data-node-id="${safeNodeId}" data-title="${safeTitle}" title="${safeTitle}" ${typeAttr}><img class="canvas-mention-thumb" src="${imageSource}" alt="" /></span>`);
    } else if (targetNode.type === 'video' && getCanvasNodeVideoSources(targetNode)[0]) {
      const videoSource = escapeHTML(getCanvasNodeVideoSources(targetNode)[0]);
      parts.push(`<span class="canvas-mention canvas-mention-video" contenteditable="false" data-node-id="${safeNodeId}" data-title="${safeTitle}" title="${safeTitle}" ${typeAttr}><video class="canvas-mention-thumb" data-lazy-video-src="${videoSource}" data-lazy-video-release="auto" muted playsinline preload="none"></video></span>`);
    } else if (targetNode.type === 'audio' && getCanvasNodeAudioSources(targetNode)[0]) {
      parts.push(`<span class="canvas-mention canvas-mention-audio" contenteditable="false" data-node-id="${safeNodeId}" data-title="${safeTitle}" title="${safeTitle}" ${typeAttr}><span class="canvas-mention-audio-icon">♫</span></span>`);
    } else if (targetNode.type === 'agent') {
      parts.push(`<span class="canvas-mention canvas-mention-agent" contenteditable="false" data-node-id="${safeNodeId}" data-title="${safeTitle}" ${typeAttr}><span class="canvas-mention-tag">🤖 ${safeTitle}</span></span>`);
    } else {
      parts.push(`<span class="canvas-mention canvas-mention-text" contenteditable="false" data-node-id="${safeNodeId}" data-title="${safeTitle}" ${typeAttr}><span class="canvas-mention-tag">${safeTitle}</span></span>`);
    }
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < text.length) {
    parts.push(escapeHTML(text.slice(lastIndex)).replace(/\n/g, '<br>'));
  }
  return parts.join('') || '<br>';
}
window.renderCanvasNodeContentWithMentions = renderCanvasNodeContentWithMentions;

function getCanvasNodeEditorText(editorEl) {
  const clone = editorEl.cloneNode(true);
  clone.querySelectorAll('.canvas-mention').forEach(span => {
    const nodeId = span.dataset.nodeId;
    const title = span.dataset.title;
    if (nodeId && title) {
      span.replaceWith(document.createTextNode(`@[${nodeId}|${title}]`));
    } else if (title) {
      span.replaceWith(document.createTextNode(`@[${title}]`));
    } else {
      span.remove();
    }
  });
  let html = clone.innerHTML;
  html = html.replace(/<br[^>]*>/gi, '\n');
  html = html.replace(/<\/div><div[^>]*>/gi, '\n');
  html = html.replace(/<div[^>]*>/gi, '').replace(/<\/div>/gi, '');
  html = html.replace(/<[^>]+>/g, '');
  const tmp = document.createElement('textarea');
  tmp.innerHTML = html;
  return tmp.value;
}
window.getCanvasNodeEditorText = getCanvasNodeEditorText;

function getCanvasNodeMentionEditor(nodeId) {
  return document.querySelector(`#${CSS.escape(nodeId)} .canvas-node-prompt-editor`)
    || document.querySelector(`#${CSS.escape(nodeId)} .canvas-node-content-editor`)
    || document.querySelector(`#${CSS.escape(nodeId)} .canvas-node-editor`);
}

function isCanvasEditorRangeValid(range, editorEl) {
  return !!(range
    && editorEl
    && range.startContainer?.isConnected
    && range.endContainer?.isConnected
    && editorEl.contains(range.startContainer)
    && editorEl.contains(range.endContainer));
}

function rememberCanvasEditorSelection(nodeId, editorEl = null) {
  const editor = editorEl || getCanvasNodeMentionEditor(nodeId);
  if (!editor) return null;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return canvasEditorSelectionRanges.get(nodeId) || null;
  const range = sel.getRangeAt(0);
  if (!isCanvasEditorRangeValid(range, editor)) return canvasEditorSelectionRanges.get(nodeId) || null;
  const storedRange = range.cloneRange();
  canvasEditorSelectionRanges.set(nodeId, storedRange);
  return storedRange;
}
window.rememberCanvasEditorSelection = rememberCanvasEditorSelection;

function getCanvasEditorCursorState(editorEl) {
  const nodeId = editorEl?.closest('.canvas-node-composer')?.dataset.nodeId || editorEl?.closest('.canvas-node')?.id || '';
  const sel = window.getSelection();
  const liveRange = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  const storedRange = nodeId ? canvasEditorSelectionRanges.get(nodeId) : null;
  const range = isCanvasEditorRangeValid(liveRange, editorEl)
    ? liveRange
    : (isCanvasEditorRangeValid(storedRange, editorEl) ? storedRange : null);
  if (!range) return null;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(editorEl);
  preRange.setEnd(range.endContainer, range.endOffset);
  const prefixContainer = document.createElement('div');
  prefixContainer.appendChild(preRange.cloneContents());
  return { textBeforeCursor: getCanvasNodeEditorText(prefixContainer), range };
}

function commitCanvasMentionEditor(nodeId, editorEl) {
  if (editorEl.classList.contains('canvas-node-prompt-editor')) onCanvasNodePromptEditorInput(nodeId, editorEl);
  else onCanvasNodeEditorInput(nodeId, editorEl);
  rememberCanvasEditorSelection(nodeId, editorEl);
}

function placeCanvasEditorCursorAfter(editorEl, targetNode) {
  const sel = window.getSelection();
  const range = document.createRange();
  range.setStartAfter(targetNode);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  editorEl.focus();
}

function findCanvasMentionBeforeCursor(range) {
  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    if (range.startOffset > 0) return null;
    node = node.previousSibling;
  }
  if (node && node.nodeType === Node.ELEMENT_NODE && node.classList && node.classList.contains('canvas-mention')) {
    return node;
  }
  return null;
}

function findCanvasMentionAfterCursor(range) {
  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    if (range.startOffset < (node.textContent || '').length) return null;
    node = node.nextSibling;
  }
  if (node && node.nodeType === Node.ELEMENT_NODE && node.classList && node.classList.contains('canvas-mention')) {
    return node;
  }
  return null;
}

function onCanvasNodeEditorInput(nodeId, editorEl) {
  const text = getCanvasNodeEditorText(editorEl);
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (node) {
    node.content = text;
    node.rawContent = text;
    saveCanvasState();
    const preview = document.querySelector(`#${CSS.escape(nodeId)} .canvas-pure-text`);
    if (preview) preview.innerHTML = renderCanvasNodeContentWithMentions(text || '文本', nodeId);
    const btn = document.querySelector(`#${nodeId} .btn-ai-expand-canvas`);
    if (btn && !canvasNodeExpandingState[nodeId]) {
      btn.textContent = '✨ AI扩写';
    }
  }
  rememberCanvasEditorSelection(nodeId, editorEl);
  updateCanvasAtMention(nodeId);
}
window.onCanvasNodeEditorInput = onCanvasNodeEditorInput;

function onCanvasNodePromptEditorInput(nodeId, editorEl) {
  const node = canvasState.nodes.find(item => item.id === nodeId);
  if (!node || !editorEl) return;
  node.prompt = getCanvasNodeEditorText(editorEl);
  saveCanvasState();
  rememberCanvasEditorSelection(nodeId, editorEl);
  updateCanvasAtMention(nodeId);
}
window.onCanvasNodePromptEditorInput = onCanvasNodePromptEditorInput;

function onCanvasNodeEditorClick(event, nodeId) {
  const span = event.target.closest('.canvas-mention');
  if (span) {
    event.preventDefault();
    event.stopPropagation();
    const editor = document.querySelector(`#${nodeId} .canvas-node-editor`);
    if (editor) placeCanvasEditorCursorAfter(editor, span);
    rememberCanvasEditorSelection(nodeId, editor);
    return;
  }
  rememberCanvasEditorSelection(nodeId, event.currentTarget);
}
window.onCanvasNodeEditorClick = onCanvasNodeEditorClick;

function onCanvasNodeEditorPaste(event, nodeId) {
  event.preventDefault();
  const text = (event.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
}
window.onCanvasNodeEditorPaste = onCanvasNodeEditorPaste;

function onCanvasNodeEditorKeydown(event, nodeId) {
  const editor = document.querySelector(`#${nodeId} .canvas-node-editor`);
  if (!editor) return;

  if (canvasAtMentionState.activeNodeId === nodeId) {
    const dropdown = document.getElementById('canvasAtMentionDropdown');
    if (dropdown) {
      const items = dropdown.querySelectorAll('.canvas-at-mention-item');
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        canvasAtMentionState.selectedIndex = (canvasAtMentionState.selectedIndex + 1) % items.length;
        updateCanvasAtMentionSelection(items);
        return;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        canvasAtMentionState.selectedIndex = (canvasAtMentionState.selectedIndex - 1 + items.length) % items.length;
        updateCanvasAtMentionSelection(items);
        return;
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const selected = items[canvasAtMentionState.selectedIndex];
        if (selected) insertCanvasAtMention(nodeId, selected.dataset.nodeId, selected.dataset.title);
        return;
      } else if (event.key === 'Escape') {
        hideCanvasAtMentionDropdown();
        canvasAtMentionState = { activeNodeId: null, query: '', startIndex: -1, selectedIndex: 0 };
        return;
      }
    }
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const mention = event.key === 'Backspace' ? findCanvasMentionBeforeCursor(range) : findCanvasMentionAfterCursor(range);
    if (mention) {
      event.preventDefault();
      mention.remove();
      commitCanvasMentionEditor(nodeId, editor);
    }
  }
}
window.onCanvasNodeEditorKeydown = onCanvasNodeEditorKeydown;

function onCanvasNodeEditorKeyup(event, nodeId) {
  rememberCanvasEditorSelection(nodeId, event.currentTarget);
  updateCanvasAtMention(nodeId);
}
window.onCanvasNodeEditorKeyup = onCanvasNodeEditorKeyup;

// 当用户在编辑框内手动修改、删除或新增文本时，按钮立即变回【✨ AI扩写】，并更新 rawContent 为当前编辑后的文本
function onCanvasNodeTextareaInput(nodeId, newContent) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (node) {
    node.content = newContent;
    // 只要有任何修改/删除/新增，基于现在的文本作为下一次扩写的基准
    node.rawContent = newContent;
    saveCanvasState();

    const nodeEl = document.getElementById(nodeId);
    if (nodeEl) {
      const btn = nodeEl.querySelector('.btn-ai-expand-canvas');
      if (btn && !canvasNodeExpandingState[nodeId]) {
        btn.textContent = '✨ AI扩写';
      }
    }

    updateCanvasAtMention(nodeId);
  }
}
window.onCanvasNodeTextareaInput = onCanvasNodeTextareaInput;

function updateCanvasAtMention(nodeId) {
  const editor = document.querySelector(`#${nodeId} .canvas-node-editor`) || document.querySelector(`#${nodeId} .canvas-node-textarea`);
  if (!editor) {
    hideCanvasAtMentionDropdown();
    return;
  }
  let textBeforeCursor = '';
  if (editor.tagName === 'TEXTAREA') {
    const cursorPos = editor.selectionStart || 0;
    textBeforeCursor = editor.value.slice(0, cursorPos);
  } else {
    const state = getCanvasEditorCursorState(editor);
    if (!state) { hideCanvasAtMentionDropdown(); return; }
    textBeforeCursor = state.textBeforeCursor;
  }
  let atIndex = -1;
  for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
    const ch = textBeforeCursor[i];
    if (ch === '@') { atIndex = i; break; }
    if (ch === '\n' || ch === ' ' || ch === ']' || ch === '[') break;
  }
  if (atIndex === -1) {
    hideCanvasAtMentionDropdown();
    return;
  }
  const query = textBeforeCursor.slice(atIndex + 1);
  canvasAtMentionState = {
    activeNodeId: nodeId,
    query,
    startIndex: atIndex,
    selectedIndex: 0
  };
  renderCanvasAtMentionDropdown(nodeId, editor, query);
}
window.updateCanvasAtMention = updateCanvasAtMention;

function getCanvasAtMentionCandidates(nodeId) {
  return getSelectedCanvasInputNodes(nodeId).filter(node => {
    if (node.type === 'asset') return getCanvasNodeImageSources(node).length > 0;
    if (node.type === 'video') return getCanvasNodeVideoSources(node).length > 0;
    if (node.type === 'audio') return getCanvasNodeAudioSources(node).length > 0;
    return false;
  });
}

function renderCanvasAtMentionDropdown(nodeId, editor, query) {
  hideCanvasAtMentionDropdown();
  const candidates = getCanvasAtMentionCandidates(nodeId);
  const lowerQuery = query.toLowerCase();
  const filtered = candidates.filter(node => {
    const title = (node.title || node.assetName || '').replace(/^[🤖📝🖼️🎬🎧\s]+/, '').toLowerCase();
    return title.includes(lowerQuery);
  });
  if (filtered.length === 0) {
    canvasAtMentionState.activeNodeId = null;
    return;
  }
  let left = 0, top = 0;
  if (editor.tagName === 'TEXTAREA') {
    const rect = editor.getBoundingClientRect();
    left = rect.left;
    top = rect.bottom + 4;
  } else {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const rects = sel.getRangeAt(0).getClientRects();
      const rect = rects.length > 0 ? rects[0] : editor.getBoundingClientRect();
      left = rect.left;
      top = rect.bottom + 4;
    } else {
      const rect = editor.getBoundingClientRect();
      left = rect.left;
      top = rect.bottom + 4;
    }
  }
  const dropdown = document.createElement('div');
  dropdown.id = 'canvasAtMentionDropdown';
  dropdown.className = 'canvas-at-mention-dropdown';
  dropdown.style.position = 'fixed';
  dropdown.style.left = `${left}px`;
  dropdown.style.top = `${top}px`;
  dropdown.style.zIndex = '1000';
  dropdown.innerHTML = filtered.map((node, index) => {
    const cleanTitle = (node.title || node.assetName || '未命名节点').replace(/^[🤖📝🖼️🎬\s]+/, '');
    let preview = '';
    if (node.type === 'asset' && node.imgUrl) {
      preview = `<img src="${node.imgUrl}" class="canvas-at-mention-thumb" alt="" />`;
    } else if (node.type === 'video' && node.videoUrl) {
      preview = `<video data-lazy-video-src="${escapeHTML(node.videoUrl)}" data-lazy-video-release="auto" class="canvas-at-mention-thumb" muted playsinline preload="none"></video>`;
    } else if (node.type === 'audio' && node.audioUrl) {
      preview = '<div class="canvas-at-mention-icon canvas-audio-reference">♫</div>';
    } else if (node.type === 'text') {
      preview = `<div class="canvas-at-mention-text-preview">${escapeHTML((node.content || '').slice(0, 40))}</div>`;
    } else if (node.type === 'agent') {
      preview = `<div class="canvas-at-mention-text-preview">🤖 ${escapeHTML((node.outputContent || node.systemPrompt || '').slice(0, 40))}</div>`;
    } else {
      preview = `<div class="canvas-at-mention-icon">${node.type === 'asset' ? '🖼️' : node.type === 'video' ? '🎬' : node.type === 'audio' ? '🎧' : '📝'}</div>`;
    }
    return `<div class="canvas-at-mention-item ${index === canvasAtMentionState.selectedIndex ? 'selected' : ''}" data-node-id="${node.id}" data-title="${escapeHTML(cleanTitle)}">
      <div class="canvas-at-mention-preview">${preview}</div>
      <div class="canvas-at-mention-info"><strong>${escapeHTML(cleanTitle)}</strong><small>${node.type === 'text' ? '提示词' : node.type === 'asset' ? '图片' : node.type === 'video' ? '视频' : node.type === 'audio' ? '音频' : '智能体'}</small></div>
    </div>`;
  }).join('');
  dropdown.querySelectorAll('.canvas-at-mention-item').forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      insertCanvasAtMention(nodeId, item.dataset.nodeId, item.dataset.title);
    };
  });
  document.body.appendChild(dropdown);
  observeManagedVideos(dropdown);
}

function hideCanvasAtMentionDropdown() {
  const dropdown = document.getElementById('canvasAtMentionDropdown');
  if (dropdown) dropdown.remove();
}
window.hideCanvasAtMentionDropdown = hideCanvasAtMentionDropdown;

function onCanvasNodeTextareaKeydown(event, nodeId) {
  if (!canvasAtMentionState.activeNodeId || canvasAtMentionState.activeNodeId !== nodeId) return;
  const dropdown = document.getElementById('canvasAtMentionDropdown');
  if (!dropdown) return;
  const items = dropdown.querySelectorAll('.canvas-at-mention-item');
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    canvasAtMentionState.selectedIndex = (canvasAtMentionState.selectedIndex + 1) % items.length;
    updateCanvasAtMentionSelection(items);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    canvasAtMentionState.selectedIndex = (canvasAtMentionState.selectedIndex - 1 + items.length) % items.length;
    updateCanvasAtMentionSelection(items);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const selected = items[canvasAtMentionState.selectedIndex];
    if (selected) insertCanvasAtMention(nodeId, selected.dataset.nodeId, selected.dataset.title);
  } else if (event.key === 'Escape') {
    hideCanvasAtMentionDropdown();
    canvasAtMentionState = { activeNodeId: null, query: '', startIndex: -1, selectedIndex: 0 };
  }
}
window.onCanvasNodeTextareaKeydown = onCanvasNodeTextareaKeydown;

function updateCanvasAtMentionSelection(items) {
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === canvasAtMentionState.selectedIndex);
  });
}

function insertCanvasAtMention(nodeId, sourceNodeId, sourceTitle) {
  const editor = document.querySelector(`#${nodeId} .canvas-node-editor`);
  const textarea = document.querySelector(`#${nodeId} .canvas-node-textarea`);
  if (editor) {
    const state = getCanvasEditorCursorState(editor);
    const textBeforeCursor = state ? state.textBeforeCursor : '';
    let atIndex = -1;
    for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
      if (textBeforeCursor[i] === '@') { atIndex = i; break; }
      if (textBeforeCursor[i] === '\n' || textBeforeCursor[i] === ' ') break;
    }
    const text = getCanvasNodeEditorText(editor);
    const before = atIndex >= 0 ? text.slice(0, atIndex) : text;
    const after = atIndex >= 0 ? text.slice(textBeforeCursor.length) : '';
    const insertText = `@[${sourceNodeId}|${sourceTitle}]`;
    const newValue = before + insertText + after;
    editor.innerHTML = renderCanvasNodeContentWithMentions(newValue, nodeId);
    commitCanvasMentionEditor(nodeId, editor);
    placeCanvasEditorCursorAtEnd(editor);
  } else if (textarea) {
    const value = textarea.value;
    const { startIndex } = canvasAtMentionState;
    const cursorPos = textarea.selectionStart || 0;
    const before = value.slice(0, startIndex);
    const after = value.slice(cursorPos);
    const insertText = `@[${sourceNodeId}|${sourceTitle}]`;
    const newValue = before + insertText + after;
    textarea.value = newValue;
    textarea.selectionStart = textarea.selectionEnd = startIndex + insertText.length;
    textarea.focus();
    onCanvasNodeTextareaInput(nodeId, newValue);
  }
  hideCanvasAtMentionDropdown();
  canvasAtMentionState = { activeNodeId: null, query: '', startIndex: -1, selectedIndex: 0 };
}

function placeCanvasEditorCursorAtEnd(editorEl) {
  const range = document.createRange();
  range.selectNodeContents(editorEl);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  editorEl.focus();
}
window.insertCanvasAtMention = insertCanvasAtMention;

function insertCanvasSelectedInputMention(nodeId, sourceNodeId, event) {
  event?.preventDefault();
  event?.stopPropagation();
  const sourceNode = getSelectedCanvasInputNodes(nodeId).find(item => item.id === sourceNodeId);
  const isUsableImage = sourceNode?.type === 'asset' && getCanvasNodeImageSources(sourceNode).length > 0;
  const isUsableVideo = sourceNode?.type === 'video' && getCanvasNodeVideoSources(sourceNode).length > 0;
  const isUsableAudio = sourceNode?.type === 'audio' && getCanvasNodeAudioSources(sourceNode).length > 0;
  if (!sourceNode || (!isUsableImage && !isUsableVideo && !isUsableAudio)) {
    showToast('当前输入没有可引用的图片、视频或音频内容', 'info');
    return;
  }

  const editor = getCanvasNodeMentionEditor(nodeId);
  if (!editor || editor.contentEditable === 'false') {
    showToast('当前节点正在生成，暂时不能修改提示词', 'info');
    return;
  }
  const cursorState = getCanvasEditorCursorState(editor);
  let range = cursorState?.range?.cloneRange();
  if (!isCanvasEditorRangeValid(range, editor)) {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  if (!range.collapsed) range.deleteContents();

  const title = (sourceNode.title || sourceNode.assetName || '未命名节点').replace(/^[🤖📝🖼️🎬🎧\s]+/, '') || '未命名节点';
  const template = document.createElement('template');
  template.innerHTML = renderCanvasNodeContentWithMentions(`@[${sourceNode.id}|${title}]`, nodeId);
  const mention = template.content.querySelector('.canvas-mention');
  if (!mention) return;
  const spacer = document.createTextNode(' ');
  const fragment = document.createDocumentFragment();
  fragment.append(mention, spacer);
  range.insertNode(fragment);
  range.setStartAfter(spacer);
  range.collapse(true);

  editor.focus({ preventScroll: true });
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  canvasEditorSelectionRanges.set(nodeId, range.cloneRange());
  commitCanvasMentionEditor(nodeId, editor);
  hideCanvasAtMentionDropdown();
}
window.insertCanvasSelectedInputMention = insertCanvasSelectedInputMention;

// ---------- @ 引用悬停预览 tooltip ----------
function showCanvasMentionTooltip(node, anchorEl) {
  hideCanvasMentionTooltip();
  if (!node) return;
  const tooltip = document.createElement('div');
  tooltip.id = 'canvasMentionTooltip';
  tooltip.className = 'canvas-mention-tooltip';
  let body = '';
  const title = escapeHTML(node.title || node.assetName || '未命名节点');
  const typeLabel = node.type === 'asset' ? '图片' : node.type === 'video' ? '视频' : node.type === 'audio' ? '音频' : node.type === 'agent' ? '智能体' : '提示词';
  const imageSource = getCanvasNodeImageSources(node)[0];
  const videoSource = getCanvasNodeVideoSources(node)[0];
  const audioSource = getCanvasNodeAudioSources(node)[0];
  if (node.type === 'asset' && imageSource) {
    body = `<div class="canvas-mention-tooltip-title">${title}</div><div class="canvas-mention-tooltip-type">${typeLabel}</div><img class="canvas-mention-tooltip-img" src="${escapeHTML(imageSource)}" alt="" />`;
  } else if (node.type === 'video' && videoSource) {
    body = `<div class="canvas-mention-tooltip-title">${title}</div><div class="canvas-mention-tooltip-type">${typeLabel}</div><div class="canvas-mention-tooltip-video-placeholder" aria-label="视频引用未加载">▶ 点击节点播放时再加载视频</div>`;
  } else if (node.type === 'audio' && audioSource) {
    body = `<div class="canvas-mention-tooltip-title">${title}</div><div class="canvas-mention-tooltip-type">${typeLabel}</div><audio class="canvas-mention-tooltip-audio" src="${escapeHTML(audioSource)}" controls preload="metadata"></audio>`;
  } else if (node.type === 'text') {
    body = `<div class="canvas-mention-tooltip-title">${title}</div><div class="canvas-mention-tooltip-type">${typeLabel}</div><div class="canvas-mention-tooltip-text">${escapeHTML(node.content || '')}</div>`;
  } else if (node.type === 'agent') {
    body = `<div class="canvas-mention-tooltip-title">${title}</div><div class="canvas-mention-tooltip-type">${typeLabel}</div><div class="canvas-mention-tooltip-text">${escapeHTML(node.outputContent || node.systemPrompt || '')}</div>`;
  } else {
    body = `<div class="canvas-mention-tooltip-title">${title}</div><div class="canvas-mention-tooltip-type">${typeLabel}</div>`;
  }
  tooltip.innerHTML = body;
  document.body.appendChild(tooltip);
  const anchorRect = anchorEl.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  let left = anchorRect.left;
  let top = anchorRect.bottom + 6;
  if (left + tooltipRect.width > window.innerWidth - 8) {
    left = window.innerWidth - tooltipRect.width - 8;
  }
  if (top + tooltipRect.height > window.innerHeight - 8) {
    top = anchorRect.top - tooltipRect.height - 6;
  }
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}
window.showCanvasMentionTooltip = showCanvasMentionTooltip;

function hideCanvasMentionTooltip() {
  const tooltip = document.getElementById('canvasMentionTooltip');
  if (tooltip) tooltip.remove();
}
window.hideCanvasMentionTooltip = hideCanvasMentionTooltip;

// ⛶ 切换全屏沉浸模式 (支持最左侧灰色 Back 箭头一键退出)
function toggleCanvasFullscreen() {
  const canvasView = document.getElementById('viewCanvasMode');
  if (!canvasView) return;

  const isFull = canvasView.classList.toggle('is-immersive-fullscreen');

  if (isFull) {
    showToast('⛶ 已开启全屏沉浸模式 (点击最左侧 ← 箭头或按 Esc 退出)', 'info');
  } else {
    showToast('已退出全屏沉浸模式', 'info');
  }

  setTimeout(() => {
    if (typeof autoFitCanvasToViewport === 'function') autoFitCanvasToViewport();
    if (typeof drawCanvasLines === 'function') drawCanvasLines();
  }, 100);
}
window.toggleCanvasFullscreen = toggleCanvasFullscreen;

// 绑定全屏按钮与 ESC 快捷键
document.addEventListener('DOMContentLoaded', () => {
  const btnFull = document.getElementById('btnCanvasToggleFullscreen');
  if (btnFull) {
    btnFull.onclick = (e) => {
      e.stopPropagation();
      toggleCanvasFullscreen();
    };
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const canvasView = document.getElementById('viewCanvasMode');
    if (canvasView && canvasView.classList.contains('is-immersive-fullscreen')) {
      toggleCanvasFullscreen();
    }
  }
});

// 节点添加快捷全局处理函数
function addCanvasTextNode(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const center = getCanvasViewportCenterPos();
  addCanvasNode({
    id: 'node_text_' + Date.now(),
    type: 'text',
    x: center.x,
    y: center.y,
    title: '📝 提示词节点',
    model: getPreferredServerModel('canvas', 'llm'),
    content: '描述您想要生成的视频画面...'
  });
  showToast('已成功添加提示词节点', 'success');
}
window.addCanvasTextNode = addCanvasTextNode;

function addCanvasAssetNode(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const defaultImg = (state.assets && state.assets[0]) ? state.assets[0].imageUrl : '';
  const defaultName = (state.assets && state.assets[0]) ? state.assets[0].name : '参考图';
  const center = getCanvasViewportCenterPos();
  addCanvasNode({
    id: 'node_asset_' + Date.now(),
    type: 'asset',
    x: center.x,
    y: center.y,
    title: '🖼️ 参考图节点',
    model: getPreferredServerModel('canvas', 'image'),
    assetName: defaultName,
    imgUrl: defaultImg,
    mediaAutoSizePending: !!defaultImg
  });
  showToast('已成功添加参考图节点', 'success');
}
window.addCanvasAssetNode = addCanvasAssetNode;

function getCanvasVideoDurationMemory(node) {
  const memory = { ...(node?.durationByModel || {}) };
  getServerModels('canvas', 'video').forEach(item => {
    memory[item.model] = getCanvasVideoDurationSpec(item.model, memory[item.model]).value;
  });
  return memory;
}

function closeCanvasVideoModelDropdowns(exceptNodeId = null) {
  document.querySelectorAll('.canvas-video-model-dropdown.open').forEach(dropdown => {
    if (exceptNodeId && dropdown.dataset.nodeId === exceptNodeId) return;
    dropdown.classList.remove('open');
    dropdown.querySelector('.canvas-video-model-trigger')?.setAttribute('aria-expanded', 'false');
  });
}

function toggleCanvasVideoModelDropdown(nodeId, event) {
  event?.preventDefault();
  event?.stopPropagation();
  const dropdown = document.querySelector(`.canvas-video-model-dropdown[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!dropdown) return;
  const shouldOpen = !dropdown.classList.contains('open');
  closeCanvasVideoModelDropdowns(nodeId);
  dropdown.classList.toggle('open', shouldOpen);
  dropdown.querySelector('.canvas-video-model-trigger')?.setAttribute('aria-expanded', String(shouldOpen));
}
window.toggleCanvasVideoModelDropdown = toggleCanvasVideoModelDropdown;

function selectCanvasVideoModel(nodeId, model, event) {
  event?.preventDefault();
  event?.stopPropagation();
  closeCanvasVideoModelDropdowns();
  onCanvasVideoNodeParamChange(nodeId, 'model', model);
}
window.selectCanvasVideoModel = selectCanvasVideoModel;

function selectCanvasVideoModelEncoded(nodeId, encodedModel, event) {
  selectCanvasVideoModel(nodeId, decodeURIComponent(encodedModel), event);
}
window.selectCanvasVideoModelEncoded = selectCanvasVideoModelEncoded;

function selectCanvasNodeModel(nodeId, operation, model, event) {
  event?.preventDefault();
  event?.stopPropagation();
  if (operation === 'video') return selectCanvasVideoModel(nodeId, model, event);
  const node = canvasState.nodes.find(item => item.id === nodeId);
  const expectedType = operation === 'image' ? 'asset' : operation === 'llm' ? 'text' : '';
  if (!node || node.type !== expectedType) return;
  node.model = model;
  closeCanvasVideoModelDropdowns();
  saveCanvasState();
  renderCanvasNodesAndLines();
}
window.selectCanvasNodeModel = selectCanvasNodeModel;

function selectCanvasNodeModelEncoded(nodeId, operation, encodedModel, event) {
  selectCanvasNodeModel(nodeId, operation, decodeURIComponent(encodedModel), event);
}
window.selectCanvasNodeModelEncoded = selectCanvasNodeModelEncoded;

function getCanvasVideoDurationSpec(model, rawValue) {
  if (isCustomDurationVideoModel(model)) {
    return { min: 4, max: 30, step: 1, value: clampVideoDuration(rawValue, 4, 30, 5) };
  }
  const parsed = parseInt(rawValue, 10);
  const allowed = [5, 10, 15];
  const value = Number.isFinite(parsed)
    ? allowed.reduce((closest, candidate) => Math.abs(candidate - parsed) < Math.abs(closest - parsed) ? candidate : closest, allowed[0])
    : 15;
  return { min: 5, max: 15, step: 5, value };
}

function syncCanvasVideoDurationControl(nodeId, rawValue, sourceType, commit) {
  const node = canvasState.nodes.find(item => item.id === nodeId);
  if (!node) return;
  const spec = getCanvasVideoDurationSpec(node.model, rawValue);
  const parsed = parseInt(rawValue, 10);
  if (!commit && sourceType === 'number') return;
  if (!Number.isFinite(parsed)) {
    if (commit) {
      const fallback = getCanvasVideoDurationSpec(node.model, node.duration).value;
      const nodeElement = document.getElementById(nodeId);
      nodeElement?.querySelectorAll('.canvas-video-duration-slider input').forEach(input => { input.value = String(fallback); });
    }
    return;
  }
  const value = spec.value;
  const nodeElement = document.getElementById(nodeId);
  const control = nodeElement?.querySelector('.canvas-video-duration-slider');
  if (control) control.querySelectorAll('input').forEach(input => { input.value = String(value); });
  if (commit) onCanvasVideoNodeParamChange(nodeId, 'duration', value);
}
window.syncCanvasVideoDurationControl = syncCanvasVideoDurationControl;

document.addEventListener('click', () => closeCanvasVideoModelDropdowns());

function addCanvasVideoNode(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const center = getCanvasViewportCenterPos();
  const defaultModel = getPreferredServerModel('canvas', 'video');
  addCanvasNode({
    id: 'node_video_' + Date.now(),
    type: 'video',
    x: center.x + 80,
    y: center.y,
    title: '🎬 AI 视频生成节点',
    model: defaultModel,
    aspect: '16:9',
    duration: 15,
    durationByModel: { [defaultModel]: isCustomDurationVideoModel(defaultModel) ? 5 : 15 },
    videoUrl: null,
    status: 'idle'
  });
  showToast('已成功添加视频生成节点', 'success');
}
window.addCanvasVideoNode = addCanvasVideoNode;

function addCanvasAudioNode(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const center = getCanvasViewportCenterPos();
  addCanvasNode({
    id: 'node_audio_' + Date.now(),
    type: 'audio',
    x: center.x + 40,
    y: center.y + 40,
    width: 330,
    height: 170,
    title: '🎧 音频节点',
    assetName: '参考音频',
    audioUrl: '',
    status: 'idle'
  });
  showToast('已添加音频节点，请上传参考音频', 'success');
}
window.addCanvasAudioNode = addCanvasAudioNode;

// 视频节点参数 (模型、比例、时长) 修改更新函数
function onCanvasVideoNodeParamChange(nodeId, key, value) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (!node) return;

  if (key === 'model') {
    const previousModel = node.model || getPreferredServerModel('canvas', 'video');
    const durationMemory = getCanvasVideoDurationMemory(node);
    durationMemory[previousModel] = getCanvasVideoDurationSpec(previousModel, node.duration).value;
    node.model = value;
    node.durationByModel = durationMemory;
    node.duration = durationMemory[value];
  } else if (key === 'duration') {
    node.duration = getCanvasVideoDurationSpec(node.model, value).value;
    node.durationByModel = getCanvasVideoDurationMemory(node);
    node.durationByModel[node.model || getPreferredServerModel('canvas', 'video')] = node.duration;
  } else {
    node[key] = value;
  }
  saveCanvasState();
  renderCanvasNodesAndLines();
}
window.onCanvasVideoNodeParamChange = onCanvasVideoNodeParamChange;

// 🎨 从生成历史跳转至对应画布节点并居中选中
async function jumpToCanvasNode(taskId) {
  const task = state.taskHistory.find(item => item.taskId === taskId)
    || state.activeTasks.find(item => item.taskId === taskId);
  if (task?.sessionId && SessionSystem.getActive()?.id !== task.sessionId) {
    await SessionSystem.openSession(task.sessionId);
    if (SessionSystem.getActive()?.id !== task.sessionId) {
      showToast('任务来源画布会话已删除或不可用', 'warning');
      return;
    }
  } else if (typeof switchView === 'function') {
    switchView('canvasMode');
  }

  if (canvasState && canvasState.nodes) {
    const node = canvasState.nodes.find(n => n.taskId === taskId || n.id === taskId);
    if (node) {
      if (typeof selectCanvasNode === 'function') selectCanvasNode(node.id);
      const zoom = canvasState.zoom || 1.0;
      canvasState.panX = (window.innerWidth / 2) - (node.x * zoom) - 150;
      canvasState.panY = (window.innerHeight / 2) - (node.y * zoom) - 100;
      pushCanvasUndoState();
      saveCanvasState();
      renderCanvasNodesAndLines();
      showToast('🎨 已成功视角聚焦至历史画布节点！', 'success');
    } else {
      showToast('🎨 已切换至无限画布！', 'info');
    }
  }
}
window.jumpToCanvasNode = jumpToCanvasNode;

// 🧹 1. 苹果风美化清空画布确认弹窗控制
function openClearCanvasConfirmModal() {
  const modal = document.getElementById('modalCanvasClearConfirm');
  if (modal) modal.classList.remove('hidden');
}
window.openClearCanvasConfirmModal = openClearCanvasConfirmModal;

function closeClearCanvasConfirmModal() {
  const modal = document.getElementById('modalCanvasClearConfirm');
  if (modal) modal.classList.add('hidden');
}
window.closeClearCanvasConfirmModal = closeClearCanvasConfirmModal;

function confirmClearCanvas() {
  releaseCanvasLocalMediaUrls(canvasState.nodes);
  canvasState.nodes = [];
  canvasState.connections = [];
  canvasState.selectedNodeIds = [];
  canvasState.selectedPort = null;
  saveCanvasState();
  renderCanvasNodesAndLines();
  closeClearCanvasConfirmModal();
  showToast('🧹 画布已全量清空', 'info');
}
window.confirmClearCanvas = confirmClearCanvas;


// 💾 2. 保存收录至画布库弹窗控制与持久化
function openSaveCanvasLibraryModal() {
  if (!canvasState.nodes || canvasState.nodes.length === 0) {
    showToast('⚠️ 当前画布上没有节点，无需保存！', 'warning');
    return;
  }
  const modal = document.getElementById('modalCanvasSaveLibrary');
  const titleInput = document.getElementById('inputSaveCanvasTitle');
  const descInput = document.getElementById('inputSaveCanvasDesc');
  
  if (titleInput) titleInput.value = `工作流 · ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
  if (descInput) descInput.value = `包含 ${canvasState.nodes.length} 个节点，保存于 ${new Date().toLocaleDateString('zh-CN')}`;
  
  if (modal) modal.classList.remove('hidden');
  if (titleInput) {
    setTimeout(() => { titleInput.focus(); titleInput.select(); }, 100);
  }
}
window.openSaveCanvasLibraryModal = openSaveCanvasLibraryModal;

function closeSaveCanvasLibraryModal() {
  const modal = document.getElementById('modalCanvasSaveLibrary');
  if (modal) modal.classList.add('hidden');
}
window.closeSaveCanvasLibraryModal = closeSaveCanvasLibraryModal;

function confirmSaveCanvasToLibrary() {
  const titleInput = document.getElementById('inputSaveCanvasTitle');
  const descInput = document.getElementById('inputSaveCanvasDesc');
  const title = titleInput ? titleInput.value.trim() : '';
  const desc = descInput ? descInput.value.trim() : '';

  if (!title) {
    showToast('⚠️ 请填写画布名称！', 'warning');
    return;
  }

  if (!canvasState.savedLibrary) canvasState.savedLibrary = [];

  const savedItem = {
    id: `saved_${Date.now()}`,
    name: title,
    desc: desc || `收录于 ${new Date().toLocaleDateString('zh-CN')}`,
    isUserSaved: true,
    createdAt: Date.now(),
    nodes: JSON.parse(JSON.stringify(canvasState.nodes)),
    connections: JSON.parse(JSON.stringify(canvasState.connections))
  };

  canvasState.savedLibrary.unshift(savedItem);
  localStorage.setItem('vkb_canvas_library', JSON.stringify(canvasState.savedLibrary));

  closeSaveCanvasLibraryModal();
  renderCanvasDrawer();
  updateSidebarBadgeCounts();
  showToast(`🎉 已成功将《${title}》收录至画布库！`, 'success');
}
window.confirmSaveCanvasToLibrary = confirmSaveCanvasToLibrary;

async function deleteSavedCanvasLibraryItem(tplId, e) {
  if (e) e.stopPropagation();
  if (!canvasState.savedLibrary) return;
  const removedItem = canvasState.savedLibrary.find(item => item.id === tplId);
  canvasState.savedLibrary = canvasState.savedLibrary.filter(item => item.id !== tplId);
  localStorage.setItem('vkb_canvas_library', JSON.stringify(canvasState.savedLibrary));
  if (removedItem) await cleanupUnreferencedImageResults([removedItem]);
  renderCanvasDrawer();
  updateSidebarBadgeCounts();
  showToast('🗑️ 已从画布库中移除', 'info');
}
window.deleteSavedCanvasLibraryItem = deleteSavedCanvasLibraryItem;

// ↩️ 撤回 (Cmd+Z / Ctrl+Z) 历史栈管理
let canvasUndoStack = [];
let canvasNodeClipboard = null;
let canvasMousePos = { x: 0, y: 0, clientX: 0, clientY: 0 };
let canvasAtMentionState = {
  activeNodeId: null,
  query: '',
  startIndex: -1,
  selectedIndex: 0
};
const canvasEditorSelectionRanges = new Map();

window.addEventListener('mousemove', (e) => {
  canvasMousePos.clientX = e.clientX;
  canvasMousePos.clientY = e.clientY;
  const workspace = document.getElementById('canvasWorkspace');
  if (workspace) {
    const rect = workspace.getBoundingClientRect();
    const zoom = canvasState.zoom || 1.0;
    canvasMousePos.x = (e.clientX - rect.left - canvasState.panX) / zoom;
    canvasMousePos.y = (e.clientY - rect.top - canvasState.panY) / zoom;
  }
});

function pushCanvasUndoState() {
  if (!canvasState || !canvasState.nodes) return;
  const snapshot = JSON.stringify({
    nodes: canvasState.nodes,
    connections: canvasState.connections
  });
  if (canvasUndoStack.length > 0 && canvasUndoStack[canvasUndoStack.length - 1] === snapshot) return;
  canvasUndoStack.push(snapshot);
  if (canvasUndoStack.length > 50) canvasUndoStack.shift();
}
window.pushCanvasUndoState = pushCanvasUndoState;

function copySelectedCanvasNodes() {
  if (!canvasState.selectedNodeIds || canvasState.selectedNodeIds.length === 0) return;
  const nodesToCopy = canvasState.nodes.filter(n => canvasState.selectedNodeIds.includes(n.id));
  const connectionIds = new Set(nodesToCopy.map(n => n.id));
  const connectionsToCopy = canvasState.connections.filter(c => connectionIds.has(c.fromId) && connectionIds.has(c.toId));
  canvasNodeClipboard = {
    nodes: JSON.parse(JSON.stringify(nodesToCopy)),
    connections: JSON.parse(JSON.stringify(connectionsToCopy))
  };
  showToast(`已复制 ${nodesToCopy.length} 个节点`, 'info');
}
window.copySelectedCanvasNodes = copySelectedCanvasNodes;

function pasteCanvasNodes() {
  if (!canvasNodeClipboard || !canvasNodeClipboard.nodes || canvasNodeClipboard.nodes.length === 0) {
    showToast('剪贴板为空，请先复制节点', 'info');
    return;
  }
  pushCanvasUndoState();
  const idMap = new Map();
  const newNodes = canvasNodeClipboard.nodes.map(node => {
    const newNode = JSON.parse(JSON.stringify(node));
    const newId = `${node.id}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    idMap.set(node.id, newId);
    newNode.id = newId;
    newNode.title = getUniqueCanvasNodeTitle(node.title, { isCopy: true });
    newNode.status = 'idle';
    newNode.errorMsg = '';
    newNode.progress = 0;
    newNode.taskId = null;
    if (newNode.inputSelection) {
      newNode.inputSelection.selectedIds = (newNode.inputSelection.selectedIds || [])
        .filter(id => idMap.has(id) || canvasState.nodes.some(n => n.id === id))
        .map(id => idMap.get(id) || id);
      newNode.inputSelection.knownDirectParentIds = (newNode.inputSelection.knownDirectParentIds || [])
        .filter(id => idMap.has(id) || canvasState.nodes.some(n => n.id === id))
        .map(id => idMap.get(id) || id);
    }
    return newNode;
  });

  let minX = Infinity, minY = Infinity;
  newNodes.forEach(node => {
    if (node.x < minX) minX = node.x;
    if (node.y < minY) minY = node.y;
  });
  const offsetX = canvasMousePos.x - minX;
  const offsetY = canvasMousePos.y - minY;
  newNodes.forEach(node => {
    node.x = Math.round(node.x + offsetX);
    node.y = Math.round(node.y + offsetY);
  });

  canvasState.nodes.push(...newNodes);
  canvasNodeClipboard.connections.forEach(connection => {
    const fromId = idMap.get(connection.fromId);
    const toId = idMap.get(connection.toId);
    if (fromId && toId) {
      canvasState.connections.push({ fromId, toId });
    }
  });

  saveCanvasState();
  renderCanvasNodesAndLines();
  selectCanvasNodes(newNodes.map(n => n.id));
  showToast(`已粘贴 ${newNodes.length} 个节点`, 'success');
}
window.pasteCanvasNodes = pasteCanvasNodes;

function performCanvasUndo() {
  if (canvasUndoStack.length === 0) {
    showToast('已没有更多可撤回的操作', 'info');
    return;
  }
  const lastSnapshot = canvasUndoStack.pop();
  try {
    const data = JSON.parse(lastSnapshot);
    canvasState.nodes = data.nodes || [];
    canvasState.connections = data.connections || [];
    canvasState.selectedNodeIds = [];
    canvasState.selectedConnectionIds = [];
    saveCanvasState();
    renderCanvasNodesAndLines();
    drawCanvasLines();
    showToast('↩️ 已撤回一步操作 (Cmd+Z)', 'info');
  } catch (err) {
    console.error('Undo parse error:', err);
  }
}
window.performCanvasUndo = performCanvasUndo;

// 🎨 左侧菜单栏【画布库】页面动态渲染引擎
function renderCanvasKbGridUI() {
  const container = document.getElementById('canvasGridContainer');
  if (!container) return;

  const userSavedList = canvasState.savedLibrary || [];
  const presetTemplates = CANVAS_PRESET_TEMPLATES || [];
  const allProjects = [...userSavedList, ...presetTemplates];

  if (allProjects.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 60px 20px; color: #94a3b8; font-size: 0.9rem;">暂无画布项目，在画布模式点击【💾 保存画布】收录您的第一个工作流！</div>';
    return;
  }

  container.innerHTML = allProjects.map(proj => {
    const isUserSaved = !!proj.isUserSaved;
    const nodeCount = proj.nodes ? proj.nodes.length : 3;
    const dateStr = proj.createdAt ? new Date(proj.createdAt).toLocaleDateString('zh-CN') : '预设工作流';

    return `
      <div class="canvas-project-card" style="background: #ffffff; border: 1px solid ${isUserSaved ? '#bfdbfe' : '#e2e8f0'}; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); position: relative; transition: all 0.2s ease;">
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 10px; background: ${isUserSaved ? '#eff6ff' : '#f1f5f9'}; color: ${isUserSaved ? '#2563eb' : '#64748b'}; border: 1px solid ${isUserSaved ? '#93c5fd' : '#cbd5e1'};">
              ${isUserSaved ? '📌 我的收录' : '🎨 预设工作流'}
            </span>
            <span style="font-size: 0.75rem; color: #94a3b8;">${dateStr}</span>
          </div>

          <h4 style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0 0 6px 0;">${escapeHTML(proj.name)}</h4>
          <p style="font-size: 0.8rem; color: #64748b; line-height: 1.4; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${escapeHTML(proj.desc)}
          </p>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #f1f5f9; padding-top: 10px; margin-top: 4px;">
          <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">🧩 ${nodeCount} 个节点</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button type="button" class="btn btn-secondary btn-xs" onclick="previewCanvasLibraryItem('${proj.id}', event)" title="预览模板">预览</button>
            <button type="button" class="btn btn-secondary btn-xs" onclick="duplicateCanvasLibraryItem('${proj.id}', event)" title="复制为我的模板">复制</button>
            ${isUserSaved ? `<button type="button" class="btn btn-secondary btn-xs" onclick="renameSavedCanvasLibraryItem('${proj.id}', event)" title="重命名模板">改名</button><button type="button" class="btn btn-secondary btn-xs danger" onclick="deleteSavedCanvasLibraryItem('${proj.id}', event)" title="从画布库删除">✕</button>` : ''}
            <button type="button" class="btn btn-primary btn-sm" onclick="loadCanvasProjectIntoWorkspace('${proj.id}')" style="font-size: 0.775rem; padding: 4px 12px; border-radius: 8px; font-weight: 600;">开启画布</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
window.renderCanvasKbGridUI = renderCanvasKbGridUI;

function findCanvasLibraryItem(projId) {
  return [...(canvasState.savedLibrary || []), ...(CANVAS_PRESET_TEMPLATES || [])].find(item => item.id === projId) || null;
}

function sanitizeCanvasTemplateNodes(nodes) {
  return JSON.parse(JSON.stringify(nodes || [])).map(node => {
    const cleanNode = { ...node };
    delete cleanNode.taskId;
    delete cleanNode.progress;
    delete cleanNode.errorMsg;
    delete cleanNode.videoUrl;
    cleanNode.status = 'idle';
    return cleanNode;
  });
}

function renameSavedCanvasLibraryItem(projId, event) {
  event?.stopPropagation();
  const item = (canvasState.savedLibrary || []).find(project => project.id === projId);
  if (!item) return;
  const name = window.prompt('修改模板名称', item.name || '未命名模板');
  if (name === null || !name.trim()) return;
  item.name = name.trim();
  item.updatedAt = Date.now();
  localStorage.setItem('vkb_canvas_library', JSON.stringify(canvasState.savedLibrary));
  renderCanvasKbGridUI();
  renderCanvasDrawer();
}
window.renameSavedCanvasLibraryItem = renameSavedCanvasLibraryItem;

function duplicateCanvasLibraryItem(projId, event) {
  event?.stopPropagation();
  const source = findCanvasLibraryItem(projId);
  if (!source) return;
  const copy = {
    id: `saved_${Date.now()}`,
    name: `${source.name || '未命名模板'} 副本`,
    desc: source.desc || '',
    isUserSaved: true,
    createdAt: Date.now(),
    nodes: sanitizeCanvasTemplateNodes(source.nodes),
    connections: JSON.parse(JSON.stringify(source.connections || []))
  };
  canvasState.savedLibrary = canvasState.savedLibrary || [];
  canvasState.savedLibrary.unshift(copy);
  localStorage.setItem('vkb_canvas_library', JSON.stringify(canvasState.savedLibrary));
  renderCanvasKbGridUI();
  renderCanvasDrawer();
  updateSidebarBadgeCounts();
  showToast('模板副本已保存到画布库');
}
window.duplicateCanvasLibraryItem = duplicateCanvasLibraryItem;

function previewCanvasLibraryItem(projId, event) {
  event?.stopPropagation();
  const project = findCanvasLibraryItem(projId);
  if (!project) return;
  let modal = document.getElementById('canvasTemplatePreviewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'canvasTemplatePreviewModal';
    modal.className = 'modal-overlay hidden';
    modal.addEventListener('click', clickEvent => {
      if (clickEvent.target === modal || clickEvent.target.closest('[data-close-template-preview]')) modal.classList.add('hidden');
    });
    document.body.appendChild(modal);
  }
  const nodes = project.nodes || [];
  const connections = project.connections || [];
  modal.innerHTML = `<div class="modal-card canvas-template-preview-card">
    <div class="modal-header"><div><h3>${escapeHTML(project.name || '未命名模板')}</h3><p>${escapeHTML(project.desc || '')}</p></div><button type="button" class="btn-close" data-close-template-preview aria-label="关闭预览">×</button></div>
    <div class="canvas-template-preview-summary"><strong>${nodes.length}</strong><span>个节点</span><strong>${connections.length}</strong><span>条连接</span></div>
    <div class="canvas-template-preview-list">${nodes.length ? nodes.map(node => `<div><span>${node.type === 'text' ? '提示词' : node.type === 'asset' ? '参考图' : node.type === 'video' ? '视频生成' : '智能体'}</span><strong>${escapeHTML((node.title || node.assetName || '未命名节点').replace(/^[🤖📝🖼️🎬\s]+/, ''))}</strong></div>`).join('') : '<p>空白模板</p>'}</div>
    <div class="canvas-template-preview-actions"><button type="button" class="btn btn-primary" onclick="document.getElementById('canvasTemplatePreviewModal').classList.add('hidden'); loadCanvasProjectIntoWorkspace('${project.id}')">应用为新画布</button></div>
  </div>`;
  modal.classList.remove('hidden');
}
window.previewCanvasLibraryItem = previewCanvasLibraryItem;

async function loadCanvasProjectIntoWorkspace(projId) {
  const userSavedList = canvasState.savedLibrary || [];
  const presetTemplates = CANVAS_PRESET_TEMPLATES || [];
  const allProjects = [...userSavedList, ...presetTemplates];
  const proj = allProjects.find(p => p.id === projId);
  if (!proj) return;

  const nodes = sanitizeCanvasTemplateNodes(proj.nodes);
  const connections = JSON.parse(JSON.stringify(proj.connections || []));
  await SessionSystem.createNew('canvas', {
    force: true,
    data: { nodes, connections, zoom: 1, panX: 0, panY: 0, tasks: [] }
  });
  showToast(`已从工作流《${proj.name}》新建未命名画布`, 'success');
}
window.loadCanvasProjectIntoWorkspace = loadCanvasProjectIntoWorkspace;

// 🔗 连线点击选中 (变紫光流动虚线)
function selectCanvasConnection(fromId, toId, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const connId = `${fromId}__${toId}`;
  if (!canvasState.selectedConnectionIds) canvasState.selectedConnectionIds = [];

  if (e && e.shiftKey) {
    if (!canvasState.selectedConnectionIds.includes(connId)) {
      canvasState.selectedConnectionIds.push(connId);
    } else {
      canvasState.selectedConnectionIds = canvasState.selectedConnectionIds.filter(id => id !== connId);
    }
  } else {
    canvasState.selectedNodeIds = [];
    canvasState.selectedConnectionIds = [connId];
  }
  renderCanvasNodesAndLines();
  showToast('🔗 已选中连线 (按 Delete 键可删除此连线)', 'info');
}
window.selectCanvasConnection = selectCanvasConnection;

// 🔢 左侧侧边栏 Badge 数量实时更新
function updateSidebarBadgeCounts() {
  const canvasCountEl = document.getElementById('canvasKbCount');
  if (canvasCountEl) {
    const savedLibrary = JSON.parse(localStorage.getItem('vkb_canvas_library') || '[]');
    const presetTemplates = (typeof CANVAS_PRESET_TEMPLATES !== 'undefined') ? CANVAS_PRESET_TEMPLATES : [];
    const totalCount = savedLibrary.length + presetTemplates.length;
    canvasCountEl.textContent = totalCount;
  }

  const lensCountEl = document.getElementById('sidebarCount');
  if (lensCountEl) {
    lensCountEl.textContent = (state && state.tableData) ? state.tableData.length : 0;
  }

  const promptCountEl = document.getElementById('promptKbCount');
  if (promptCountEl) {
    promptCountEl.textContent = (state && state.promptTemplates) ? state.promptTemplates.length : 0;
  }
  const assetCountEl = document.getElementById('assetKbCount');
  if (assetCountEl) assetCountEl.textContent = (state && state.assets) ? state.assets.length : 0;
}
window.updateSidebarBadgeCounts = updateSidebarBadgeCounts;


// 页面加载完成立即读取数据并更新侧边栏真实数字
updateSidebarBadgeCounts();


// 🤖 智能体节点操作函数
function addCanvasAgentNode(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const center = getCanvasViewportCenterPos();
  addCanvasNode({
    id: 'node_agent_' + Date.now(),
    type: 'agent',
    x: center.x,
    y: center.y,
    width: 320,
    height: 380,
    title: '🤖 AI 智能体节点',
    systemPrompt: '',
    outputContent: '',
    status: 'idle',
    model: 'gpt-5.6'
  });
  showToast('已在视角中心添加 AI 智能体节点', 'success');
}
window.addCanvasAgentNode = addCanvasAgentNode;

function onAgentNodePromptInput(nodeId, val) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (node) {
    node.systemPrompt = val;
    saveCanvasState();
  }
}
window.onAgentNodePromptInput = onAgentNodePromptInput;

// ⚡ 运行智能体 LLM 逻辑 (自动读取接入上游节点的数据，结合提示词生成输出)
async function runCanvasAgentNode(nodeId) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const selectedInputNodes = getSelectedCanvasInputNodes(nodeId);
  let combinedInputTexts = [];

  selectedInputNodes.forEach((srcNode, idx) => {
    if (srcNode.type === 'text') {
      const val = resolveCanvasAtMentionText(srcNode.content || '', srcNode.id);
      if (val.trim()) combinedInputTexts.push(`【接入输入 ${idx + 1} (${srcNode.title || '文本节点'})】：\n${val.trim()}`);
    } else if (srcNode.type === 'agent') {
      const val = srcNode.outputContent || '';
      if (val.trim()) combinedInputTexts.push(`【接入输入 ${idx + 1} (${srcNode.title || '上游智能体输出'})】：\n${val.trim()}`);
    } else if (srcNode.type === 'asset') {
      const val = srcNode.assetName || srcNode.title || '';
      if (val.trim()) combinedInputTexts.push(`【接入输入 ${idx + 1} (${srcNode.title || '参考图/资产节点'})】：\n${val.trim()}`);
    } else if (srcNode.type === 'video' && srcNode.videoUrl) {
      combinedInputTexts.push(`【接入输入 ${idx + 1} (${srcNode.title || '视频节点'})】：\n${srcNode.videoUrl}`);
    }
  });

  const agentPrompt = (node.systemPrompt || '').trim();
  const inputContextStr = combinedInputTexts.length > 0 ? combinedInputTexts.join('\n\n') : '（暂无左侧接入节点）';

  if (!agentPrompt) {
    showToast('⚠️ 请输入智能体提示词/任务指令', 'warning');
    return;
  }
  if (combinedInputTexts.length === 0) {
    showToast('请在“输入”中至少选择一个有有效输出的上游节点', 'warning');
    return;
  }

  node.status = 'generating';
  node.outputContent = '';
  saveCanvasState();
  renderCanvasNodesAndLines();

  showToast(`🤖 智能体正在分析处理并生成输出...`, 'info');

  try {
    const outputResult = await executeAgentLLMTask(agentPrompt, inputContextStr);
    node.outputContent = outputResult;
    node.status = 'success';
    saveCanvasState();
    renderCanvasNodesAndLines();
    showToast(`✨ 智能体【${node.title}】处理完成！`, 'success');
  } catch (err) {
    console.error('Agent node execution failed:', err);
    node.status = 'failed';
    node.errorMsg = err.message || '智能体运行异常';
    saveCanvasState();
    renderCanvasNodesAndLines();
    showToast(`❌ 智能体处理异常: ${err.message}`, 'error');
  }
}
window.runCanvasAgentNode = runCanvasAgentNode;

async function executeAgentLLMTask(agentPrompt, inputContextStr) {
  try {
    const model = getPreferredServerModel('canvas', 'llm', state.apiConfig.llmModelName);
    if (!model) throw new Error('暂无可用画布智能体模型，请联系管理员启用模型');
    return await backendGenerateText({
      mode: 'canvas',
      model,
      prompt: agentPrompt,
      messages: [
        { role: 'system', content: '你是一个 AI 智能体执行单元。严格根据任务指令加工输入文本，直接输出处理结果。' },
        { role: 'user', content: `【任务指令】：${agentPrompt}\n\n【左侧接入输入内容】：\n${inputContextStr}` }
      ]
    });
  } catch (error) {
    console.warn('服务端智能体执行失败:', error.message);
    throw error;
  }
}
window.executeAgentLLMTask = executeAgentLLMTask;

function copyAgentOutput(nodeId) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (node && node.outputContent) {
    navigator.clipboard.writeText(node.outputContent).then(() => {
      showToast('📋 已复制智能体输出结果', 'success');
    }).catch(() => {
      showToast('📋 请手动选中复制文本', 'info');
    });
  }
}
window.copyAgentOutput = copyAgentOutput;


// 🤖 智能体快捷模式一键填入 (Dramatron 剧情大纲 & MoneyPrinter 画面分镜分解)
function setAgentPresetPrompt(nodeId, mode) {
  const node = canvasState.nodes.find(n => n.id === nodeId);
  if (!node) return;

  if (mode === 'outline') {
    node.systemPrompt = '请基于左侧接入的内容，生成一份剧情故事大纲（包含：故事梗概Logline、核心人物与冲突、三幕式剧情走向、情绪高潮点）';
    showToast('已填入【📖 剧情故事大纲】提示词模板', 'info');
  } else if (mode === 'storyboard') {
    node.systemPrompt = '请基于左侧接入的内容，拆解为 4 个标准的短视频/电影镜头分镜（包含：镜头编号、景别[特写/中景/全景]、运镜手法[推/拉/摇/移]、画面构图、核心AI提示词描述）';
    showToast('已填入【🎬 画面分镜分解】提示词模板', 'info');
  }
  saveCanvasState();
  renderCanvasNodesAndLines();
}
window.setAgentPresetPrompt = setAgentPresetPrompt;


// ✨ 提示词节点 AI 扩写任务引擎
async function runAIExpandTask(rawContent, preferredModel = '') {
  const text = (rawContent || '').trim();
  if (!text) {
    throw new Error('请先在节点中输入提示词内容');
  }

  try {
    return await backendGenerateText({
      mode: 'canvas',
      model: getPreferredServerModel('canvas', 'llm', preferredModel || state.apiConfig.llmModelName),
      prompt: text,
      messages: [
        { role: 'system', content: '你是一位 AI 视频提示词专家。将简短提示词扩展为富有画面、光影细节与镜头语言的详细 Prompt。' },
        { role: 'user', content: `请扩写以下 AI 视频 Prompt：\n${text}` }
      ]
    });
  } catch (error) {
    console.warn('服务端提示词扩写失败:', error.message);
    throw error;
  }
}
window.runAIExpandTask = runAIExpandTask;


// ==============================================================================
// 📜 长剧本创作中心 (分屏 AI 对话 + 剧本实时改写引擎)
// ==============================================================================

function quickFillLongScriptPrompt(text) {
  const input = document.getElementById('longScriptChatInput');
  if (input) {
    input.value = text;
    input.focus();
  }
}
window.quickFillLongScriptPrompt = quickFillLongScriptPrompt;

// ==============================================================================
// 🎬 资深 AI 导演分镜推演与精准修订引擎 (对标 7 列标杆分镜表头)
// ==============================================================================

window.currentCanvasHtmlCode = "";
window.longScriptChatHistory = [];
window.longScriptPendingImages = [];

const LONG_SCRIPT_MAX_IMAGES = 9;
const LONG_SCRIPT_MAX_IMAGE_BYTES = 50 * 1024 * 1024;

// 长剧本状态持久化
const LS_LONG_SCRIPT_KEY = 'video_prompt_kb_long_script_state';
function saveLongScriptState() {
  try {
    const state = {
      htmlCode: window.currentCanvasHtmlCode,
      shots: window.currentStoryboardShots,
      history: window.longScriptChatHistory
    };
    localStorage.setItem(LS_LONG_SCRIPT_KEY, JSON.stringify(state));
    if (SessionSystem.isInitialized() && !SessionSystem.isApplying()) SessionSystem.scheduleSave();
  } catch (e) {
    console.warn('保存长剧本状态失败:', e);
    if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
      showToast('图片较多，浏览器存储空间不足；本次对话仍可继续，但刷新后可能无法恢复最新消息。', 'warning');
    }
  }
}
function loadLongScriptState() {
  try {
    const raw = localStorage.getItem(LS_LONG_SCRIPT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('读取长剧本状态失败:', e);
    return null;
  }
}
function clearLongScriptState() {
  try {
    localStorage.removeItem(LS_LONG_SCRIPT_KEY);
  } catch (e) {
    console.warn('清除长剧本状态失败:', e);
  }
}

// 初始分镜数组
function getInitialStoryboardShots() {
  return [
    {
      no: "镜 1 (0-6s)",
      camType: "大远景 (EWS)",
      camMove: "云端俯冲向下推近 ➔ 地图快切",
      desc: "夜幕下的都市鸟瞰，高楼大厦灯火辉煌。镜头快速向下冲刺，穿插全国多座城市地图点阵光效连通交织，汇聚成“壹准验机”分布式网络特效。",
      voice: "【BGM】科技 Sub-bass 警示重低音起。\\n【旁白】：“在二手交易中，验机是建立信任最重要的一环！壹准验机采用城市分布式布局，每一个城市建立标准化验机中心...”",
      refImg: "",
      sellingPoint: ["城市分布式布局", "全国统一标准"],
      aiPrompt: "Aerial view of night city, glowing cyan map lines --ar 16:9"
    },
    {
      no: "镜 2 (6-10s)",
      camType: "中景 (MS)",
      camMove: "由左向右平滑横移 (Pan Right)",
      desc: "镜头扫过某城市“壹准验机中心”门头并穿透玻璃门。室内整洁。老板走出来整理衣服向质检区大声呼喊。",
      voice: "【环境音】店内风扇底噪。\\n【台词 (老板高喊)】：“小吴啊！快下班了！剩下的那一箱手机质检完了没有？”",
      refImg: "",
      sellingPoint: ["标准化门店引入"],
      aiPrompt: "Pan right medium shot, modern phone store --ar 16:9"
    },
    {
      no: "镜 3 (10-15s)",
      camType: "仰拍 ➔ 特写",
      camMove: "跟拍 ➔ 📸 画面定格",
      desc: "电梯视角仰拍。电梯门开，老板推着精巧科技感“壹准验机机器人”迈入狭小民用电梯。\\n📸 定格特效：画面定格，机器人亮蓝光轮廓，弹出 UI：“超紧凑设计，无缝适配民用小电梯！”",
      voice: "【音效】电梯叮声，定格“嘎”键定音。\\n【旁白】：“壹准验机机器人，小巧灵活！轻松进出民用最小尺寸电梯，随时随地部署！”",
      refImg: "",
      sellingPoint: ["📸 画面定格", "可进民用小电梯"],
      aiPrompt: "Low angle elevator shot, pushing white robot --ar 16:9"
    },
    {
      no: "镜 4 (15-19s)",
      camType: "中景 ➔ 特写",
      camMove: "固定镜头向脸部微推",
      desc: "老板推机器人到质检区。小吴抱着一大箱手机“砰”地砸在桌上，看表皱眉，满脸急着下班的不耐烦表情。",
      voice: "【音效】重物金属碰撞“砰”声。\\n【台词 (小吴着急)】：“知道了知道了！现在马上弄！”",
      refImg: "",
      sellingPoint: ["人物情绪反差"],
      aiPrompt: "Technician carrying heavy box of phones, slamming --ar 16:9"
    }
  ];
}

// 将分镜数据编译为符合固定 7 列表头格式的 HTML
function compileShotsTo7ColumnHtml(shots) {
  const list = (shots && shots.length > 0) ? shots : getInitialStoryboardShots();

  const imageUploadScript = `
<script>
(function() {
  function handleFile(file, cell) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      cell.innerHTML = '<img src="' + e.target.result + '" style="width:100%; height:100%; object-fit:cover;" />';
      cell.classList.remove('empty');
      cell.classList.add('filled');
    };
    reader.readAsDataURL(file);
  }
  document.querySelectorAll('.shot-image-cell').forEach(function(cell) {
    cell.addEventListener('click', function() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = function(e) {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0], cell);
      };
      input.click();
    });
    cell.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); cell.style.borderColor = '#2563eb'; cell.style.background = '#eff6ff'; });
    cell.addEventListener('dragleave', function(e) { e.preventDefault(); e.stopPropagation(); cell.style.borderColor = ''; cell.style.background = ''; });
    cell.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      cell.style.borderColor = ''; cell.style.background = '';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], cell);
    });
  });
})();
<\/script>`;

  const rowHeightScript = `
<script>
(function() {
  function syncRowHeights() {
    document.querySelectorAll('tbody tr').forEach(function(row) {
      var descTextarea = row.querySelector('td:nth-child(3) textarea');
      if (!descTextarea) return;
      var clone = descTextarea.cloneNode(true);
      clone.style.height = 'auto';
      clone.style.position = 'absolute';
      clone.style.visibility = 'hidden';
      clone.style.width = descTextarea.offsetWidth + 'px';
      document.body.appendChild(clone);
      var naturalHeight = clone.scrollHeight;
      document.body.removeChild(clone);
      row.style.height = naturalHeight + 'px';
    });
  }
  syncRowHeights();
  window.addEventListener('resize', function() {
    clearTimeout(window._rowHeightTimer);
    window._rowHeightTimer = setTimeout(syncRowHeights, 100);
  });
})();
<\/script>`;

  const rowsHtml = list.map((s, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 0; background: #ffffff; border-right: 1px solid #e2e8f0; height: 100%;">
        <div style="height: 100%; display: flex; align-items: center; padding: 12px; overflow: hidden;">
          <div style="font-weight: 700; color: #2563eb; font-size: 12px;">${escapeHTML(s.no)}</div>
        </div>
      </td>
      <td style="padding: 0; background: #ffffff; border-right: 1px solid #e2e8f0; height: 100%;">
        <div style="height: 100%; display: flex; flex-direction: column; padding: 12px; gap: 4px; overflow: hidden;">
          <div style="color: #2563eb; font-weight: 700; font-size: 12px;">${escapeHTML(s.camType || '中景 (MS)')}</div>
          <div style="flex: 1; min-height: 0; color: #64748b; font-size: 11px; line-height: 1.4; overflow-y: auto;">${escapeHTML(s.camMove || '固定镜头微推')}</div>
        </div>
      </td>
      <td style="padding: 0; background: #ffffff; border-right: 1px solid #e2e8f0; height: 100%;">
        <textarea class="shot-desc-textarea" style="width: 100%; height: auto; min-height: 70px; background: #f8fafc; color: #0f172a; border: none; padding: 10px; font-size: 12px; line-height: 1.5; font-family: inherit; resize: vertical; outline: none;" readonly>${escapeHTML(s.desc)}</textarea>
      </td>
      <td style="padding: 0; background: #ffffff; border-right: 1px solid #e2e8f0; height: 100%;">
        <textarea style="width: 100%; height: 100%; min-height: 70px; background: #eff6ff; color: #1e40af; border: none; padding: 10px; font-size: 12px; line-height: 1.5; font-family: inherit; resize: vertical; outline: none; overflow-y: auto;" readonly>${escapeHTML(s.voice)}</textarea>
      </td>
      <td style="padding: 0; background: #ffffff; border-right: 1px solid #e2e8f0; text-align: center; height: 100%;">
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; padding: 10px;">
          <div class="shot-image-cell ${s.refImg ? 'filled' : 'empty'}" style="width: 75px; height: 100%; min-height: 50px; border: 1px dashed #cbd5e1; border-radius: 6px; background: #f8fafc; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 18px; overflow: hidden; cursor: pointer; transition: all 0.2s ease;">
            ${s.refImg ? `<img src="${s.refImg}" style="width:100%; height:100%; object-fit:cover;" />` : `<span>+</span>`}
          </div>
        </div>
      </td>
      <td style="padding: 0; background: #ffffff; border-right: 1px solid #e2e8f0; height: 100%;">
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; padding: 10px; gap: 4px; overflow-y: auto;">
          ${(Array.isArray(s.sellingPoint) ? s.sellingPoint : [s.sellingPoint]).map(pt => pt ? `<span style="flex-shrink: 0; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 3px 6px; border-radius: 6px; font-size: 10px; font-weight: 600; display: inline-block;">${escapeHTML(pt)}</span>` : '').join('')}
        </div>
      </td>
      <td style="padding: 0; background: #ffffff; height: 100%;">
        <div style="height: 100%; display: flex; flex-direction: column; padding: 10px; gap: 6px; overflow: hidden;">
          <div style="flex: 1; min-height: 0; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; font-family: monospace; font-size: 11px; color: #334155; word-break: break-word; overflow-y: auto;">
            ${escapeHTML(s.aiPrompt || 'Cinematic video shot --ar 16:9')}
          </div>
          <button style="flex-shrink: 0; width: 100%; background: #e2e8f0; color: #334155; border: none; padding: 4px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer;" onclick="navigator.clipboard.writeText('${escapeHTML(s.aiPrompt || '')}')">📋 复制</button>
        </div>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>右侧分镜表格预览</title>
  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 0; }
    .ls-preview-wrap { padding: 16px; }
    .header-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; background: #ffffff; padding: 12px 16px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    h2 { margin: 0; font-size: 0.95rem; color: #0f172a; display: flex; align-items: center; gap: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    thead { position: sticky; top: 0; z-index: 100; }
    th { padding: 10px; background: #f1f5f9; color: #475569; text-align: left; font-weight: 700; border-bottom: 2px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
    td { vertical-align: top; height: 100%; }
    td textarea { display: block; }
    .shot-image-cell.empty:hover { border-color: #2563eb; background: #eff6ff; color: #2563eb; }
    .shot-image-cell.filled { border-style: solid; border-color: #e2e8f0; cursor: default; }
  </style>
</head>
<body>
  <div class="ls-preview-wrap">
    <div class="header-bar">
      <h2>📊 右侧分镜表格预览 (固定 7 列标杆模版)</h2>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 80px;">镜号</th>
          <th style="width: 140px;">景别与运镜</th>
          <th>画面详细描述 (细节/动作/定格)</th>
          <th style="width: 230px;">旁白 / 台词 / Foley音效</th>
          <th style="width: 95px; text-align: center;">🖼️ 景别参考图</th>
          <th style="width: 110px;">核心卖点</th>
          <th style="width: 150px;">AI Prompt</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>
  ${imageUploadScript}
  ${rowHeightScript}
</body>
</html>`;
}

function getInitialCanvasHtmlDoc() {
  window.currentStoryboardShots = getInitialStoryboardShots();
  return compileShotsTo7ColumnHtml(window.currentStoryboardShots);
}

// 提取 AI 回复中的 HTML
function extractHtmlFromLLMText(text) {
  if (!text) return null;
  const codeBlockMatch = text.match(/```html\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1].trim().length > 15) {
    return codeBlockMatch[1].trim();
  }
  const doctypeMatch = text.match(/(<!DOCTYPE html[\s\S]*<\/html>|<html[\s\S]*<\/html>)/i);
  if (doctypeMatch && doctypeMatch[1].trim().length > 15) {
    return doctypeMatch[1].trim();
  }
  return null;
}
window.extractHtmlFromLLMText = extractHtmlFromLLMText;

// 强力全量渲染到右侧内置浏览器视口
function sanitizeLongScriptPreviewHtml(htmlCode) {
  const source = String(htmlCode || '').replace(/<span\b[^>]*>\s*(?:✨\s*)?实时对话修改预览就绪\s*<\/span>/gi, '');
  if (!source || typeof DOMParser !== 'function') return source;
  const doc = new DOMParser().parseFromString(source, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, link[rel="import"], meta[http-equiv="refresh"], base, form').forEach(node => node.remove());
  doc.querySelectorAll('*').forEach(node => {
    [...node.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || name === 'srcdoc') node.removeAttribute(attribute.name);
      if (['href', 'src', 'action', 'formaction', 'poster'].includes(name) && /^(?:javascript:|data:text\/html)/i.test(value)) node.removeAttribute(attribute.name);
    });
  });
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

function getEmptyLongScriptPreviewHtml() {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{height:100%;margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{display:grid;place-items:center;color:#94a3b8}.empty{font-size:14px}</style></head><body><div class="empty">输入剧本内容后，AI 生成结果将在这里显示</div></body></html>';
}

function renderCanvasBrowserHtml(htmlCode, options = {}) {
  const allowEmpty = options.allowEmpty === true;
  const content = htmlCode || (allowEmpty ? '' : getInitialCanvasHtmlDoc());
  const sanitized = sanitizeLongScriptPreviewHtml(content);
  window.currentCanvasHtmlCode = sanitized;
  if (options.persist !== false) saveLongScriptState();

  const iframe = document.getElementById('geminiCanvasBrowserIframe');
  if (iframe) {
    const displayHtml = sanitized || getEmptyLongScriptPreviewHtml();
    iframe.srcdoc = displayHtml;
  }
}
window.renderCanvasBrowserHtml = renderCanvasBrowserHtml;

function getLongScriptPreviewImageFromCell(cell) {
  const image = cell?.querySelector('img');
  return image?.src || '';
}

function normalizeLongScriptShotNo(no, fallbackIndex) {
  return String(no || `镜头 ${fallbackIndex + 1}`).replace(/\s+/g, ' ').trim();
}

function extractLongScriptShotsFromPreview() {
  const iframe = document.getElementById('geminiCanvasBrowserIframe');
  const doc = iframe && iframe.contentDocument;
  const rows = doc ? Array.from(doc.querySelectorAll('table tbody tr')) : [];

  if (rows.length > 0) {
    return rows.map((row, index) => {
      const cells = row.querySelectorAll(':scope > td');
      const cameraParts = cells[1]
        ? Array.from(cells[1].querySelectorAll('div'))
          .filter(el => !el.querySelector('div'))
          .map(el => (el.innerText || '').trim())
          .filter(Boolean)
        : [];
      const camera = cameraParts.length > 0 ? cameraParts.join('，') : (cells[1]?.innerText || '').trim();
      const description = (cells[2]?.querySelector('textarea')?.value || cells[2]?.innerText || '').trim();
      const dialogue = (cells[3]?.querySelector('textarea')?.value || cells[3]?.innerText || '').trim();
      const sellingPoints = cells[5]
        ? Array.from(cells[5].querySelectorAll('span')).map(item => (item.innerText || '').trim()).filter(Boolean)
        : [];
      const promptLeaf = cells[6]
        ? Array.from(cells[6].querySelectorAll('div')).find(item => !item.querySelector('div'))
        : null;
      const aiPrompt = (promptLeaf?.innerText || cells[6]?.innerText || '').replace(/📋\s*复制\s*$/u, '').trim();
      return {
        no: normalizeLongScriptShotNo(cells[0]?.innerText, index),
        camera: camera || '未填写',
        description: description || '未填写',
        dialogue: dialogue || '未填写',
        refImg: getLongScriptPreviewImageFromCell(cells[4]),
        sellingPoints,
        aiPrompt: aiPrompt || '未填写'
      };
    }).filter(shot => shot.camera !== '未填写' || shot.description !== '未填写' || shot.dialogue !== '未填写' || shot.refImg);
  }

  const fallbackShots = Array.isArray(window.currentStoryboardShots) ? window.currentStoryboardShots : [];
  return fallbackShots.map((shot, index) => ({
    no: normalizeLongScriptShotNo(shot.no, index),
    camera: [shot.camType, shot.camMove].filter(Boolean).join('，') || '未填写',
    description: String(shot.desc || '').trim() || '未填写',
    dialogue: String(shot.voice || '').trim() || '未填写',
    refImg: String(shot.refImg || '').trim(),
    sellingPoints: (Array.isArray(shot.sellingPoint) ? shot.sellingPoint : [shot.sellingPoint]).map(item => String(item || '').trim()).filter(Boolean),
    aiPrompt: String(shot.aiPrompt || '').trim() || '未填写'
  }));
}
window.extractLongScriptShotsFromPreview = extractLongScriptShotsFromPreview;

function normalizeLongScriptMarkdownBlock(value, fallback = '未填写') {
  const text = String(value || '').replace(/\r\n?/g, '\n').trim();
  return text || fallback;
}

function escapeLongScriptMarkdownInline(value) {
  return normalizeLongScriptMarkdownBlock(value).replace(/\\/g, '\\\\').replace(/([`*_{}\[\]()<>#+.!|\-])/g, '\\$1').replace(/\n+/g, ' ');
}

function buildLongScriptMarkdown(shots = extractLongScriptShotsFromPreview(), options = {}) {
  const activeSession = SessionSystem.getActive();
  const sessionTitle = String(options.title || (activeSession?.type === 'long-script' ? activeSession.title : '') || '').trim();
  const title = sessionTitle && sessionTitle !== '未命名' ? sessionTitle : '长剧本分镜';
  const exportedAt = options.exportedAt || new Date().toLocaleString('zh-CN', { hour12: false });
  const list = Array.isArray(shots) ? shots : [];
  const lines = [
    `# ${escapeLongScriptMarkdownInline(title)}`,
    '',
    `> 导出时间：${escapeLongScriptMarkdownInline(exportedAt)}`,
    `> 镜头数量：${list.length}`,
    ''
  ];

  list.forEach((shot, index) => {
    const shotNo = normalizeLongScriptMarkdownBlock(shot.no, `镜头 ${index + 1}`);
    const sellingPoints = (Array.isArray(shot.sellingPoints) ? shot.sellingPoints : [shot.sellingPoints])
      .map(item => String(item || '').trim()).filter(Boolean);
    lines.push(`## ${escapeLongScriptMarkdownInline(shotNo)}`, '');
    lines.push(`- **景别与运镜：** ${escapeLongScriptMarkdownInline(shot.camera || '未填写')}`);
    lines.push(`- **核心卖点：** ${sellingPoints.length ? sellingPoints.map(escapeLongScriptMarkdownInline).join('、') : '未填写'}`);
    if (/^https?:\/\//i.test(String(shot.refImg || ''))) {
      lines.push(`- **参考图：** [查看图片](${String(shot.refImg).replace(/\s/g, '%20')})`);
    } else if (shot.refImg) {
      lines.push('- **参考图：** 已保存在当前项目中（未内嵌到 Markdown 文件）');
    }
    lines.push('', '### 画面详细描述', '', normalizeLongScriptMarkdownBlock(shot.description), '');
    lines.push('### 旁白 / 台词 / Foley 音效', '', normalizeLongScriptMarkdownBlock(shot.dialogue), '');
    lines.push('### AI Prompt', '', '```text', normalizeLongScriptMarkdownBlock(shot.aiPrompt), '```', '', '---', '');
  });

  return `${lines.join('\n').trim()}\n`;
}
window.buildLongScriptMarkdown = buildLongScriptMarkdown;

function exportLongScriptMarkdown() {
  const shots = extractLongScriptShotsFromPreview();
  if (!shots.length) {
    showToast('当前没有可导出的长剧本内容', 'warning');
    return;
  }
  const activeSession = SessionSystem.getActive();
  const rawTitle = activeSession?.type === 'long-script' && activeSession.title !== '未命名' ? activeSession.title : '长剧本分镜';
  const safeTitle = String(rawTitle || '长剧本分镜').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || '长剧本分镜';
  const markdown = buildLongScriptMarkdown(shots, { title: rawTitle });
  const blob = new Blob([`\uFEFF${markdown}`], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeTitle}_${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`已导出 ${shots.length} 个镜头的 Markdown 文件`, 'success');
}
window.exportLongScriptMarkdown = exportLongScriptMarkdown;

function getLongScriptShotCopy(shot) {
  return [
    `镜号：${shot.no}`,
    `景别与运镜：${shot.camera}`,
    `画面详细描述（细节/动作/定格）：${shot.description}`,
    `旁白 / 台词 / Foley音效：${shot.dialogue}`
  ].join('\n');
}

function closeLongScriptApplyMenu() {
  document.querySelector('.ls-apply-menu')?.classList.remove('is-open');
}
function openLongScriptApplyMenu() {
  document.querySelector('.ls-apply-menu')?.classList.add('is-open');
}
function scheduleCloseLongScriptApplyMenu() {
  window.clearTimeout(window.longScriptApplyMenuTimer);
  window.longScriptApplyMenuTimer = window.setTimeout(closeLongScriptApplyMenu, 120);
}
function toggleLongScriptApplyMenu(event) {
  event?.stopPropagation();
  const menu = document.querySelector('.ls-apply-menu');
  menu?.classList.toggle('is-open');
}
window.openLongScriptApplyMenu = openLongScriptApplyMenu;
window.scheduleCloseLongScriptApplyMenu = scheduleCloseLongScriptApplyMenu;
window.toggleLongScriptApplyMenu = toggleLongScriptApplyMenu;

document.addEventListener('click', (event) => {
  if (!event.target.closest('.ls-apply-menu')) closeLongScriptApplyMenu();
});

let longScriptApplyShots = [];
let longScriptCanvasItems = [];

function createLongScriptCanvasItems() {
  return longScriptApplyShots.map((shot, index) => ({
    id: `canvas_shot_item_${index}`,
    shotIndexes: [index],
    checked: false
  }));
}

function getLongScriptCanvasItemShots(item) {
  return (item?.shotIndexes || []).map(index => longScriptApplyShots[index]).filter(Boolean);
}

function renderLongScriptApplyShotList(type) {
  const list = document.getElementById(type === 'conversation' ? 'longScriptConversationShotList' : 'longScriptCanvasShotList');
  if (!list) return;
  if (type === 'canvas') {
    list.innerHTML = longScriptCanvasItems.map((item, itemIndex) => {
      const itemShots = getLongScriptCanvasItemShots(item);
      const label = itemShots.length > 1
        ? `镜头${itemShots.map(shot => shot.no.replace(/^镜(?:头)?\s*/, '').replace(/\s*\([^)]*\)\s*$/, '')).join('、')}`
        : itemShots[0]?.no || `镜头 ${itemIndex + 1}`;
      const summary = itemShots.map(shot => `${shot.camera}；${shot.description}`).join(' / ');
      const image = itemShots.find(shot => shot.refImg)?.refImg;
      return `
        <label class="ls-apply-shot-item ${itemShots.length > 1 ? 'is-merged' : ''}">
          <input class="ls-apply-shot-check" type="checkbox" data-item-index="${itemIndex}" ${item.checked ? 'checked' : ''} onchange="updateLongScriptApplySelection('canvas')">
          <span class="ls-apply-shot-no">${escapeHTML(label)}</span>
          <span class="ls-apply-shot-summary"><strong>${escapeHTML(itemShots.map(shot => shot.camera).join('，'))}</strong><span>${escapeHTML(summary)}</span></span>
          ${image ? `<span class="ls-apply-shot-image"><img src="${escapeHTML(image)}" alt="参考图"></span>` : '<span class="ls-apply-shot-image empty">无参考图</span>'}
        </label>`;
    }).join('');
  } else {
    list.innerHTML = longScriptApplyShots.map((shot, index) => `
      <label class="ls-apply-shot-item">
        <input class="ls-apply-shot-check" type="checkbox" data-shot-index="${index}" checked onchange="updateLongScriptApplySelection('conversation')">
        <span class="ls-apply-shot-no">${escapeHTML(shot.no)}</span>
        <span class="ls-apply-shot-summary"><strong>${escapeHTML(shot.camera)}</strong><span>${escapeHTML(shot.description)}</span></span>
        ${shot.refImg ? `<span class="ls-apply-shot-image"><img src="${escapeHTML(shot.refImg)}" alt="参考图"></span>` : '<span class="ls-apply-shot-image empty">无参考图</span>'}
      </label>`).join('');
  }
  if (type === 'canvas') {
    const count = document.getElementById('longScriptCanvasSelectedCount');
    if (count) count.textContent = `已选 ${longScriptCanvasItems.filter(item => item.checked).length} 个条目`;
  } else {
    updateLongScriptApplySelection(type);
  }
}

function getLongScriptApplySelectedIndexes(type) {
  const listId = type === 'conversation' ? 'longScriptConversationShotList' : 'longScriptCanvasShotList';
  const attribute = type === 'conversation' ? 'shotIndex' : 'itemIndex';
  return Array.from(document.querySelectorAll(`#${listId} .ls-apply-shot-check:checked`))
    .map(input => Number(input.dataset[attribute]))
    .filter(Number.isInteger);
}

function updateLongScriptApplySelection(type) {
  const selected = getLongScriptApplySelectedIndexes(type);
  if (type === 'canvas') {
    longScriptCanvasItems.forEach((item, index) => { item.checked = selected.includes(index); });
  }
  const count = document.getElementById(type === 'conversation' ? 'longScriptConversationSelectedCount' : 'longScriptCanvasSelectedCount');
  if (count) count.textContent = `已选 ${selected.length} 个${type === 'canvas' ? '条目' : '镜头'}`;
  if (type === 'canvas') {
    const selectAllButton = document.getElementById('btnLongScriptCanvasSelectAll');
    if (selectAllButton) {
      const allSelected = longScriptCanvasItems.length > 0 && selected.length === longScriptCanvasItems.length;
      selectAllButton.textContent = allSelected ? '取消全选' : '全选';
    }
  }
  if (type === 'conversation') {
    const selectAll = document.getElementById('longScriptConversationSelectAll');
    if (selectAll) {
      selectAll.checked = selected.length === longScriptApplyShots.length && longScriptApplyShots.length > 0;
      selectAll.indeterminate = selected.length > 0 && selected.length < longScriptApplyShots.length;
    }
  }
}
window.updateLongScriptApplySelection = updateLongScriptApplySelection;

function toggleLongScriptApplySelectAll(type, checked) {
  const listId = type === 'conversation' ? 'longScriptConversationShotList' : 'longScriptCanvasShotList';
  document.querySelectorAll(`#${listId} .ls-apply-shot-check`).forEach(input => { input.checked = checked; });
  updateLongScriptApplySelection(type);
}
window.toggleLongScriptApplySelectAll = toggleLongScriptApplySelectAll;

function openLongScriptConversationApplyModal() {
  closeLongScriptApplyMenu();
  longScriptApplyShots = extractLongScriptShotsFromPreview();
  if (!longScriptApplyShots.length) return showToast('当前预览中没有可应用的镜头', 'warning');
  const modal = document.getElementById('modalLongScriptConversationApply');
  if (!modal) return;
  renderLongScriptApplyShotList('conversation');
  modal.classList.remove('hidden');
}
window.openLongScriptConversationApplyModal = openLongScriptConversationApplyModal;

function openLongScriptCanvasApplyModal() {
  closeLongScriptApplyMenu();
  longScriptApplyShots = extractLongScriptShotsFromPreview();
  longScriptCanvasItems = createLongScriptCanvasItems();
  if (!longScriptApplyShots.length) return showToast('当前预览中没有可应用的镜头', 'warning');
  const modal = document.getElementById('modalLongScriptCanvasApply');
  if (!modal) return;
  renderLongScriptApplyShotList('canvas');
  renderLongScriptCanvasMergeSummary();
  modal.classList.remove('hidden');
}
window.openLongScriptCanvasApplyModal = openLongScriptCanvasApplyModal;

function closeLongScriptApplyModal(type) {
  const modal = document.getElementById(type === 'conversation' ? 'modalLongScriptConversationApply' : 'modalLongScriptCanvasApply');
  if (modal) modal.classList.add('hidden');
}
window.closeLongScriptApplyModal = closeLongScriptApplyModal;

function applyLongScriptShotsToConversation() {
  const selectedIndexes = getLongScriptApplySelectedIndexes('conversation');
  if (!selectedIndexes.length) return showToast('请至少选择一个镜头', 'warning');
  const selectedShots = selectedIndexes.map(index => longScriptApplyShots[index]).filter(Boolean);
  const imageShots = selectedShots.filter(shot => shot.refImg);
  if (imageShots.length > LONG_SCRIPT_MAX_IMAGES) {
    return showToast(`所选镜头包含 ${imageShots.length} 张参考图，超过最多 ${LONG_SCRIPT_MAX_IMAGES} 张的限制，请减少选择`, 'warning');
  }

  const creativeInput = document.getElementById('aiChatTextarea');
  if (!creativeInput) return showToast('未找到“创作”页面输入框', 'error');
  const existingMedia = state.chatRefMediaList || [];
  const newMedia = imageShots.map((shot, index) => ({
    id: `ref_long_script_${Date.now()}_${index}`,
    fileName: `${shot.no} 参考图`,
    url: shot.refImg,
    type: 'image',
    fileObj: null,
    source: 'long-script-preview'
  })).filter(media => !existingMedia.some(item => item.url === media.url));
  if (existingMedia.length + newMedia.length > LONG_SCRIPT_MAX_IMAGES) {
    return showToast(`“创作”页面已有参考媒体，合并后将超过 ${LONG_SCRIPT_MAX_IMAGES} 张上限，请先移除部分媒体`, 'warning');
  }

  creativeInput.value = selectedShots.map(getLongScriptShotCopy).join('\n\n');
  state.chatRefMediaList = [...existingMedia, ...newMedia];
  renderChatRefMediaList();
  closeLongScriptApplyModal('conversation');
  syncChatGenerationMode('video');
  switchView('videoGen');
  const inputBox = document.querySelector('.ai-chat-input-box');
  requestAnimationFrame(() => {
    inputBox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    creativeInput.focus();
    inputBox?.classList.add('ls-apply-target-highlight');
    window.setTimeout(() => inputBox?.classList.remove('ls-apply-target-highlight'), 1600);
  });
  showToast(`已将 ${selectedShots.length} 个镜头应用到菜单栏“创作”页面`, 'success');
}
window.applyLongScriptShotsToConversation = applyLongScriptShotsToConversation;

function renderLongScriptCanvasMergeSummary() {
  const summary = document.getElementById('longScriptCanvasMergeSummary');
  if (!summary) return;
  const mergedItems = longScriptCanvasItems.filter(item => item.shotIndexes.length > 1);
  if (!mergedItems.length) {
    summary.innerHTML = '<span>尚未合并条目。当前默认全不选，可使用底部“全选”，也可按需勾选后合并。</span>';
    return;
  }
  summary.innerHTML = mergedItems.map((item, groupIndex) => {
    const names = getLongScriptCanvasItemShots(item).map(shot => shot.no).join('、');
    return `<span class="ls-canvas-merge-chip">合并条目 ${groupIndex + 1}：${escapeHTML(names)}</span>`;
  }).join('');
}

function mergeSelectedLongScriptCanvasShots() {
  const selectedItemIndexes = getLongScriptApplySelectedIndexes('canvas');
  if (selectedItemIndexes.length < 2) return showToast('请至少勾选 2 个条目进行合并', 'warning');
  const selectedSet = new Set(selectedItemIndexes);
  const selectedItems = longScriptCanvasItems.filter((item, index) => selectedSet.has(index));
  const mergedShotIndexes = selectedItems.flatMap(item => item.shotIndexes).sort((a, b) => a - b);
  const insertAt = Math.min(...selectedItemIndexes);
  const mergedItem = {
    id: `canvas_merged_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    shotIndexes: mergedShotIndexes,
    checked: true
  };
  longScriptCanvasItems = longScriptCanvasItems.filter((item, index) => !selectedSet.has(index));
  longScriptCanvasItems.splice(insertAt, 0, mergedItem);
  renderLongScriptApplyShotList('canvas');
  renderLongScriptCanvasMergeSummary();
  showToast(`已合并为一个条目：${getLongScriptCanvasItemShots(mergedItem).map(shot => shot.no).join('、')}`, 'success');
}
window.mergeSelectedLongScriptCanvasShots = mergeSelectedLongScriptCanvasShots;

function toggleAllLongScriptCanvasItems() {
  const shouldSelectAll = longScriptCanvasItems.some(item => !item.checked);
  longScriptCanvasItems.forEach(item => { item.checked = shouldSelectAll; });
  renderLongScriptApplyShotList('canvas');
}
window.toggleAllLongScriptCanvasItems = toggleAllLongScriptCanvasItems;

function clearLongScriptCanvasMerges() {
  longScriptCanvasItems = createLongScriptCanvasItems();
  renderLongScriptApplyShotList('canvas');
  renderLongScriptCanvasMergeSummary();
}
window.clearLongScriptCanvasMerges = clearLongScriptCanvasMerges;

function getLongScriptCanvasGroups() {
  return longScriptCanvasItems.filter(item => item.checked).map(getLongScriptCanvasItemShots).filter(group => group.length > 0);
}

function createLongScriptCanvasNodeId(prefix, index) {
  return `node_long_script_${prefix}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`;
}

async function applyLongScriptShotsToCanvas() {
  if (!longScriptApplyShots.length) return showToast('当前预览中没有可应用的镜头', 'warning');
  updateLongScriptApplySelection('canvas');
  const groups = getLongScriptCanvasGroups();
  if (!groups.length) return showToast('请至少勾选一个镜头或合并条目', 'warning');
  const startY = 70;
  const imageX = 70;
  const promptX = 430;
  const videoX = 910;
  const promptWidth = 430;
  const promptHeight = 260;
  const videoWidth = 330;
  const videoHeight = 300;
  const gapY = 45;
  const importedNodes = [];
  const importedConnections = [];
  let imageIndex = 0;
  let currentY = startY;

  groups.forEach((group, groupIndex) => {
    const groupName = group.length > 1
      ? `镜头${group.map(shot => shot.no.replace(/^镜(?:头)?\s*/, '').replace(/\s*\([^)]*\)\s*$/, '')).join('、')}`
      : group[0].no;
    const promptNode = {
      id: createLongScriptCanvasNodeId('prompt', groupIndex),
      type: 'text',
      x: promptX,
      y: currentY,
      width: promptWidth,
      height: promptHeight,
      title: `📝 ${groupName}`,
      content: group.map(getLongScriptShotCopy).join('\n\n'),
      source: 'long-script-preview',
      shotNos: group.map(shot => shot.no)
    };
    importedNodes.push(promptNode);
    const videoNode = {
      id: createLongScriptCanvasNodeId('video', groupIndex),
      type: 'video',
      x: videoX,
      y: currentY,
      width: videoWidth,
      height: videoHeight,
      title: `🎬 ${groupName} 视频生成`,
      model: getPreferredServerModel('canvas', 'video'),
      aspect: '16:9',
      duration: 15,
      videoUrl: null,
      status: 'idle',
      source: 'long-script-preview',
      shotNos: group.map(shot => shot.no)
    };
    importedNodes.push(videoNode);
    importedConnections.push({ fromId: promptNode.id, toId: videoNode.id });

    let groupImageIndex = 0;
    group.forEach(shot => {
      if (!shot.refImg) return;
      const imageNode = {
        id: createLongScriptCanvasNodeId('image', imageIndex++),
        type: 'asset',
        x: imageX,
        y: promptNode.y + groupImageIndex++ * 225,
        width: 300,
        height: 210,
        title: `🖼️ ${shot.no} 参考图`,
        assetName: `${shot.no} 参考图`,
        imgUrl: shot.refImg,
        mediaAutoSizePending: true,
        source: 'long-script-preview',
        shotNo: shot.no
      };
      importedNodes.push(imageNode);
      importedConnections.push({ fromId: imageNode.id, toId: videoNode.id });
    });
    const groupImageCount = group.filter(shot => shot.refImg).length;
    currentY += Math.max(promptHeight, videoHeight, groupImageCount * 225) + gapY;
  });

  try {
    const session = await SessionSystem.createNew('canvas', {
      force: true,
      data: { nodes: importedNodes, connections: importedConnections, zoom: 1, panX: 0, panY: 0, tasks: [] }
    });
    if (!session || session.type !== 'canvas') throw new Error('无法创建新的画布会话');
    session.title = `长剧本画布 · ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    canvasState.selectedNodeIds = importedNodes.map(node => node.id);
    renderCanvasNodesAndLines();
    requestAnimationFrame(() => autoFitCanvasToViewport());
    await SessionSystem.saveNow({ touch: false });
    closeLongScriptApplyModal('canvas');
    const imageNodeCount = importedNodes.filter(node => node.type === 'asset').length;
    showToast(`已新建画布会话并应用 ${groups.length} 组：${groups.length} 个提示词节点、${imageNodeCount} 个参考图节点和 ${groups.length} 个视频节点`, 'success');
  } catch (error) {
    console.error('长剧本应用到新画布失败:', error);
    showToast(`应用到画布失败：${error.message || '无法创建画布会话'}`, 'error');
  }
}
window.applyLongScriptShotsToCanvas = applyLongScriptShotsToCanvas;

// 兼容旧入口：保留函数名，但改为打开画布应用弹窗。
function importLongScriptShotsToCanvas() {
  openLongScriptCanvasApplyModal();
}
window.importLongScriptShotsToCanvas = importLongScriptShotsToCanvas;

// 沉浸式全屏预览
function toggleLongScriptFullscreen() {
  const card = document.getElementById('geminiCanvasBrowserCard');
  if (!card) return;

  if (!document.fullscreenElement) {
    card.requestFullscreen().catch(err => {
      showToast(`无法进入全屏：${err.message}`, 'warning');
    });
  } else {
    document.exitFullscreen();
  }
}
window.toggleLongScriptFullscreen = toggleLongScriptFullscreen;

// 更新聊天框底部模型名标签
function updateLongScriptModelBadge() {
  renderLongScriptModelSelector();
}
window.updateLongScriptModelBadge = updateLongScriptModelBadge;

function handleLongScriptModelChange(event) {
  const model = String(event.target.value || '').trim();
  if (!model) return;
  state.apiConfig.llmModelName = model;
  localStorage.setItem('api_llmModelName', model);
  updateAuxiliaryPricePreviews();
}

document.addEventListener('change', event => {
  if (event.target?.id === 'longScriptModelSelect') handleLongScriptModelChange(event);
});

function getLongScriptMessageImages(message) {
  if (!message || !Array.isArray(message.images)) return [];
  return message.images.filter(image => image && typeof image.url === 'string' && image.url.startsWith('data:image/'));
}

function renderLongScriptMessage(message, options = {}) {
  const role = message && message.role === 'user' ? 'user' : 'assistant';
  const text = message && typeof message.content === 'string' ? message.content : '';
  const images = getLongScriptMessageImages(message);
  const bubbleId = options.bubbleId ? ` id="${options.bubbleId}"` : '';
  const textHtml = escapeHTML(text).replace(/\n/g, '<br>');
  const imagesHtml = images.length > 0 ? `
    <div class="ls-message-images">
      ${images.map(image => `<img class="ls-message-image" src="${image.url}" alt="${escapeHTML(image.name || '聊天图片')}" title="点击查看原图" onclick="window.open(this.src, '_blank')">`).join('')}
    </div>` : '';

  if (role === 'user') {
    return `<div class="ls-chat-msg user-msg"><div class="ls-bubble"><div class="ls-message-text">${textHtml}</div>${imagesHtml}${messageCopyButton(text)}</div></div>`;
  }

  return `<div class="ls-chat-msg ai-msg"><div class="ls-avatar">AI</div><div class="ls-bubble"><div class="ls-message-text"${bubbleId}>${textHtml}</div>${messageCopyButton(text)}</div></div>`;
}

function renderLongScriptAttachmentPreview() {
  const preview = document.getElementById('longScriptAttachmentPreview');
  const summary = document.getElementById('longScriptAttachmentSummary');
  if (!preview) return;
  const images = window.longScriptPendingImages || [];
  preview.classList.toggle('has-items', images.length > 0);
  if (summary) {
    summary.classList.toggle('has-items', images.length > 0);
    summary.textContent = images.length > 0 ? `已选择 ${images.length}/${LONG_SCRIPT_MAX_IMAGES} 张图片` : '';
  }
  preview.innerHTML = images.map(image => {
    const status = image.status || (image.url ? 'ready' : 'loading');
    const loadingPreview = image.previewUrl ? `<img class="ls-attachment-loading-image" src="${image.previewUrl}" alt="${escapeHTML(image.name || '待发送图片')}">` : '';
    const statusContent = status === 'loading'
      ? `${loadingPreview}<div class="ls-attachment-state"><span class="ls-attachment-spinner"></span><span>读取中</span></div>`
      : status === 'error'
        ? `<div class="ls-attachment-state error"><span>!</span><span>${escapeHTML(image.error || '读取失败')}</span></div>`
        : `<img src="${image.url}" alt="${escapeHTML(image.name || '待发送图片')}">`;
    return `
      <div class="ls-attachment-item is-${status}">
        ${statusContent}
        <button type="button" class="ls-attachment-remove" onclick="removeLongScriptPendingImage('${image.id}')" title="移除图片" aria-label="移除图片">×</button>
      </div>
    `;
  }).join('');
}

function revokeLongScriptPreviewUrl(image) {
  if (image && image.previewUrl && image.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(image.previewUrl);
    image.previewUrl = '';
  }
}

function removeLongScriptPendingImage(imageId) {
  const targetImage = (window.longScriptPendingImages || []).find(image => image.id === imageId);
  revokeLongScriptPreviewUrl(targetImage);
  window.longScriptPendingImages = (window.longScriptPendingImages || []).filter(image => image.id !== imageId);
  renderLongScriptAttachmentPreview();
  if (SessionSystem.isInitialized() && !SessionSystem.isApplying()) SessionSystem.scheduleSave();
}
window.removeLongScriptPendingImage = removeLongScriptPendingImage;

function readLongScriptFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function isLongScriptImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i.test(file.name || '');
}

function getLongScriptDroppedImageFiles(dataTransfer) {
  if (!dataTransfer) return [];
  const itemFiles = Array.from(dataTransfer.items || [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter(isLongScriptImageFile);
  if (itemFiles.length > 0) return itemFiles;
  return Array.from(dataTransfer.files || []).filter(isLongScriptImageFile);
}

function handleLongScriptDragOver(event) {
  if (!event) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  document.getElementById('longScriptChatInputCard')?.classList.add('drag-over');
}
window.handleLongScriptDragOver = handleLongScriptDragOver;

function handleLongScriptDragLeave(event) {
  if (!event) return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.currentTarget?.contains(event.relatedTarget)) {
    document.getElementById('longScriptChatInputCard')?.classList.remove('drag-over');
  }
}
window.handleLongScriptDragLeave = handleLongScriptDragLeave;

async function handleLongScriptDrop(event) {
  if (!event) return;
  event.preventDefault();
  event.stopPropagation();
  document.getElementById('longScriptChatInputCard')?.classList.remove('drag-over');
  const files = getLongScriptDroppedImageFiles(event.dataTransfer);
  if (files.length === 0) {
    showToast('没有检测到可上传的图片文件', 'warning');
    return;
  }
  await addLongScriptImageFiles(files);
  document.getElementById('longScriptChatInput')?.focus();
}
window.handleLongScriptDrop = handleLongScriptDrop;

async function addLongScriptImageFiles(fileList) {
  const originSession = getActiveLongScriptSession();
  const originSessionId = originSession?.id || null;
  const files = Array.from(fileList || []).filter(isLongScriptImageFile);
  if (files.length === 0) {
    showToast('请选择图片文件', 'warning');
    return 0;
  }

  let slots = LONG_SCRIPT_MAX_IMAGES - (window.longScriptPendingImages || []).length;
  if (slots <= 0) {
    showToast(`每条消息最多添加 ${LONG_SCRIPT_MAX_IMAGES} 张图片`, 'warning');
    return 0;
  }

  const selectedFiles = files.slice(0, slots);
  const pendingEntries = selectedFiles.map(file => ({
    file,
    image: {
      id: `ls_img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: file.name || '本地图片',
      url: '',
      status: file.size > LONG_SCRIPT_MAX_IMAGE_BYTES ? 'error' : 'loading',
      error: file.size > LONG_SCRIPT_MAX_IMAGE_BYTES ? '文件超过 50 MB' : '',
      previewUrl: file.size <= LONG_SCRIPT_MAX_IMAGE_BYTES ? URL.createObjectURL(file) : ''
    }
  }));

  window.longScriptPendingImages.push(...pendingEntries.map(entry => entry.image));
  renderLongScriptAttachmentPreview();

  await Promise.all(pendingEntries.map(async ({ file, image }) => {
    if (image.status === 'error') {
      showToast(`${file.name} 超过 50 MB`, 'warning');
      return;
    }
    try {
      image.url = await readLongScriptFileAsDataUrl(file);
      image.status = 'ready';
      revokeLongScriptPreviewUrl(image);
    } catch (error) {
      image.status = 'error';
      image.error = error && error.name === 'NotReadableError' ? '系统无法读取该文件' : (error.message || '文件读取失败');
      showToast(`${file.name}：${image.error}`, 'error');
    }
    if (isActiveLongScriptSession(originSessionId)) renderLongScriptAttachmentPreview();
  }));

  if (files.length > slots) showToast(`每条消息最多添加 ${LONG_SCRIPT_MAX_IMAGES} 张图片`, 'info');
  if (originSessionId && !isActiveLongScriptSession(originSessionId)) {
    await SessionSystem.updateSessionData(originSessionId, data => {
      const byId = new Map((data.pendingImages || []).map(item => [item.id, item]));
      pendingEntries.forEach(({ image }) => byId.set(image.id, clone(image)));
      data.pendingImages = [...byId.values()];
      return data;
    });
  } else {
    renderLongScriptAttachmentPreview();
    if (SessionSystem.isInitialized() && !SessionSystem.isApplying()) SessionSystem.scheduleSave();
  }
  return pendingEntries.filter(({ image }) => image.status === 'ready').length;
}

async function handleLongScriptImageInput(input) {
  if (!input) return;
  await addLongScriptImageFiles(input.files);
  input.value = '';
}
window.handleLongScriptImageInput = handleLongScriptImageInput;

function getLongScriptAssetImages() {
  const assetImages = (state.assets || []).map(asset => ({
    id: `asset_${asset.id}`,
    name: asset.name || '资产图片',
    url: asset.imageUrl || ''
  }));
  const uploadedImages = (state.uploadedResources || []).map(resource => ({
    id: `uploaded_${resource.id}`,
    name: resource.name || '已上传图片',
    url: resource.url || ''
  }));
  return [...assetImages, ...uploadedImages].filter(item => item.url && (item.url.startsWith('data:image/') || item.url.startsWith('http://') || item.url.startsWith('https://') || item.url.startsWith('assets/')));
}

function openLongScriptAssetPicker() {
  const modal = document.getElementById('modalLongScriptAssetPicker');
  const grid = document.getElementById('longScriptAssetPickerGrid');
  if (!modal || !grid) return;
  const items = getLongScriptAssetImages();
  grid.innerHTML = items.length > 0 ? items.map(item => `
    <button type="button" class="ls-asset-picker-item" onclick="addLongScriptAssetImage('${item.id}')">
      <img src="${item.url}" alt="${escapeHTML(item.name)}">
      <span>${escapeHTML(item.name)}</span>
    </button>
  `).join('') : '<div class="ls-asset-picker-empty">资产库中暂无可用图片</div>';
  modal.classList.remove('hidden');
}
window.openLongScriptAssetPicker = openLongScriptAssetPicker;

function closeLongScriptAssetPicker() {
  const modal = document.getElementById('modalLongScriptAssetPicker');
  if (modal) modal.classList.add('hidden');
}
window.closeLongScriptAssetPicker = closeLongScriptAssetPicker;

function addLongScriptAssetImage(itemId) {
  if ((window.longScriptPendingImages || []).length >= LONG_SCRIPT_MAX_IMAGES) {
    showToast(`每条消息最多添加 ${LONG_SCRIPT_MAX_IMAGES} 张图片`, 'warning');
    return;
  }
  const item = getLongScriptAssetImages().find(image => image.id === itemId);
  if (!item) return;
  if (window.longScriptPendingImages.some(image => image.url === item.url)) {
    showToast('这张图片已经添加', 'info');
    return;
  }
  window.longScriptPendingImages.push({
    id: `ls_img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: item.name,
    url: item.url,
    status: 'ready'
  });
  renderLongScriptAttachmentPreview();
  if (SessionSystem.isInitialized() && !SessionSystem.isApplying()) SessionSystem.scheduleSave();
  closeLongScriptAssetPicker();
}
window.addLongScriptAssetImage = addLongScriptAssetImage;

async function normalizeLongScriptImageForApi(image, signal = null) {
  if (!image || image.status === 'error' || !image.url) return null;
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
  if (image.url.startsWith('data:image/')) return { ...image, status: 'ready' };
  try {
    const response = await fetch(image.url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
    const file = new File([blob], image.name || 'asset-image', { type: blob.type || 'image/jpeg' });
    return { ...image, url: await readLongScriptFileAsDataUrl(file), status: 'ready' };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    console.warn('资产图片读取失败:', image.url, error);
    return null;
  }
}

function buildLongScriptApiMessage(message) {
  const images = getLongScriptMessageImages(message);
  if (images.length === 0) return { role: message.role, content: message.content || '' };
  const content = [];
  if (message.content) content.push({ type: 'text', text: message.content });
  images.forEach(image => content.push({ type: 'image_url', image_url: { url: image.url } }));
  return { role: message.role, content };
}

// 💬 重置清空对话 (开场白：有什么想法，尽管和我说说。)
function resetLongScriptChat() {
  const activeSession = getActiveLongScriptSession();
  if (activeSession && isLongScriptSessionRunning(activeSession.id)) {
    showToast('当前会话正在生成，请等待完成或删除会话后再清空对话', 'info');
    return;
  }
  const container = document.getElementById('longScriptChatContainer');
  if (container) {
    container.innerHTML = renderLongScriptMessage({ role: 'assistant', content: '有什么想法，尽管和我说说。' });
  }
  window.longScriptChatHistory = [];
  window.longScriptPendingImages = [];
  renderLongScriptAttachmentPreview();
  saveLongScriptState();
  showToast('🔄 已清空对话，右侧分镜预览保持不变', 'info');
}
window.resetLongScriptChat = resetLongScriptChat;

const longScriptRuns = new Map();
const staleLongScriptRuns = new Set();

function clone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (error) {}
  }
  return JSON.parse(JSON.stringify(value));
}

function getActiveLongScriptSession() {
  const session = SessionSystem.getActive();
  return session?.type === 'long-script' ? session : null;
}

function isLongScriptSessionRunning(sessionId) {
  return !!sessionId && longScriptRuns.get(sessionId)?.status === 'running';
}

function cancelLongScriptRun(sessionId, reason = 'AI 请求已取消') {
  const runtime = longScriptRuns.get(sessionId);
  if (!runtime) return false;
  runtime.cancelReason = reason;
  runtime.controller?.abort();
  return true;
}
window.cancelLongScriptRun = cancelLongScriptRun;

function isActiveLongScriptSession(sessionId) {
  return getActiveLongScriptSession()?.id === sessionId;
}

function getLongScriptEndpointConfig() {
  if (!BackendClient.isAuthenticated()) {
    return { modelName: '', valid: false, error: '请先登录后再使用长剧本对话' };
  }
  const modelName = getPreferredServerModel('long-script', 'long-script', state.apiConfig?.llmModelName);
  if (!modelName) {
    return { modelName: '', valid: false, error: '暂无可用长剧本模型，请联系管理员启用模型' };
  }
  return { modelName, valid: true, error: '' };
}

function buildLongScriptSystemPrompt(currentHtmlContext) {
  const htmlContext = currentHtmlContext || getEmptyLongScriptPreviewHtml();
  return `你是一位专业短视频剧本协同导演。用户正在左侧与你对话，右侧浏览器会实时渲染你返回的 HTML 分镜表。

【意图判断规则】
A. 用户明确要求新增、删除、修改、重写或优化剧本、镜头、分镜表时：先简短说明修改内容，再在回答末尾输出一个完整、可独立渲染的 HTML 网页，放在 \`\`\`html 代码块内。
B. 问候、闲聊、提问、解释、确认、感谢、点评但未要求修改时：只返回文字，绝对不要输出 HTML、Markdown 表格或 JSON。

【预览规则】
1. 使用浅色主题：背景 #f8fafc 或 #ffffff，文字 #0f172a，表头 #f1f5f9，边框 #e2e8f0。
2. 表头固定：thead 使用 position: sticky; top: 0; z-index: 100。标题条不固定。
3. 行高由第 3 列“画面详细描述”决定；该列 textarea 使用 height: auto; min-height: 70px。其他长内容在单元格内部滚动或截断，不得撑高整行。
4. 无参考图时保留 shot-image-cell empty 占位框，只显示“+”，支持点击和拖拽上传。
5. 必须保持 7 列：镜号、景别与运镜、画面详细描述、旁白/台词/Foley音效、景别参考图、核心卖点、AI Prompt。

【当前会话的分镜 HTML，仅在修改请求时使用】
\`\`\`html
${htmlContext}
\`\`\`

只有修改请求才输出完整 HTML；非修改请求只输出文字。`;
}

function parseLongScriptShotsFromHtml(htmlCode, fallbackShots = []) {
  if (!htmlCode || typeof DOMParser !== 'function') return clone(fallbackShots || []);
  try {
    const doc = new DOMParser().parseFromString(htmlCode, 'text/html');
    const rows = Array.from(doc.querySelectorAll('table tbody tr'));
    if (!rows.length) return clone(fallbackShots || []);
    return rows.map((row, index) => {
      const cells = row.querySelectorAll(':scope > td');
      const readCell = cell => String(cell?.querySelector('textarea, input')?.value || cell?.textContent || '').replace(/\s+/g, ' ').trim();
      const refImg = cells[4]?.querySelector('img')?.getAttribute('src') || '';
      return {
        no: readCell(cells[0]) || `镜头 ${index + 1}`,
        camType: readCell(cells[1]),
        camMove: '',
        desc: readCell(cells[2]),
        voice: readCell(cells[3]),
        refImg,
        sellingPoint: readCell(cells[5]).split(/[、,，；;]/).map(item => item.trim()).filter(Boolean),
        aiPrompt: readCell(cells[6])
      };
    });
  } catch (error) {
    console.warn('解析长剧本镜头失败:', error);
    return clone(fallbackShots || []);
  }
}

function renderLongScriptRuntime(runtime) {
  if (!runtime || !isActiveLongScriptSession(runtime.sessionId)) return;
  const container = document.getElementById('longScriptChatContainer');
  if (!container) return;
  let bubble = document.getElementById(runtime.bubbleId);
  if (!bubble) {
    container.insertAdjacentHTML('beforeend', renderLongScriptMessage(
      { role: 'assistant', content: runtime.fullReplyText || 'AI 思考中...' },
      { bubbleId: runtime.bubbleId }
    ));
    bubble = document.getElementById(runtime.bubbleId);
  }
  if (bubble) bubble.innerHTML = escapeHTML(runtime.fullReplyText || 'AI 思考中...').replace(/\n/g, '<br>');
  container.scrollTop = container.scrollHeight;
}

async function markStaleLongScriptRun(sessionId) {
  if (!sessionId || staleLongScriptRuns.has(sessionId) || isLongScriptSessionRunning(sessionId)) return;
  staleLongScriptRuns.add(sessionId);
  const errorMessage = '上一次 AI 请求因页面刷新或关闭而中断，请重新发送。';
  const updated = await SessionSystem.updateSessionData(sessionId, data => {
    if (data.longScriptRun?.status !== 'running') return data;
    data.history = [...(data.history || []), { role: 'assistant', content: errorMessage }];
    data.longScriptRun = { ...data.longScriptRun, status: 'interrupted', error: errorMessage, finishedAt: Date.now() };
    return data;
  }, { touch: false });
  if (updated && isActiveLongScriptSession(sessionId)) {
    window.longScriptChatHistory = clone(updated.data.history || []);
    const container = document.getElementById('longScriptChatContainer');
    if (container) {
      container.innerHTML = window.longScriptChatHistory.map(message => renderLongScriptMessage(message)).join('');
      container.scrollTop = container.scrollHeight;
    }
  }
}

function syncLongScriptRunUi(runState = null) {
  const session = getActiveLongScriptSession();
  const runtime = session ? longScriptRuns.get(session.id) : null;
  const storedRun = runState || session?.data?.longScriptRun || null;
  const isRunning = runtime?.status === 'running';
  const sendButton = document.getElementById('btnSendLongScriptChat');
  if (sendButton) {
    sendButton.disabled = isRunning;
    sendButton.style.opacity = isRunning ? '0.58' : '';
    sendButton.title = isRunning ? '当前会话已有一个 AI 请求正在执行' : '';
  }
  const overlay = document.getElementById('longScriptRightLoadingOverlay');
  if (overlay) overlay.style.display = isRunning && runtime.hasShownLoading ? 'flex' : 'none';
  if (runtime) renderLongScriptRuntime(runtime);
  else if (storedRun?.status === 'running' && session) void markStaleLongScriptRun(session.id);
  updateLongScriptRollbackButton();
}
window.syncLongScriptRunUi = syncLongScriptRunUi;

async function persistLongScriptRunResult(runtime, assistantMessage, htmlCode, status, error = '') {
  const finishedAt = Date.now();
  return SessionSystem.updateSessionData(runtime.sessionId, data => {
    data.history = [...runtime.baseHistory, runtime.userMessage, assistantMessage];
    if (htmlCode) {
      const previousHtml = sanitizeLongScriptPreviewHtml(data.htmlCode || runtime.baseHtml || '');
      const nextHtml = sanitizeLongScriptPreviewHtml(htmlCode);
      if (previousHtml && previousHtml !== nextHtml) {
        const versions = Array.isArray(data.versions) ? [...data.versions] : [];
        const lastVersion = versions[versions.length - 1];
        if (!lastVersion || lastVersion.htmlCode !== previousHtml) {
          versions.push({
            htmlCode: previousHtml,
            shots: clone(data.shots || runtime.baseShots || []),
            createdAt: Date.now()
          });
        }
        data.versions = versions.slice(-30);
      }
      data.htmlCode = nextHtml;
      data.shots = parseLongScriptShotsFromHtml(data.htmlCode, runtime.baseShots);
    }
    data.longScriptRun = {
      id: runtime.id,
      status,
      startedAt: runtime.startedAt,
      finishedAt,
      error
    };
    return data;
  });
}

function applyLongScriptResultToActiveSession(session) {
  if (!session || !isActiveLongScriptSession(session.id)) return;
  window.longScriptChatHistory = clone(session.data.history || []);
  const input = document.getElementById('longScriptChatInput');
  const liveInputDraft = input?.value || '';
  const livePendingImages = clone(window.longScriptPendingImages || []);
  window.longScriptPendingImages = livePendingImages.length
    ? livePendingImages
    : clone(session.data.pendingImages || []);
  window.currentStoryboardShots = clone(session.data.shots || []);
  if (input && !liveInputDraft) input.value = session.data.inputDraft || '';
  const container = document.getElementById('longScriptChatContainer');
  if (container) {
    container.innerHTML = window.longScriptChatHistory.map(message => renderLongScriptMessage(message)).join('')
      || renderLongScriptMessage({ role: 'assistant', content: '有什么想法，尽管和我说说。' });
    container.scrollTop = container.scrollHeight;
  }
  renderLongScriptAttachmentPreview();
  renderCanvasBrowserHtml(session.data.htmlCode || '', { persist: false, allowEmpty: true });
  updateLongScriptRollbackButton();
  syncLongScriptRunUi(session.data.longScriptRun || null);
}

function updateLongScriptRollbackButton() {
  const button = document.getElementById('btnLongScriptRollback');
  if (!button) return;
  const session = getActiveLongScriptSession();
  const versionCount = Array.isArray(session?.data?.versions) ? session.data.versions.length : 0;
  const unavailable = !session || versionCount === 0 || isLongScriptSessionRunning(session.id);
  button.disabled = unavailable;
  button.classList.toggle('is-disabled', unavailable);
  button.setAttribute('aria-label', versionCount ? `回退至上一版本，剩余 ${versionCount} 个版本` : '暂无可回退版本');
}
window.updateLongScriptRollbackButton = updateLongScriptRollbackButton;

async function rollbackLongScriptVersion() {
  const session = getActiveLongScriptSession();
  if (!session) return;
  if (isLongScriptSessionRunning(session.id)) {
    showToast('当前会话正在生成，请等待完成后再回退', 'info');
    return;
  }
  const versions = Array.isArray(session.data?.versions) ? session.data.versions : [];
  if (!versions.length) {
    showToast('当前会话暂无可回退版本', 'info');
    updateLongScriptRollbackButton();
    return;
  }
  const button = document.getElementById('btnLongScriptRollback');
  if (button) button.disabled = true;
  try {
    const updatedSession = await SessionSystem.updateSessionData(session.id, data => {
      const nextVersions = Array.isArray(data.versions) ? [...data.versions] : [];
      const previous = nextVersions.pop();
      if (!previous) return data;
      data.htmlCode = sanitizeLongScriptPreviewHtml(previous.htmlCode || '');
      data.shots = clone(previous.shots || parseLongScriptShotsFromHtml(data.htmlCode, []));
      data.versions = nextVersions;
      return data;
    });
    if (updatedSession && isActiveLongScriptSession(updatedSession.id)) {
      applyLongScriptResultToActiveSession(updatedSession);
      showToast('已回退至上一版本', 'success');
    }
  } catch (error) {
    console.error('长剧本版本回退失败:', error);
    showToast(`回退失败：${error.message || '无法保存会话'}`, 'error');
  } finally {
    updateLongScriptRollbackButton();
  }
}
window.rollbackLongScriptVersion = rollbackLongScriptVersion;

// 按 sessionId 持有请求上下文，切换页面或会话不会改变请求归属。
async function sendLongScriptChatMessage() {
  const input = document.getElementById('longScriptChatInput');
  const container = document.getElementById('longScriptChatContainer');
  const activeSession = getActiveLongScriptSession();
  if (!input || !container || !activeSession) return;
  if (isLongScriptSessionRunning(activeSession.id)) {
    showToast('当前长剧本会话已有一个 AI 请求正在执行', 'info');
    return;
  }

  const text = input.value.trim();
  const inputSnapshot = input.value;
  const pendingImages = clone(window.longScriptPendingImages || []);
  const pendingImageIds = new Set(pendingImages.map(image => image.id));
  if (!text && pendingImages.length === 0) return showToast('请输入文字或添加图片', 'warning');
  if (pendingImages.some(image => image.status === 'loading')) return showToast('图片仍在读取中，请等待转圈结束后再发送', 'info');
  if (pendingImages.some(image => image.status === 'error')) return showToast('存在读取失败的图片，请移除后重试', 'error');

  const runtime = {
    id: `ls_run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sessionId: activeSession.id,
    bubbleId: `ls_ai_bubble_${activeSession.id}_${Date.now()}`,
    status: 'running',
    startedAt: Date.now(),
    baseHistory: clone(window.longScriptChatHistory || []),
    baseHtml: window.currentCanvasHtmlCode || '',
    baseShots: clone(window.currentStoryboardShots || []),
    userMessage: null,
    fullReplyText: '',
    hasShownLoading: false,
    controller: new AbortController()
  };
  longScriptRuns.set(runtime.sessionId, runtime);
  activeSession.data.longScriptRun = { id: runtime.id, status: 'running', startedAt: runtime.startedAt };
  syncLongScriptRunUi(activeSession.data.longScriptRun);

  let persistedSession = null;
  try {
    persistedSession = await SessionSystem.ensureActivePersisted();
  } catch (error) {
    console.error('保存长剧本会话失败:', error);
  }
  if (!persistedSession || persistedSession.id !== runtime.sessionId) {
    longScriptRuns.delete(runtime.sessionId);
    if (isActiveLongScriptSession(runtime.sessionId)) {
      activeSession.data.longScriptRun = null;
      syncLongScriptRunUi(null);
    }
    showToast('无法保存当前长剧本会话，请重试', 'error');
    return;
  }

  let normalizedImages = [];
  const normalizeTimeoutId = window.setTimeout(() => runtime.controller.abort(), 60000);
  try {
    normalizedImages = (await Promise.all(
      pendingImages.map(image => normalizeLongScriptImageForApi(image, runtime.controller.signal))
    )).filter(Boolean);
  } catch (error) {
    if (error?.name !== 'AbortError') console.warn('长剧本附件预处理失败:', error);
  } finally {
    window.clearTimeout(normalizeTimeoutId);
  }
  if (runtime.cancelReason || runtime.controller.signal.aborted || (pendingImages.length && !normalizedImages.length)) {
    const canceled = !!runtime.cancelReason;
    longScriptRuns.delete(runtime.sessionId);
    await SessionSystem.updateSessionData(runtime.sessionId, data => {
      data.longScriptRun = canceled
        ? { id: runtime.id, status: 'canceled', startedAt: runtime.startedAt, finishedAt: Date.now(), error: runtime.cancelReason }
        : null;
      return data;
    }, { touch: false });
    if (isActiveLongScriptSession(runtime.sessionId)) syncLongScriptRunUi(null);
    if (!canceled) showToast('图片读取失败或超时，请重新上传', 'error');
    return;
  }

  const userMessage = { role: 'user', content: text, images: normalizedImages };
  runtime.userMessage = userMessage;
  if (isActiveLongScriptSession(runtime.sessionId)) {
    window.longScriptChatHistory = [...runtime.baseHistory, userMessage];
    window.longScriptPendingImages = (window.longScriptPendingImages || []).filter(image => !pendingImageIds.has(image.id));
    if (input.value === inputSnapshot) input.value = '';
    renderLongScriptAttachmentPreview();
    container.innerHTML = window.longScriptChatHistory.map(message => renderLongScriptMessage(message)).join('');
    renderLongScriptRuntime(runtime);
  }

  try {
    await SessionSystem.updateSessionData(runtime.sessionId, data => {
      data.history = [...runtime.baseHistory, userMessage];
      if (data.inputDraft === inputSnapshot) data.inputDraft = '';
      data.pendingImages = (data.pendingImages || []).filter(image => !pendingImageIds.has(image.id));
      data.longScriptRun = { id: runtime.id, status: 'running', startedAt: runtime.startedAt };
      return data;
    });
  } catch (error) {
    longScriptRuns.delete(runtime.sessionId);
    if (isActiveLongScriptSession(runtime.sessionId)) syncLongScriptRunUi(null);
    showToast(`保存长剧本请求失败：${error.message || '未知错误'}`, 'error');
    return;
  }

  const config = getLongScriptEndpointConfig();
  let apiError = '';
  let finalHtml = null;
  try {
    if (!config.valid) throw new Error(config.error || '暂无可用长剧本模型，请联系管理员启用模型');
    const apiMessages = [{ role: 'system', content: buildLongScriptSystemPrompt(runtime.baseHtml) }];
    runtime.baseHistory.slice(-6).forEach(message => apiMessages.push(buildLongScriptApiMessage(message)));
    apiMessages.push(buildLongScriptApiMessage(userMessage));

    if (runtime.cancelReason || runtime.controller.signal.aborted) throw new DOMException('已取消', 'AbortError');
    runtime.fullReplyText = await backendGenerateText({
      mode: 'long-script',
      operation: 'long-script',
      model: config.modelName,
      prompt: text,
      messages: apiMessages,
      signal: runtime.controller.signal,
      onProgress: task => {
        runtime.hasShownLoading = task.status === 'running';
        if (isActiveLongScriptSession(runtime.sessionId)) syncLongScriptRunUi({ status: 'running' });
      }
    });
    runtime.hasShownLoading = runtime.fullReplyText.includes('```html');
    if (isActiveLongScriptSession(runtime.sessionId)) renderLongScriptRuntime(runtime);
    if (!runtime.fullReplyText.trim()) throw new Error('AI 服务返回了空内容');
    finalHtml = extractHtmlFromLLMText(runtime.fullReplyText);
  } catch (error) {
    apiError = error?.name === 'AbortError'
      ? (runtime.cancelReason || '请求超时（600 秒）：AI 服务响应过慢，请稍后重试。')
      : (error?.message || '无法连接到 AI 服务');
  }

  runtime.status = runtime.cancelReason ? 'canceled' : (apiError ? 'failed' : 'completed');
  const assistantContent = apiError
    ? `剧本生成失败\n\n${apiError}\n\n请检查网络或 API 配置后重试。`
    : runtime.fullReplyText;
  const assistantMessage = { role: 'assistant', content: assistantContent };
  if (isActiveLongScriptSession(runtime.sessionId)) await SessionSystem.saveNow({ touch: false });
  let updatedSession = null;
  try {
    updatedSession = await persistLongScriptRunResult(
      runtime,
      assistantMessage,
      finalHtml,
      runtime.status,
      apiError
    );
  } catch (error) {
    console.error('保存长剧本结果失败:', error);
    try {
      updatedSession = await SessionSystem.updateSessionData(runtime.sessionId, data => {
        data.longScriptRun = {
          id: runtime.id,
          status: 'failed',
          startedAt: runtime.startedAt,
          finishedAt: Date.now(),
          error: `保存 AI 结果失败：${error.message || '未知错误'}`
        };
        return data;
      }, { touch: false });
    } catch (fallbackError) {
      console.error('保存长剧本失败状态失败:', fallbackError);
    }
    showToast('AI 已返回，但保存结果失败，请检查浏览器存储空间', 'error');
  } finally {
    longScriptRuns.delete(runtime.sessionId);
    if (isActiveLongScriptSession(runtime.sessionId)) syncLongScriptRunUi(updatedSession?.data?.longScriptRun || null);
  }

  if (updatedSession && isActiveLongScriptSession(runtime.sessionId)) {
    applyLongScriptResultToActiveSession(updatedSession);
  } else if (updatedSession) {
    showToast(apiError ? '后台长剧本生成失败，已写回原会话' : '后台长剧本已生成并写回原会话', apiError ? 'error' : 'success');
  }
}
window.sendLongScriptChatMessage = sendLongScriptChatMessage;

// 页面加载
document.addEventListener('DOMContentLoaded', () => {
  // 长剧本输入框：Enter 发送，Shift+Enter 换行
  const longScriptInput = document.getElementById('longScriptChatInput');
  if (longScriptInput) {
    longScriptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendLongScriptChatMessage();
      }
    });
    longScriptInput.addEventListener('paste', event => {
      const files = getClipboardImageFiles(event);
      if (!files.length) return;
      event.preventDefault();
      void addLongScriptImageFiles(files).then(count => {
        if (count > 0) showToast(`已从剪贴板添加 ${count} 张参考图`, 'success');
      });
    });
  }

  const imageInput = document.getElementById('longScriptImageInput');
  const uploadButton = document.getElementById('btnLongScriptUploadImage');
  const assetButton = document.getElementById('btnLongScriptAssetLibrary');
  const inputCard = document.getElementById('longScriptChatInputCard');

  if (uploadButton && imageInput) {
    uploadButton.addEventListener('click', () => imageInput.click());
  }

  if (assetButton) assetButton.addEventListener('click', openLongScriptAssetPicker);

});
