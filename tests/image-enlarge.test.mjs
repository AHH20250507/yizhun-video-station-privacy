import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function fn(name){const i=app.indexOf('function '+name+'(');assert.ok(i>=0,`missing ${name}`);const rest=app.slice(i);return rest.slice(0,rest.indexOf('\n}')+2);}
test('double click on generated result opens the loaded image even inside stopped bubbling containers', () => {
  let handler, capture;
  const opened = [];
  const ctx = { document: { addEventListener(type, cb, opt) { if (type === 'dblclick') { handler = cb; capture = opt; } } },
    openGeneratedImagePreview: (...args) => opened.push(args) };
  vm.createContext(ctx);
  vm.runInContext(fn('initGeneratedImagePreview'), ctx);
  ctx.initGeneratedImagePreview();
  const partial = '.chat-image-job-card.is-completed .chat-image-job-visual img';
  const image = { currentSrc: 'https://example.com/result.png', alt: '第二张', naturalWidth: 0 };
  let prevented = 0;
  const click = selector => handler({ target: { closest: selectors => selectors.split(', ').includes(selector) ? image : null },
    preventDefault: () => prevented++, stopPropagation() {} });
  click(partial);
  assert.deepEqual(opened, []);
  image.naturalWidth = 256;
  click(partial);
  click('.chat-image-result-grid img.task-image-preview');
  assert.equal(capture, true);
  assert.deepEqual(opened, [[image.currentSrc, image.alt], [image.currentSrc, image.alt]]);
  assert.equal(prevented, 2);
});
test('preview dialog reuses one modal and releases its image when closed',()=>{const handlers={};let appended=0;const image={removeAttribute:()=>{image.src='';}};const title={};const button={addEventListener:(t,h)=>handlers.button=h};const dialog={open:false,setAttribute(){},querySelector:s=>s==='img'?image:s==='strong'?title:button,addEventListener:(t,h)=>handlers[t]=h,showModal(){this.open=true;},close(){this.open=false;handlers.close();}};const ctx={safeMediaUrl:s=>s,document:{getElementById:()=>appended?dialog:null,createElement:()=>dialog,body:{appendChild:()=>appended++}}};vm.createContext(ctx);vm.runInContext(fn('openGeneratedImagePreview'),ctx);assert.equal(ctx.openGeneratedImagePreview('https://example.com/one.png','one'),true);assert.equal(image.src,'https://example.com/one.png');ctx.openGeneratedImagePreview('https://example.com/two.png','two');assert.equal(appended,1);assert.equal(title.textContent,'two');handlers.button();assert.equal(dialog.open,false);assert.equal(image.src,'');});
test('a delayed close event cannot clear a newly reopened image',()=>{let appended=false;const handlers={};const image={src:'',removeAttribute(){this.src='';}};const button={addEventListener(){}};const dialog={open:false,setAttribute(){},querySelector:s=>s==='img'?image:s==='strong'?{}:button,addEventListener:(t,h)=>handlers[t]=h,showModal(){this.open=true;}};const c={safeMediaUrl:s=>s,document:{getElementById:()=>appended?dialog:null,createElement:()=>dialog,body:{appendChild:()=>appended=true}}};vm.createContext(c);vm.runInContext(fn('openGeneratedImagePreview'),c);c.openGeneratedImagePreview('https://example.com/old.png');dialog.open=false;c.openGeneratedImagePreview('https://example.com/new.png');handlers.close();assert.equal(image.src,'https://example.com/new.png');});
test('unsafe source never creates an image preview',()=>{let creates=0;const ctx={safeMediaUrl:()=>'',document:{createElement(){creates++;}}};vm.createContext(ctx);vm.runInContext(fn('openGeneratedImagePreview'),ctx);assert.equal(ctx.openGeneratedImagePreview('javascript:alert(1)'),false);assert.equal(creates,0);});
