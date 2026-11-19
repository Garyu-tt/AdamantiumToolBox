import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateManifest} from '../core/contract.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const app=join(root,'apps','danteworld');
const manifest=JSON.parse(await readFile(join(app,'manifest.json'),'utf8'));
assert(validateManifest(manifest),'MAS manifest invalid');
const service=await readFile(join(app,'service.mjs'),'utf8');
const match=service.match(/const spec=(\{app:'danteworld'[\s\S]*?\});\nconst result=/);
assert(match,'manifest graph missing');
// Graph should be independently available through the read-only HTTP endpoint;
// source inspection here only checks package size and absence of external imports.
for(const path of ['service.mjs','view.js','engine.mjs']){
 const data=await readFile(join(app,path),'utf8');
 assert(data.split('\n').length<=120,path+' too many lines');
 assert(Buffer.byteLength(data)<=6144,path+' too many bytes');
}
assert(!service.includes('../../sdk/'),'app must be self-contained');
assert(service.includes("fixture:true"),'world provider must be visibly marked simulated');
console.log('DANTE_WORLD_PACKAGE_OK standalone manifest, source budgets, fixture provenance');
