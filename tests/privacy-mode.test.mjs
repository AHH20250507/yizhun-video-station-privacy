import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = name => readFileSync(join(root, name), 'utf8');
const html = read('index.html');
const app = read('app.js');
const client = read('standalone-client.js');
const css = read('style.css');
const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
];

function textFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.git' || entry.name === 'assets') return [];
    const full = join(dir, entry.name);
    return entry.isDirectory() ? textFiles(full) : [full];
  }).filter(file => statSync(file).size < 2_000_000);
}

test('privacy mode always opens the creation page by default', () => {
  assert.match(app, /async function openInitial\(\)[\s\S]*if \(EPHEMERAL_SESSION_MODE\) return startDraft\('creation'\)/);
});
test('public sidebar contains exactly the four requested creation entries', () => {
  const sidebar = html.match(/<nav class="sidebar-menu"[\s\S]*?<\/nav>/)?.[0] || '';
  const ids = [...sidebar.matchAll(/id="(nav[^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids, ['navCreate', 'navCanvasMode', 'navLongScriptGen', 'navMultiAngle']);
  assert.doesNotMatch(sidebar, /灵感中心|AI 视频生成|img-hot-badge|hot_flame_badge/);
});

test('public creation UI contains no asset-library or credit controls', () => {
  assert.doesNotMatch(html, /id="creditPill"|积分预算|管理员计价（积分）|id="btnCanvasToggleDrawer"|id="canvasDrawer"|id="btnLongScriptAssetLibrary"/);
  assert.doesNotMatch(app, /btn-save-chat-image|btn-save-image-asset-hist|btn-save-kb-hist|data-save-video-task|data-ma-action="save"/);
  assert.doesNotMatch(app, />存入资产库<|>存入知识库<|存入镜头库|<span>从资产库导入<|onclick="openCanvasAssetPicker/);
  assert.doesNotMatch(app, /renderTaskCreditBreakdown\(task\)|class="send-price-badge[^"\n]*">积分预算/);
});

test('public runtime messages contain no credit or refund wording', () => {
  assert.doesNotMatch(app, /生成失败，预扣积分已退回|生成失败，积分已退回|图片生成失败，预扣积分已退回|图片生成失败，积分已退回|渲染失败，积分已退回|无法确认积分|预计消耗[^\n`]*积分|失败任务已自动释放积分|case 'refunded': return[^\n]*已退款/);
  const multiAngleFlow = app.match(/async function generateMultiAngleImages\(\)[\s\S]*?\n}\n\nasync function handleMultiAngleResultAction/)?.[0] || '';
  assert.doesNotMatch(multiAngleFlow, /previewPricing|积分/);
});
test('creation chat stream keeps the first message visible when content grows', () => {
  assert.match(html, /id="aiChatStream"[^>]*justify-content: flex-start/);
  assert.match(css, /\.ai-chat-stream[\s\S]*?justify-content:\s*flex-start/);
});

test('creation prompt editor can be resized upward', () => {
  assert.match(html, /id="aiChatResizeHandle"/);
  assert.match(css, /\.ai-chat-resize-handle[\s\S]*cursor:\s*ns-resize/);
  assert.match(app, /function initChatInputResize\(\)[\s\S]*setPointerCapture[\s\S]*window\.addEventListener\('pointermove'/);
});

test('generated media downloads use blob-first download with a browser fallback', () => {
  assert.match(app, /async function downloadGeneratedMedia/);
  assert.match(app, /URL\.createObjectURL\(blob\)/);
  assert.match(app, /triggerBrowserDownload/);
  assert.match(app, /downloadGeneratedImage\(source, task\)[\s\S]*downloadGeneratedMedia/);
  assert.match(app, /downloadGeneratedVideo/);
});
test('published source contains no embedded provider secret', () => {
  assert.equal(html.includes('embeddedProviderConfig'), false);
  const findings = [];
  for (const file of textFiles(root)) {
    const content = readFileSync(file, 'utf8');
    for (const pattern of secretPatterns) {
      for (const match of content.matchAll(pattern)) findings.push(`${relative(root, file)}:${match[0].slice(0, 24)}`);
    }
  }
  assert.deepEqual(findings, []);
});

test('privacy mode only persists provider configuration', () => {
  assert.match(client, /PRIVACY_EPHEMERAL_MODE\s*=\s*true/);
  assert.match(client, /ALLOWED_LOCAL_STORAGE_KEYS/);
  assert.match(client, /vkb_standalone_provider_config_v2/);
  assert.match(client, /clearStoredConfig/);
  assert.doesNotMatch(client, /serviceWorker\.register\(/);
  assert.doesNotMatch(client, /for \(let index = window\.localStorage\.length[\s\S]*!ALLOWED_LOCAL_STORAGE_KEYS/);
});

test('runtime tasks, media and sessions use volatile storage', () => {
  assert.match(client, /const volatileStores\s*=/);
  assert.match(client, /if \(window\.PRIVACY_EPHEMERAL_MODE\)/);
  assert.match(app, /const EPHEMERAL_SESSION_MODE\s*=\s*window\.PRIVACY_EPHEMERAL_MODE\s*!==\s*false/);
  assert.match(app, /if \(EPHEMERAL_SESSION_MODE\)/);
});

test('history, library, credit and administration UI are disabled', () => {
  assert.match(css, /body\.standalone-mode\.privacy-ephemeral-mode[\s\S]*#sessionHistorySection/);
  assert.match(css, /body\.standalone-mode\.privacy-ephemeral-mode[\s\S]*#creditPill/);
  assert.match(css, /body\.standalone-mode\.privacy-ephemeral-mode[\s\S]*#menuGroupKb/);
  assert.match(css, /body\.standalone-mode\.privacy-ephemeral-mode[\s\S]*#menuGroupAdmin/);
  assert.match(html, /id="btnClearStoredApiConfig"/);
});

test('chat drag overlay has file filtering and unconditional cleanup', () => {
  assert.match(app, /function setupChatDragAndDrop\(\)[\s\S]*hasDraggedFiles/);
  assert.match(app, /function setupChatDragAndDrop\(\)[\s\S]*dragDepth/);
  assert.match(app, /function setupChatDragAndDrop\(\)[\s\S]*window\.addEventListener\('blur', resetDragState\)/);
  assert.match(app, /function setupChatDragAndDrop\(\)[\s\S]*document\.addEventListener\('visibilitychange'/);
});

test('reference uploads reject unsupported and oversized files', () => {
  assert.match(app, /MAX_CHAT_REFERENCE_FILE_BYTES/);
  assert.match(app, /SUPPORTED_CHAT_REFERENCE_TYPES/);
  assert.match(app, /不支持的文件格式/);
  assert.match(app, /文件过大/);
});

test('privacy cleanup is awaited and hidden features are runtime-disabled', () => {
  assert.match(client, /window\.privacyReady\s*=/);
  assert.match(client, /caches\.keys\(\)/);
  assert.match(app, /await window\.privacyReady/);
  assert.match(app, /PRIVACY_DISABLED_VIEWS/);
  assert.match(app, /if \(!window\.PRIVACY_EPHEMERAL_MODE\)[\s\S]*loadLibraryData/);
});

test('loading states terminate on success, cancellation and repeated polling errors', () => {
  assert.match(app, /await submitVideoRenderFlow[\s\S]*已提交，正在生成/);
  assert.match(app, /classList\.toggle\('is-generating', isAiChatSubmitting\)/);
  assert.match(app, /接口未返回有效任务 ID/);
  assert.match(app, /MAX_VIDEO_POLL_ERRORS/);
  assert.match(app, /activeTask\.status = 'needs_review'/);
  assert.match(app, /request\.timeout\s*=/);
  assert.match(app, /request\.ontimeout/);
  assert.match(app, /throw new DOMException\('提交已取消', 'AbortError'\)/);
});

test('dialogues expose copy controls and chat inputs accept pasted images', () => {
  assert.match(app, /data-copy-message/);
  assert.match(app, /function copyChatMessageText/);
  assert.match(app, /navigator\.clipboard\.writeText/);
  assert.match(app, /function getClipboardImageFiles/);
  assert.match(app, /handleChatMediaSelect\(\{ target: \{ files/);
  assert.match(app, /addLongScriptImageFiles\(files\)\.then/);
  assert.match(css, /\.chat-copy-button/);
});

test('provider keys require secure transport and external signals are bridged', () => {
  assert.match(client, /仅允许 HTTPS API 地址/);
  assert.match(client, /externalAbortHandler/);
  assert.match(client, /options\.signal\.addEventListener\('abort'/);
});

test('supplier media URLs are validated before rendering', () => {
  assert.match(app, /function safeMediaUrl/);
  assert.match(app, /setSafeVideoResult/);
  assert.match(app, /openLink\.rel = 'noopener noreferrer'/);
});

test('runtime task completion rejects unsafe supplier video URLs', () => {
  assert.match(app, /if \(status === 'completed' && videoUrl && !normalizedVideoUrl\)/);
  assert.match(app, /供应商返回了不安全的视频地址/);
  assert.match(app, /safeMediaUrl\(previewMediaItem\.videoUrl\)/);
});

test('long script preview is sandboxed without script execution', () => {
  assert.match(html, /id="geminiCanvasBrowserIframe"[^>]*sandbox(?:\s|>)/);
  assert.doesNotMatch(html, /sandbox="[^"]*allow-scripts/);
  assert.match(app, /querySelectorAll\('script, iframe, object, embed/);
  assert.doesNotMatch(app, /contentWindow\.document\.write/);
});

test('privacy cleanup rejects false unregister and cache deletion results', () => {
  assert.match(client, /serviceWorkerCleanup/);
  assert.match(client, /cacheCleanup/);
  assert.match(client, /旧浏览器数据清理未完成/);
});

test('copy fallback reports failure instead of false success', () => {
  assert.match(app, /copied = document\.execCommand\('copy'\) === true/);
  assert.match(app, /复制失败，请手动选择文字复制/);
});

test('canvas video polling has bounded failure and duration limits', () => {
  assert.match(app, /MAX_CANVAS_VIDEO_POLL_ERRORS/);
  assert.match(app, /MAX_CANVAS_VIDEO_POLL_DURATION_MS/);
  assert.match(app, /画布视频状态查询已停止/);
});

