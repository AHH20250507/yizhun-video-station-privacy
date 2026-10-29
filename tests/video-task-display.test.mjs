import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function source(name) {
  const start = app.search(new RegExp('(?:async )?function '+name+'\\('));
  assert.ok(start >= 0, `missing ${name}`);
  const rest=app.slice(start); const end=rest.slice(1).search(/\n(?:async )?function /);
  return end < 0 ? rest : rest.slice(0,end+1);
}
test('video pending states show static 生成中 without fabricated progress, time or animation',()=>{const c={renderVideoEta:()=> '预计7分钟'};vm.createContext(c);vm.runInContext(source('renderChatVideoProgressLabel'),c);for(const s of ['queued','running','in_progress','reconciling','needs_review']){const html=c.renderChatVideoProgressLabel(s,92,{createdAt:1});assert.equal(html.replace(/<[^>]+>/g,''),'生成中');assert.doesNotMatch(html,/%|预计|spinner/);}assert.match(c.renderChatVideoProgressLabel('completed'),/生成完成/);assert.match(c.renderChatVideoProgressLabel('failed'),/生成失败/);assert.match(c.renderChatVideoProgressLabel('canceled'),/已取消/);assert.ok(!source('createChatGenCard').includes('progress-bar-inner'));assert.ok(!source('parseVideoTaskResponse').includes('estimatedProgress'));});
test('video card status upgrades preserve the regeneration button',()=>{
  const header={};
  const element=()=>({style:{},dataset:{},setAttribute(){}});
  const fill=element(),label=element();
  const track={...element(),querySelector:s=>s==='.progress-bar-inner'?fill:label,replaceChildren(){}};
  const card={id:'task-card-video-id',querySelector:s=>s==='.task-header'?header:s==='[data-video-progress-track]'?track:null};
  const ctx={document:{createElement:element},CSS:{escape:s=>s},escapeHTML:s=>s,shortenChatTaskId:s=>s,renderRegenerateTaskButton:id=>`<button data-regenerate-task="${id}">再次生成</button>`,renderChatVideoProgressLabel:()=>''};
  vm.createContext(ctx);vm.runInContext(source('removeTaskWarningPanels'),ctx);vm.runInContext(source('upgradeChatVideoTaskCard'),ctx);
  ctx.upgradeChatVideoTaskCard(card,{taskId:'video-id',status:'completed',progress:100});
  assert.ok(header.innerHTML.includes('data-regenerate-task="video-id"'));
  ctx.upgradeChatVideoTaskCard(card,{taskId:'video-id',status:'running',progress:14});
  assert.equal((header.innerHTML.match(/data-regenerate-task/g)||[]).length,1);
});

function context() {
  const ctx={renderTaskReferencePrompt: text=>`PROMPT:${text}`,renderTaskReferenceGallery: refs=>`GALLERY:${refs.map(r=>r.tag).join(',')}`};
  vm.createContext(ctx);vm.runInContext(source('renderTaskReferenceDetails'),ctx);return ctx;
}
test('video task without references renders no prompt block',()=>{
  assert.equal(context().renderTaskReferenceDetails('PRIVATE VIDEO PROMPT',[],'video'),'');
});
test('video task shows only original reference gallery without prompt text',()=>{
  const html=context().renderTaskReferenceDetails('PRIVATE VIDEO PROMPT @图2',[{tag:'@图1'},{tag:'@图2'}],'video');
  assert.ok(html.includes('GALLERY:@图1,@图2'));
  assert.ok(!html.includes('PRIVATE VIDEO PROMPT'));
  assert.ok(!html.includes('task-original-prompt'));
});
test('image task does not repeat user prompt or references in the AI result',()=>{
  assert.equal(context().renderTaskReferenceDetails('IMAGE PROMPT',[],'image'),'');
  assert.equal(context().renderTaskReferenceDetails('IMAGE PROMPT @图1',[{tag:'@图1'}],'image'),'');
});
test('image response cleanup removes repeated prompt and prose but leaves user messages and result controls',()=>{
  const removed=[];
  const content={querySelectorAll:()=>[{remove:()=>removed.push('assistant-prose')}]};
  const card={querySelectorAll:()=>[{remove:()=>removed.push('prompt')},{remove:()=>removed.push('references')}],closest:()=>content};
  const ctx={};vm.createContext(ctx);vm.runInContext(source('cleanChatImageResponse'),ctx);ctx.cleanChatImageResponse(card);
  assert.deepEqual(removed,['prompt','references','assistant-prose']);
  assert.ok(source('createChatImageResultCard').includes('cleanChatImageResponse(card)'));
  assert.ok(source('renderChatImageCardResult').includes('cleanChatImageResponse(card)'));
  assert.ok(!source('submitChatImageGeneration').includes('task-original-prompt'));
});
test('initial video hydration and replay use the same media-aware display',async()=>{
  const ctx=context();let html='';
  Object.assign(ctx,{getTaskRegenerationSnapshot:async()=>({request:{operation:'video',prompt:'PRIVATE VIDEO PROMPT'},refMediaList:[{tag:'@图1'}]})});
  vm.runInContext(source('hydrateTaskReferencePrompt'),ctx);
  await ctx.hydrateTaskReferencePrompt({isConnected:true,querySelector:()=>null,insertAdjacentHTML:(_,s)=>html=s},{mediaType:'video'});
  assert.ok(!html.includes('PRIVATE VIDEO PROMPT'));
  assert.ok(html.includes('GALLERY:@图1'));
  assert.ok(app.includes('renderTaskReferenceDetails(request.prompt, snapshot.refMediaList, request.operation)'));
});
