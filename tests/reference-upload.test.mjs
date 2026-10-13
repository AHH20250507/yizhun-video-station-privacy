import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function source(name){const start=app.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0);const rest=app.slice(start);const end=rest.slice(1).search(/\n\s*(?:async )?function /);return end<0?rest:rest.slice(0,end+1);}
function context(){const ctx={};vm.createContext(ctx);vm.runInContext(app.match(/const MAX_CHAT_REFERENCE_FILE_BYTES[\s\S]*?(?=\n\s*async function handleChatMediaSelect)/)[0],ctx);return ctx;}
test('rejected files show the error at the upload control instead of silent toast rejection',async()=>{
 const c=context();const calls=[];Object.assign(c,{state:{chatRefMediaList:[]},el:{chatUploadMediaLabel:{textContent:'上传参考媒体'},chatMediaInput:{}},showToast(){},renderChatRefMediaList(){},getChatGenerationMode:()=> 'video',apiUploadMedia:async()=>calls.push('upload'),console,alert(){}});
 vm.runInContext(source('handleChatMediaSelect'),c);
 assert.equal(await c.handleChatMediaSelect({target:{files:[{name:'too-large.mp4',type:'video/mp4',size:101*1024*1024}]}}),0);
 assert.match(c.el.chatUploadMediaLabel.textContent,/100|过大/);assert.equal(calls.length,0);
});
test('actual 61067187-byte reference MP4 passes file validation',()=>{assert.equal(context().validateChatReferenceFile({type:'video/mp4',size:61067187,name:'reference.mp4'}),'');});
test('video and audio accept 100 MiB while images retain 50 MiB cap',()=>{const c=context();for(const type of ['video/mp4','audio/wav']){assert.equal(c.validateChatReferenceFile({type,size:100*1024*1024}),'');assert.match(c.validateChatReferenceFile({type,size:100*1024*1024+1}),/100/);}assert.match(c.validateChatReferenceFile({type:'image/png',size:50*1024*1024+1}),/50/);});
