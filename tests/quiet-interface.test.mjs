import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function source(name){
  const start=app.search(new RegExp('(?:async )?function '+name+'\\('));
  assert.ok(start>=0,`missing ${name}`);
  const rest=app.slice(start); const end=rest.slice(1).search(/\n(?:async )?function /);
  return end<0?rest:rest.slice(0,end+1);
}
test('all corner toast types create no notification DOM or timer',()=>{
  let allocations=0,timers=0,actions=0;
  const node={querySelector:()=>({addEventListener(){}}),addEventListener(){},remove(){}};
  const ctx={document:{createElement:()=>{allocations++;return node;}},el:{toastContainer:{appendChild(){}}},escapeHTML:s=>s,setTimeout:()=>{timers++;},clearTimeout(){}};
  vm.createContext(ctx);vm.runInContext(source('showToast'),ctx);
  for(const type of ['success','error','warning','info'])ctx.showToast('corner notice',type,{actionLabel:'查看',onAction:()=>actions++});
  assert.equal(allocations,0);assert.equal(timers,0);assert.equal(actions,0);
});
test('conversation list consumes remaining sidebar height instead of a viewport cap',()=>{
  const css=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');
  const panel=css.match(/\.local-conversation-panel\s*\{([^}]*)\}/)[1];
  const list=css.match(/\.local-conversation-history\s*\{([^}]*)\}/)[1];
  assert.match(panel,/flex:\s*1 1 0/);assert.match(panel,/max-height:\s*none/);
  assert.match(list,/flex:\s*1 1 0/);assert.match(list,/min-height:\s*0/);assert.match(list,/overflow-y:\s*auto/);
});
function pollHarness(){
  let tick,polls=0,stops=0;const target={innerHTML:'',replaceChildren(){this.innerHTML='';}};
  const fill={style:{}},track={dataset:{},setAttribute(){}},label={};
  const card={querySelector:s=>s.startsWith('#chat-progress-')?fill:s==='[data-video-progress-track]'?track:s==='[data-video-progress-label]'?label:target};
  const task={taskId:'video',backendTaskId:'backend',progress:92,status:'in_progress'};
  const ctx={document:{getElementById:()=>card},CSS:{escape:s=>s},Date,console:{error(){},warn(){}},state:{activeTasks:[task]},SessionSystem:{hasPoller:()=>false,isTaskCanceled:()=>false,registerPoller(){},unregisterPoller(){},trackTask:async()=>{}},setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>stops++,apiPollVideo:async()=>{polls++;throw Error('本地任务不存在');},renderChatVideoProgressLabel:s=>s,escapeHTML:s=>s,showToast(){}};
  vm.createContext(ctx);vm.runInContext(source('startChatCardPoller'),ctx);ctx.startChatCardPoller('video',card,'original','mock');
  return {tick,target,task,track,counts:()=>({polls,stops})};
}
test('temporary polling errors remain silent while bounded recovery continues',async()=>{
  const h=pollHarness();
  for(let i=0;i<3;i++)await h.tick();
  assert.equal(h.target.innerHTML,'');
  assert.equal(h.task.status,'reconciling');assert.equal(h.track.dataset.status,'reconciling');
  assert.equal(h.counts().polls,3);assert.equal(h.counts().stops,0);
  for(let i=3;i<8;i++)await h.tick();
  assert.equal(h.counts().stops,1);assert.equal(h.task.status,'needs_review');
  assert.match(h.target.innerHTML,/任务状态确认失败/);
});
