import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const text=fs.readFileSync(new URL('../standalone-client.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
function fn(name){const start=text.indexOf('  function '+name+'(');assert.ok(start>=0);const rest=text.slice(start);return rest.slice(0,rest.indexOf('\n  }')+4);}
function ctx(){const c={};vm.createContext(c);for(const n of ['normalizeResolutionValues','extractDiscoveredModelMetadata','normalizeModelMetadata'])vm.runInContext(fn(n),c);return c;}
test('model discovery preserves image sizes independently of resolution tiers without raw metadata',()=>{const c=ctx();const m=c.extractDiscoveredModelMetadata({resolutions:['1K','4K'],supported_sizes:['1024x1024'],capabilities:{image_sizes:['2048x2048']},metadata:{sizes:[{width:4096,height:4096}]},secret:'not-allowed'});assert.deepEqual(Array.from(m.resolutions),['1K','4K']);assert.deepEqual(Array.from(m.sizes),['1024x1024','2048x2048','4096x4096']);assert.equal(m.secret,undefined);});
test('quality capabilities survive discovery and config normalization without retaining raw fields',()=>{const c=ctx();const discovered=c.extractDiscoveredModelMetadata({supported_qualities:['low','high'],capabilities:{qualities:['medium']},metadata:{supportedQualities:['hd']},privatePayload:{secret:'not-allowed'}});assert.deepEqual(Array.from(discovered.qualities),['low','high','medium','hd']);const config=c.normalizeModelMetadata({model:discovered});assert.deepEqual(Array.from(config.model.qualities),['low','high','medium','hd']);assert.equal(config.model.privatePayload,undefined);});
test('safe provider metadata normalizes sizes on configuration roundtrip',()=>{const c=ctx();const m=c.normalizeModelMetadata({model:{sizes:['1024x1024','2048x2048'],resolutions:['2K','4K'],raw:{token:'not-allowed'}}});assert.deepEqual(Array.from(m.model.sizes),['1024x1024','2048x2048']);assert.equal(m.model.raw,undefined);});
