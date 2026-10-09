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
test('image task retains its original prompt display',()=>{
  assert.ok(context().renderTaskReferenceDetails('IMAGE PROMPT',[],'image').includes('PROMPT:IMAGE PROMPT'));
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
