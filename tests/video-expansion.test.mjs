import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const submit = app.slice(app.indexOf('async function handleAiChatSubmit()'), app.indexOf('\nfunction ', app.indexOf('async function handleAiChatSubmit()')));
async function run(enabled, flipDuringSubmit = false) {
  const calls = { render: [], confirm: [], bubbles: [] };
  const toggle = { checked: enabled };
  const refs = [{ type: 'image', tag: '@图1', reference: 'media:first', url: 'blob:first' }, { type: 'image', tag: '@图2', reference: 'media:second', url: 'blob:second' }];
  const ctx = {
    isAiChatSubmitting: false, el: { aiChatTextarea: { value: '原脚本 @图2 和 @图1' }, chatModelSelect: { value: 'video-model' }, chatAspectSelect: { value: '16:9' }, chatDurationSelect: { value: '5' }, chatExpandScriptToggle: toggle },
    state: { chatRefMediaList: refs, apiConfig: {}, chatImageCount: 1 }, clone: x => structuredClone(x),
    getChatGenerationMode: () => 'video', getSelectedChatVideoResolution: () => '1080p', clampImageCount: x => x,
    isCustomDurationVideoModel: () => false, syncCreationSubmitButtonState() {}, showToast() {},
    SessionSystem: { getActive: () => ({ type: 'creation', id: 'session1' }), ensureActivePersisted: async () => { if (flipDuringSubmit) toggle.checked = !enabled; return { id: 'session1' }; } },
    appendAiUserBubble() {}, clearAllChatMediaRefs() { refs.length = 0; }, appendAiAssistantBubble(text) { calls.bubbles.push(text); return {}; },
    renderLlmConfirmCard(...args) { calls.confirm.push(args); }, submitVideoRenderFlow: async (...args) => calls.render.push(args),
    scrollChatToBottom() {}, console
  };
  vm.createContext(ctx); vm.runInContext(submit, ctx); await ctx.handleAiChatSubmit();
  return calls;
}
test('video parameters expose an accessible enabled-by-default script expansion switch', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="chatExpandScriptToggle"[^>]*role="switch"[^>]*checked/);
  assert.ok(app.includes("chatExpandScriptGroup?.classList.toggle('hidden', isImageMode)"));
  assert.ok(app.includes("chatExpandScriptToggle: document.getElementById('chatExpandScriptToggle')"));
});

test('script expansion choice follows in-memory creation sessions without new persistent storage', () => {
  assert.equal((app.match(/videoExpandScript: /g) || []).length, 3);
  assert.ok(app.includes('el.chatExpandScriptToggle.checked = next.videoExpandScript !== false'));
  assert.ok(app.includes("el.chatExpandScriptToggle?.addEventListener('change'"));
});

test('enabled expansion preserves the existing storyboard confirmation flow', async () => {
  const calls = await run(true);
  assert.equal(calls.confirm.length, 1);
  assert.equal(calls.render.length, 0);
});

test('expansion choice is captured before asynchronous session operations', async () => {
  const calls = await run(false, true);
  assert.equal(calls.render.length, 1);
  assert.equal(calls.confirm.length, 0);
});

test('disabled script expansion directly submits original prompt and ordered reference media', async () => {
  const calls = await run(false);
  assert.equal(calls.render.length, 1);
  assert.equal(calls.confirm.length, 0);
  assert.equal(calls.render[0][1], '原脚本 @图2 和 @图1');
  assert.equal(JSON.stringify(calls.render[0][2].images), JSON.stringify(['media:first', 'media:second']));
  assert.equal(calls.render[0][2].refMediaList.length, 2);
  assert.equal(calls.render[0][2].resolution, '1080p');
});
