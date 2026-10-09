import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function fn(name) {
  const start = app.search(new RegExp('(?:async )?function '+name+'\\('));
  assert.ok(start >= 0, `missing function ${name}`);
  const rest = app.slice(start);
  const end = name === 'regenerateGenerationTask' ? rest.indexOf("\ndocument.addEventListener") : rest.slice(1).search(/\n(?:  )?(?:async )?function /) + 1;
  return end <= 0 ? rest : rest.slice(0, end);
}
const clone = x => structuredClone(x);
async function replayHarness({ mode = 'canvas', operation = 'image', changeDuringValidation = false, cancelAfterCreate = false } = {}) {
  let session = { id: 'session1', type: mode === 'canvas' ? 'canvas' : 'creation' };
  const original = { taskId: 'original', sessionId: 'session1', canvasNodeId: 'node1', options: {} };
  const node = { id: 'node1', x: 0, y: 0, type: 'asset', imgUrl: 'https://example.com/old.png', mediaReference: 'media://old', mediaId: 'old-id', imageUrl: 'https://example.com/old.png', images: ['old'], outputUrl: 'old', imageResultIds: ['old'], videoResultId: 'old', audioUrl: 'old', audios: ['old'] };
  let canceled = false;
  const calls = { submissions: 0, pollers: 0, warnings: [], activeCanvasAtWait: false };
  const ctx = { clone, Date, Math, AbortController, activeTaskRegenerations: new Set(), taskReplayControllers: new Map(), activeImageSubmissions: new Set(), activeCanvasImageSubmissions: new Set(), state: { activeTasks: [original], taskHistory: [] }, multiAngleState: { results: [] }, canvasState: { nodes: [node] }, activeLocalConversation: { id: 'conversation1' },
    getTaskRegenerationSnapshot: async () => { if (changeDuringValidation) session = { ...session, id: 'session2' }; return { request: { mode, operation, model: 'model', prompt: '@图1', input: { n: 1 }, duration: 5 }, refMediaList: [] }; }, window: { TaskRegeneration: { toRequest: s => clone(s.request) } }, getServerModels: () => [{ model: 'model' }],
    SessionSystem: { getActive: () => session, registerPendingRequest() {}, unregisterPendingRequest() {}, isTaskCanceled: () => canceled, assignTask: x => x, trackTask: async t => { if (cancelAfterCreate && t.backendTaskId) canceled = true; } },
    addCanvasNode: n => ctx.canvasState.nodes.push(n), appendAiUserBubble() {}, appendAiAssistantBubble: () => ({}),createChatImageResultCard: () => ({ insertAdjacentHTML() {} }), createChatGenCard: () => ({ insertAdjacentHTML() {} }), renderTaskReferencePrompt: () => '', updateStatusIndicators() {},
    BackendClient: { createGeneration: async () => { calls.submissions++;return { task: { id: 'new-backend' } }; }, waitForGeneration: async () => { calls.activeCanvasAtWait = ctx.activeCanvasImageSubmissions.size === 1; return { output: { url: 'https://example.com/new.png' } }; } },
    applyBackendTaskBilling: (t,b) => t.backendTaskId = b.id, startCanvasVideoTaskPoller: () => calls.pollers++,startChatCardPoller: () => calls.pollers++, extractImageSourcesFromOutput: o => [o.url], validateTaskImageSources: x => x,
    completeTask: id => ctx.state.activeTasks.find(t=>t.taskId===id), patchCanvasTaskNode: async (t,p) => Object.assign(ctx.canvasState.nodes.find(n=>n.id===t.canvasNodeId),p), renderChatImageCardResult() {},showToast: text => calls.warnings.push(text),syncCreationSubmitButtonState() {},renderChatImageBatchProgress() {}
  };
  vm.createContext(ctx);vm.runInContext(fn('regenerateGenerationTask'),ctx);await ctx.regenerateGenerationTask('original');return {ctx,calls};
}

