import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function source(name) { const start = app.search(new RegExp('(?:async )?function ' + name + '\\(')); assert.ok(start >= 0, `missing ${name}`); const indent = app.slice(app.lastIndexOf('\n', start) + 1, start); const rest = app.slice(start); return rest.slice(0, rest.indexOf('\n' + indent + '}') + indent.length + 2); }
function context(metadata = {}, mode = 'creation') {
  const c = { state: { serverModels: [{mode, operation: 'image', model: 'model', metadata}], apiConfig: {imageModel:'model'} }, el: {}, document: {getElementById:()=>null} };
  vm.createContext(c);
  for (const name of ['getServerModels', 'getPreferredServerModel', 'getImageCapabilityDescription', 'getImageResolutionOptions', 'getImageQualityOptions', 'getImageGenerationSelection']) vm.runInContext(source(name), c);
  return c;
}
test('explicit pixel sizes use largest area only within the current aspect ratio', () => {
  const c = context({sizes:['8192x8192', '1920x1080', '3840x2160', '1080x1920']});
  assert.equal(c.getImageGenerationSelection('creation', 'model', '16:9').size, '3840x2160');
  assert.equal(c.getImageGenerationSelection('creation', 'model', '9:16').size, '1080x1920');
  assert.equal(c.getImageGenerationSelection('creation', 'model', '4:3').size, undefined);
  assert.equal(c.getImageGenerationSelection('creation', 'model', '16:9', '8192x8192').size, '3840x2160');
});
test('unknown capability labels are selectable but not claimed as highest; missing metadata sends auto', () => {
  const c = context({sizes:['ultra', 'HD']});
  assert.equal(c.getImageGenerationSelection('creation', 'model', '1:1').resolution, undefined);
  assert.equal(c.getImageGenerationSelection('creation', 'model', '1:1', 'ultra').resolution, 'ultra');
  assert.equal(context().getImageGenerationSelection('creation', 'model', '16:9').size, undefined);
  assert.equal(context({sizes:['1K','4K','2K']}).getImageGenerationSelection('creation', 'model', '16:9').resolution, '4K');
});
test('creation model switch defaults highest but rerender and mode toggles preserve a manual lower tier', () => {
  const c = context({resolutions:['1K','4K']});
  c.state.serverModels.push({mode:'creation', operation:'image', model:'other', metadata:{resolutions:['2K','8K']}});
  const select = {value:'',dataset:{},innerHTML:''};
  c.document.getElementById = id => id === 'chatImageResolutionSelect' ? select : null;
  c.escapeHTML = String;
  vm.runInContext(source('syncChatImageResolutionControl'), c);
  c.syncChatImageResolutionControl('model', '1:1');
  assert.equal(select.value, '4K');
  select.value = '1K';
  c.syncChatImageResolutionControl('model', '1:1');
  assert.equal(select.value, '1K');
  c.syncChatImageResolutionControl('other', '1:1');
  assert.equal(select.value, '8K');
});
test('image request sends captured tier and aspect without fabricated pixel sizes', async () => {
  const c = context({resolutions:['1K','4K']}, 'canvas');
  const requests=[];
  Object.assign(c, {BackendClient:{createGeneration:async r=>{requests.push(r);return {task:{id:'t'}};},waitForGeneration:async t=>({...t,output:{}})}, extractImageSourcesFromOutput:()=>['https://example.test/image.png'],clampImageCount:v=>v});
  vm.runInContext(source('apiGenerateCanvasImage'), c);
  await c.apiGenerateCanvasImage('prompt', [], {mode:'canvas',model:'model',resolution:'1K',aspectRatio:'16:9'});
  assert.equal(requests[0].input.resolution, '1K');
  assert.equal(requests[0].input.aspect_ratio, '16:9');
  assert.equal(requests[0].input.size, undefined);
});
test('creation captures model and resolution before the first await and passes that snapshot to submission', () => {
  const submit = source('handleAiChatSubmit');
  assert.ok(submit.indexOf('const imageSelection =') > 0);
  assert.ok(submit.indexOf('const imageSelection =') < submit.indexOf('await '));
  assert.match(submit, /submitChatImageGeneration\([^\n]+imageSelection\)/);
  const generation = source('submitChatImageGeneration');
  assert.doesNotMatch(generation, /getChatImageSize/);
  assert.match(generation, /resolution[\s\S]*aspectRatio/);
  assert.match(generation, /createChatImageResultCard\([^\n]+imageSelection\)/);
});
test('image card uses captured resolution rather than current composer or guessed dimensions', () => {
  const c = context();
  let card;
  c.document.createElement=()=>card={innerHTML:''};
  Object.assign(c,{escapeHTML:String, cleanChatImageResponse:()=>{},renderChatImageBatchProgress:()=>{}});
  vm.runInContext(source('createChatImageResultCard'),c);
  c.createChatImageResultCard({appendChild(){}},'t','p','model','16:9',1,{resolution:'4K'});
  assert.match(card.innerHTML,/4K/);
  assert.doesNotMatch(card.innerHTML,/1280x720/);
});
test('canvas render keeps manual tier, resets on model switch and separates aspect from resolution', () => {
  const c = context({resolutions:['1K','4K']}, 'canvas');
  c.state.serverModels.push({mode:'canvas',operation:'image',model:'other',metadata:{resolutions:['2K','8K']}});
  Object.assign(c,{escapeHTML:String});
  for(const n of ['getCanvasImageSelection','renderCanvasImageControls']) vm.runInContext(source(n),c);
  const node={id:'node',model:'model'};
  c.renderCanvasImageControls(node,false);
  assert.equal(node.imageResolution,'4K');
  node.imageResolution='1K';
  c.renderCanvasImageControls(node,false);
  assert.equal(node.imageResolution,'1K');
  node.model='other';
  assert.match(c.renderCanvasImageControls(node,false),/图片比例/);
  assert.equal(node.imageResolution,'8K');
  const run=source('runCanvasImageGeneration');
  assert.ok(run.indexOf('const imageSelection =') < run.indexOf('await '));
  assert.match(run,/apiGenerateCanvasImage\([\s\S]*\.\.\.imageSelection/);
});
test('creation markup exposes separate ratio and resolution controls with touch-friendly styles', () => {
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.match(html,/id="chatImageResolutionSelect"/);
  assert.match(html,/for="chatImageResolutionSelect"[^>]*>分辨率/);
  assert.doesNotMatch(html,/图片尺寸<\/label>/);
  assert.match(css,/\.image-resolution-select[\s\S]*min-height:\s*40px/);
});
test('restored cards and exact regeneration display original resolution, never current selection', () => {
  assert.match(source('jumpToTaskInChat'), /createChatImageResultCard\([^\n]+historyTask\.options/);
  assert.match(source('regenerateGenerationTask'), /createChatImageResultCard\([^\n]+request\.input\)/);
});
test('capabilities arriving after initial empty catalog select highest while explicit auto remains auto', () => {
  const c=context();
  const select={value:'',dataset:{},innerHTML:''};
  c.document.getElementById=id=>id==='chatImageResolutionSelect'?select:null;
  c.escapeHTML=String;
  vm.runInContext(source('syncChatImageResolutionControl'),c);
  c.syncChatImageResolutionControl('model','1:1');
  c.state.serverModels[0].metadata={resolutions:['1K','4K']};
  c.syncChatImageResolutionControl('model','1:1');
  assert.equal(select.value,'4K');
  select.value='';
  select.onchange();
  assert.equal(c.syncChatImageResolutionControl('model','1:1').resolution,undefined);
  assert.equal(select.value,'');
});
test('canvas change handler applies low tier and preserves it across redraws without persistence keys', () => {
  const c=context({resolutions:['1K','4K']},'canvas');
  const node={id:'node',type:'asset',model:'model'};
  Object.assign(c,{canvasState:{nodes:[node]},saveCanvasState:()=>{},renderCanvasNodesAndLines:()=>{}});
  for(const n of ['getCanvasImageSelection','updateCanvasImageControl'])vm.runInContext(source(n),c);
  c.getCanvasImageSelection(node);
  c.updateCanvasImageControl('node','resolution','1K');
  assert.equal(c.getCanvasImageSelection(node).resolution,'1K');
  c.updateCanvasImageControl('node','aspectRatio','16:9');
  assert.equal(c.getCanvasImageSelection(node).resolution,'1K');
});
test('canvas capabilities arriving after empty metadata select highest until user explicitly chooses auto', () => {
  const c=context({},'canvas');
  const node={id:'node',type:'asset',model:'model'};
  Object.assign(c,{canvasState:{nodes:[node]},saveCanvasState:()=>{},renderCanvasNodesAndLines:()=>{}});
  for(const n of ['getCanvasImageSelection','updateCanvasImageControl'])vm.runInContext(source(n),c);
  c.getCanvasImageSelection(node);
  c.state.serverModels[0].metadata={resolutions:['1K','4K']};
  assert.equal(c.getCanvasImageSelection(node).resolution,'4K');
  c.updateCanvasImageControl('node','resolution','');
  assert.equal(c.getCanvasImageSelection(node).resolution,undefined);
});
test('backend restoration retains captured resolution and direct provider aspect_ratio', () => {
  const c=context();
  Object.assign(c,{extractImageSourcesFromOutput:()=>[],clone:v=>structuredClone(v)});
  // The recovery function is nested but has no dependency on its enclosing session state.
  vm.runInContext(source('frontendImageTaskFromBackend'),c);
  const task=c.frontendImageTaskFromBackend({id:'t',input:{resolution:'4K',aspect_ratio:'16:9'},createdAt:Date.now()}, {id:'session'});
  assert.equal(task.options.resolution,'4K');
  assert.equal(task.options.aspectRatio,'16:9');
});
test('image quality uses only declared semantic tiers and preserves original supplier enum independently of resolution', () => {
  const c=context({resolutions:['1K','4K'],qualities:['low','STANDARD','HD','medium']});
  vm.runInContext(source('getImageQualityOptions'),c);
  const highest=c.getImageGenerationSelection('creation','model','16:9');
  assert.equal(highest.quality,'HD');
  assert.equal(highest.resolution,'4K');
  const custom=c.getImageGenerationSelection('creation','model','16:9','1K','STANDARD');
  assert.equal(custom.quality,'STANDARD');
  assert.equal(custom.resolution,'1K');
  assert.equal(context({qualities:['ultra','cinematic']}).getImageGenerationSelection('creation','model','1:1').quality,undefined);
  assert.equal(context().getImageGenerationSelection('creation','model','1:1').quality,undefined);
});
test('creation quality select defaults highest and manual quality survives resolution edits and rerender', () => {
  const c=context({resolutions:['1K','4K'],qualities:['low','high']});
  const resolution={value:'',dataset:{},innerHTML:''}, quality={value:'',dataset:{},innerHTML:''};
  c.document.getElementById=id=>({chatImageResolutionSelect:resolution,chatImageQualitySelect:quality})[id];
  c.escapeHTML=String;
  vm.runInContext(source('syncChatImageResolutionControl'),c);
  assert.equal(c.syncChatImageResolutionControl('model','1:1').quality,'high');
  assert.equal(quality.value,'high');
  quality.value='low';
  resolution.value='1K';
  assert.equal(c.syncChatImageResolutionControl('model','1:1').quality,'low');
  assert.equal(resolution.value,'1K');
  quality.value='';quality.onchange();
  assert.equal(c.syncChatImageResolutionControl('model','1:1').quality,undefined);
});
test('canvas quality is independent of resolution auto and lower selections survive redraws', () => {
  const c=context({resolutions:['1K','4K'],qualities:['low','high']},'canvas');
  const node={id:'node',type:'asset',model:'model'};
  Object.assign(c,{canvasState:{nodes:[node]},saveCanvasState:()=>{},renderCanvasNodesAndLines:()=>{}});
  for(const n of ['getCanvasImageSelection','updateCanvasImageControl'])vm.runInContext(source(n),c);
  assert.equal(c.getCanvasImageSelection(node).quality,'high');
  c.updateCanvasImageControl('node','quality','low');
  c.updateCanvasImageControl('node','resolution','');
  const selected=c.getCanvasImageSelection(node);
  assert.equal(selected.quality,'low');
  assert.equal(selected.resolution,undefined);
  c.updateCanvasImageControl('node','quality','');
  assert.equal(c.getCanvasImageSelection(node).quality,undefined);
});
test('quality travels through real request and captured card output', async () => {
  const c=context({},'canvas'), requests=[];
  Object.assign(c,{BackendClient:{createGeneration:async r=>{requests.push(r);return {task:{id:'t'}};},waitForGeneration:async t=>({...t,output:{}})},extractImageSourcesFromOutput:()=>['https://example.test/img.png'],clampImageCount:v=>v});
  vm.runInContext(source('apiGenerateCanvasImage'),c);
  await c.apiGenerateCanvasImage('p',[],{mode:'canvas',model:'model',resolution:'2K',quality:'HD',aspectRatio:'1:1'});
  assert.equal(requests[0].input.quality,'HD');
  assert.equal(requests[0].input.resolution,'2K');
  let card;c.document.createElement=()=>card={innerHTML:''};
  Object.assign(c,{escapeHTML:String,cleanChatImageResponse:()=>{},renderChatImageBatchProgress:()=>{}});
  vm.runInContext(source('createChatImageResultCard'),c);
  c.createChatImageResultCard({appendChild(){}},'t','p','model','1:1',1,{resolution:'2K',quality:'HD'});
  assert.match(card.innerHTML,/品质: HD/);
  assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/id="chatImageQualitySelect"/);
  assert.match(source('renderCanvasImageControls'),/图片品质/);
});
test('creation resolution and quality roundtrip in page-memory settings',()=>{const c=context({resolutions:['1K','4K'],qualities:['low','high']});const nodes={chatImageResolutionSelect:{value:'1K',dataset:{model:'model',explicitAuto:'false'}},chatImageQualitySelect:{value:'low',dataset:{model:'model',explicitAuto:'false'}}};c.document.getElementById=id=>nodes[id];c.escapeHTML=String;for(const n of ['captureChatImageSettings','restoreChatImageSettings','syncChatImageResolutionControl'])vm.runInContext(source(n),c);const saved=c.captureChatImageSettings();nodes.chatImageResolutionSelect.value='4K';nodes.chatImageQualitySelect.value='high';c.restoreChatImageSettings('model','1:1',saved);assert.equal(nodes.chatImageResolutionSelect.value,'1K');assert.equal(nodes.chatImageQualitySelect.value,'low');});
test('declared xhigh and max qualities rank above high without assuming undeclared values',()=>{const c=context({qualities:['high','max','xhigh','auto']});assert.equal(c.getImageGenerationSelection('creation','model','1:1').quality,'max');assert.equal(context({qualities:['high','xhigh']}).getImageGenerationSelection('creation','model','1:1').quality,'xhigh');});
test('official provenance is labeled distinctly from supplier capability and no-quality controls',()=>{const c=context();vm.runInContext(source('getImageCapabilityDescription'),c);assert.match(c.getImageCapabilityDescription({resolutionSource:'official-spec'},'resolution',false),/官方规格/);assert.match(c.getImageCapabilityDescription({qualitySource:'official-no-quality'},'quality',true),/不提供独立品质/);assert.match(c.getImageCapabilityDescription({},'quality',true),/能力未知/);assert.match(c.getImageCapabilityDescription({},'quality',false),/供应商/);});
test('declared resolution tiers default numerically highest and preserve provider value', () => {
  const c = context({resolutions:['2K', '10K', '4K', '1K']});
  const selected = c.getImageGenerationSelection('creation', 'model', '16:9');
  assert.equal(selected.resolution, '10K');
  assert.equal(selected.aspectRatio, '16:9');
  assert.equal(selected.size, undefined);
  assert.equal(c.getImageGenerationSelection('creation', 'model', '16:9', '2K').resolution, '2K');
});
