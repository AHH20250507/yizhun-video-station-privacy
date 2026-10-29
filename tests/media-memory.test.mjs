import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
const clientSource=fs.readFileSync(new URL('../standalone-client.js',import.meta.url),'utf8');
const replaySource=fs.readFileSync(new URL('../task-regeneration.js',import.meta.url),'utf8');
async function harness(){
 class Storage{values=new Map();getItem(k){return this.values.get(k)||null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}}
 let objectUrls=0,reads=0;const records=new Map();
 const c={localStorage:new Storage(),navigator:{},document:{addEventListener(){}},console,Blob,FormData,DOMException,AbortController,structuredClone,crypto:{randomUUID},setTimeout,clearTimeout,atob,
 URL:class extends URL{static createObjectURL(b){const u=`blob:memory-${++objectUrls}`;records.set(u,b);return u;}static revokeObjectURL(u){records.delete(u);}},
 FileReader:class{readAsDataURL(){reads++;this.result='data:image/png;base64,'+'A'.repeat(1024*1024);this.onload();}},fetch:async(url,options)=>{if(records.has(String(url)))return {ok:true,blob:async()=>records.get(String(url))};c.lastRequest=options;return {ok:true,text:async()=>JSON.stringify(c.providerBody||{id:'provider-job',status:'running'})};}};
 c.window=c;vm.createContext(c);vm.runInContext(replaySource,c);vm.runInContext(clientSource,c);await c.privacyReady;
 return {c,client:c.StandaloneBackendClient,records,counts:()=>({objectUrls,reads})};
}
test('CSP permits page-local binary result reads without allowing insecure remote providers',()=>{const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');const connect=html.match(/connect-src ([^;]+)/)[1];assert.ok(connect.split(/\s+/).includes('blob:'));assert.ok(!connect.split(/\s+/).includes('http:'));});
test('inline fallback remains available only at submission and replay stays compact',async()=>{const h=await harness();h.client.saveConfig({video:{baseUrl:'https://provider.example.invalid',apiKey:'mock-only',model:'mock',models:['mock'],uploadPath:''}});const file=new Blob([new Uint8Array(1024)],{type:'image/png'});const upload=await h.client.uploadReferenceMedia(file);const result=await h.client.createGeneration({operation:'video',model:'mock',prompt:'@图1',input:{images:[upload.reference]},regenerationRefs:[{...upload,type:'image',tag:'@图1'}]});assert.equal(h.counts().reads,1);assert.ok(JSON.parse(h.c.lastRequest.body).images[0].startsWith('data:image/'));assert.ok(JSON.stringify(h.client.getRegenerationSnapshot(result.task.id)).length<2048);});
test('generated base64 images are converted to compact binary URLs before task cloning',async()=>{const h=await harness();h.client.saveConfig({image:{baseUrl:'https://provider.example.invalid',apiKey:'mock-only',model:'mock',models:['mock']}});h.c.providerBody={data:[{b64_json:'AAEC'.repeat(256*1024)}]};const result=await h.client.createGeneration({operation:'image',model:'mock',prompt:'test',input:{}});assert.equal(result.task.status,'completed');assert.ok(JSON.stringify(result.task).length<2048);const url=result.task.output.data[0].url;assert.equal(h.records.get(url).size,3*256*1024);});
for (const field of ['url', 'b64_json']) {
 for (const scheme of ['DATA', 'DaTa']) {
  test(`generated ${field} decodes legal ${scheme} Data URL scheme`, async () => {
   const h = await harness();
   h.client.saveConfig({image:{baseUrl:'https://provider.example.invalid',apiKey:'test-case-key'}});
   h.c.providerBody = {data:[{[field]:`${scheme}:image/png;base64,AQID`}]};
   const result = await h.client.createGeneration({operation:'image',model:'mock',prompt:'test',input:{}});
   assert.equal(result.task.status, 'completed', result.task.errorMessage);
   const output = result.task.output.data[0];
   assert.match(output.url, /^blob:/);
   const blob = h.records.get(output.url);
   assert.ok(blob instanceof Blob);
   assert.equal(blob.type, 'image/png');
   assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from([1, 2, 3]));
   if (field === 'b64_json') assert.ok(!Object.hasOwn(output, field));
   assert.ok(JSON.stringify(result.task).length < 2048);
  });
 }
}
for (const field of ['b64_json', 'base64', 'image_base64', 'url', 'image_url', 'imageUrl', 'result_url', 'resultUrl']) {
 for (const whitespace of ['leading newline', 'CRLF/space folding']) {
  test(`generated ${field} preserves bytes with legal Base64 ${whitespace}`, async () => {
   const h = await harness();
   h.client.saveConfig({image:{baseUrl:'https://provider.example.invalid',apiKey:'test-key'}});
   const expected = Buffer.from(Uint8Array.from({length:100001}, (_, i) => i % 251));
   const encoded = expected.toString('base64');
   const spaced = whitespace === 'leading newline'
    ? `\n${encoded}`
    : `\t\f${encoded.match(/.{1,77}/g).join('\r\n ')} \t\r\n\f`;
   // The whole input is legal; only slicing before stripping whitespace corrupts the boundaries.
   assert.deepEqual(Buffer.from(atob(spaced), 'binary'), expected);
   const base64Field = ['b64_json', 'base64', 'image_base64'].includes(field);
   const dataUrl = !base64Field || whitespace === 'CRLF/space folding';
   const chunks = [];
   h.c.atob = value => { chunks.push(value.length); return atob(value); };
   h.c.providerBody = {data:[{[field]:dataUrl ? `data:image/webp;base64,${spaced}` : spaced}]};
   const result = await h.client.createGeneration({operation:'image',model:'mock',prompt:'test',input:{}});
   assert.equal(result.task.status, 'completed');
   const output = result.task.output.data[0];
   const blob = h.records.get(output[base64Field ? 'url' : field]);
   assert.ok(blob instanceof Blob);
   assert.equal(blob.type, dataUrl ? 'image/webp' : 'image/png');
   assert.deepEqual(Buffer.from(await blob.arrayBuffer()), expected);
   if (base64Field) assert.ok(!Object.hasOwn(output, field));
   assert.ok(JSON.stringify(result.task).length < 2048);
   assert.ok(chunks.length > 1);
   assert.ok(chunks.every(length => length <= 65536));
  });
 }
}
test('binary generated image remains usable as downstream provider reference',async()=>{const h=await harness();h.client.saveConfig({video:{baseUrl:'https://provider.example.invalid',apiKey:'mock-only',model:'mock',models:['mock'],uploadPath:''}});const url=h.c.URL.createObjectURL(new Blob([new Uint8Array([0,1,2])],{type:'image/png'}));await h.client.createGeneration({operation:'video',model:'mock',prompt:'test',input:{images:[url]}});assert.ok(JSON.parse(h.c.lastRequest.body).images[0].startsWith('data:image/'));});
test('uploaded preview and replay use one short blob URL instead of copying file base64',async()=>{const h=await harness();const file=new Blob([new Uint8Array(4*1024*1024)],{type:'image/png'});file.name='reference.png';const upload=await h.client.uploadReferenceMedia(file);assert.match(upload.url,/^blob:/);assert.equal(h.counts().reads,0);assert.equal(await h.client.getReferencePreview(upload.reference),upload.url);assert.equal(await h.client.getReferencePreview(upload.reference),upload.url);assert.equal(h.counts().objectUrls,1);assert.equal((await h.client.fetchMediaBlob(upload.id)).size,file.size);const snap=h.c.TaskRegeneration.capture({operation:'video',model:'mock',prompt:'@图1',input:{images:[upload.reference]}},[{...upload,type:'image',tag:'@图1'}]);assert.ok(JSON.stringify(snap).length<2048);h.c.TaskRegeneration.validate(snap);});