test('capture delegation receives canvas clicks stopped in the bubble phase', () => {
  let listener, capture;
  const start=app.indexOf("document.addEventListener('click', event => {\n  const button = event.target.closest('[data-regenerate-task]')");
  const end=app.indexOf('\nfunction ',start);
  const ctx={document:{addEventListener:(_type,handler,options)=>{listener=handler;capture=options;}},regenerateGenerationTask:()=>{ctx.calls++;},calls:0};
  vm.createContext(ctx);vm.runInContext(app.slice(start,end),ctx);
  // This click's parent stops bubbling; only capture delegation gets it.
  if(capture) listener({target:{closest:()=>({dataset:{regenerateTask:'task'}})},preventDefault(){},stopPropagation(){}});
  assert.equal(ctx.calls,1);
});

test('validation-time conversation switch prevents submission to a different session', async () => {
  const {calls}=await replayHarness({mode:'creation',changeDuringValidation:true});
  assert.equal(calls.submissions,0);
});
test('cancel after backend tracking does not start video polling', async () => {
  const {calls}=await replayHarness({mode:'canvas',operation:'video',cancelAfterCreate:true});
  assert.equal(calls.pollers,0);
});

test('canvas replay clears old output identity and downstream sees the new image', async () => {
  const {ctx,calls}=await replayHarness();const next=ctx.canvasState.nodes[1];
  vm.runInContext(fn('getCanvasNodeImageSources')+'\n'+fn('getCanvasNodeProviderSources'),ctx);
  assert.equal(JSON.stringify(ctx.getCanvasNodeProviderSources(next,'asset')),JSON.stringify(['https://example.com/new.png']));
  for(const field of ['mediaId','imageUrl','images','outputUrl','imageResultIds','videoResultId','audioUrl','audios']) assert.ok(!next[field],field);
  assert.equal(calls.activeCanvasAtWait,true);
  assert.equal(ctx.activeCanvasImageSubmissions.size,0);
});

test('recovered creation tasks retain frontend identity and restore without duplicate backend aliases', () => {
  const ctx={clone, parseVideoTaskResponse:()=>({}),normalizeVideoResolution:x=>x || '720p', DEFAULT_VIDEO_MODEL:'video',extractImageSourcesFromOutput:()=>[], state:{apiConfig:{},activeTasks:[{taskId:'regenerate_new',backendTaskId:'backend-new',status:'running'}],taskHistory:[]},updateStatusIndicators(){}};
  vm.createContext(ctx);vm.runInContext(fn('frontendVideoTaskFromBackend')+'\n'+fn('frontendImageTaskFromBackend')+'\n'+fn('restoreSessionTasks'),ctx);
  for(const operation of ['video','image']) {
    const recovered=ctx[operation==='video'?'frontendVideoTaskFromBackend':'frontendImageTaskFromBackend']({id:'backend-new',requestId:'regenerate_new',operation,status:'completed'}, {id:'session1'}, {taskId:'regenerate_new'});
    assert.equal(recovered.taskId,'regenerate_new');
  }
  ctx.restoreSessionTasks([{taskId:'backend-new',requestId:'regenerate_new',backendTaskId:'backend-new',status:'completed'}]);
  assert.equal(ctx.state.activeTasks.length+ctx.state.taskHistory.length,1);
  assert.equal(ctx.state.taskHistory[0].taskId,'regenerate_new');
});

test('unsafe replay output fails before task completion', () => {
  const ctx = { URL, window: { location: { href: 'https://site.example/' } }, clampImageCount: n => n };
  vm.createContext(ctx);
  vm.runInContext(fn('safeMediaUrl') + '\n' + fn('limitImageSourcesToRequestedCount') + '\n' + fn('validateTaskImageSources'), ctx);
  assert.throws(() => ctx.validateTaskImageSources(['file:///private.png'], 1), /不安全/);
  assert.throws(() => ctx.validateTaskImageSources(['http://external.example/img.png'], 1), /不安全/);
  assert.equal(ctx.validateTaskImageSources(['https://example.com/image.png'], 1)[0], 'https://example.com/image.png');
});
