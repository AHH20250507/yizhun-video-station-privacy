import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
function source(name){const start=app.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0,`missing ${name}`);const rest=app.slice(start);return rest.slice(0,rest.indexOf('\n}')+2);}
test('runtime progress changes skip full conversation capture but messages and results still save',()=>{const c={HTMLVideoElement:class{}};vm.createContext(c);vm.runInContext(source('isRuntimeChatMutation'),c);const target=runtime=>({closest:()=>runtime?{}:null});for(const type of ['childList','attributes','characterData'])assert.equal(c.isRuntimeChatMutation({type,target:target(true)}),true);assert.equal(c.isRuntimeChatMutation({type:'childList',target:target(false)}),false);assert.equal(c.isRuntimeChatMutation({type:'attributes',target:target(false),attributeName:'class'}),false);const video=new c.HTMLVideoElement();assert.equal(c.isRuntimeChatMutation({type:'attributes',target:video,attributeName:'preload'}),true);assert.ok(app.includes('records.every(isRuntimeChatMutation)'));});
test('image progress updates only changed rows, keeping completed thumbnails mounted', () => {
  let grid, gridWrites = 0;
  const rowWrites = [];
  const summary = {}, percent = {};
  const meter = { firstElementChild: { style: {} }, setAttribute(name, value) { this[name] = value; } };
  const target = {
    querySelector(selector) {
      return { '.chat-image-job-grid': grid, '.chat-image-batch-summary small': summary,
        '.chat-image-batch-summary b': percent, '.chat-image-batch-overall': meter }[selector];
    },
    set innerHTML(markup) {
      gridWrites++;
      assert.match(markup, /<img src="https:\/\/example\.com\/ready\.png"/);
      grid = { children: [0, 1].map(index => ({ set outerHTML(value) { rowWrites.push({ index, value }); } })) };
    }
  };
  const badge = {};
  const card = { querySelector: selector => selector.includes('badge') ? badge : target };
  const c = { clampImageCount: n => n, escapeHTML: String, extractImageSourcesFromOutput: output => [output.url],
    URL, window: { location: { href: 'https://example.com/' } } };
  vm.createContext(c);
  for (const name of ['getImageJobUiStatus', 'safeMediaUrl', 'renderChatImageBatchProgress']) vm.runInContext(source(name), c);
  const task = { taskId: 'batch', count: 2, status: 'running', imageJobProgress: [100, 42], providerJobs: [
    { index: 0, status: 'completed', output: { url: 'https://example.com/ready.png' } },
    { index: 1, status: 'running' }
  ] };
  c.renderChatImageBatchProgress(task, card);
  c.renderChatImageBatchProgress(task, card);
  assert.equal(gridWrites, 1);
  assert.deepEqual(rowWrites, []);
  task.imageJobProgress[1] = 44;
  c.renderChatImageBatchProgress(task, card);
  assert.equal(gridWrites, 1);
  assert.deepEqual(rowWrites.map(row => row.index), [1]);
  assert.equal(meter['aria-valuenow'], 72);
  assert.equal(meter.firstElementChild.style.width, '72%');
  task.status = 'canceled';
  task.imageJobProgress[1] = 46;
  c.renderChatImageBatchProgress(task, card);
  assert.equal(rowWrites.length, 1);
});
