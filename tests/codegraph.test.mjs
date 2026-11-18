import {strict as assert} from 'node:assert';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const script=resolve(root,'tools','codemap_graph.py');
const run=(args)=>JSON.parse(execFileSync('python',[script,...args],{
 cwd:root,encoding:'utf8',maxBuffer:4*1024*1024,windowsHide:true}));
const graph=run(['graph']);
assert.equal(graph.schema,'mas-codegraph-1');
assert(graph.nodes.length>20);
assert(graph.edges.some(e=>e.from==='core/kernel.mjs'&&e.to==='core/catalog.mjs'));
assert(graph.edges.some(e=>e.from==='core/kernel.mjs'&&e.to==='core/semantic_api.mjs'));
const target=graph.nodes.find(n=>n.file==='core/catalog.mjs');
const context=run(['context','core/catalog.mjs',target.sha256]);
assert.equal(context.schema,'mas-context-pack-1');
assert(context.dependents.includes('core/kernel.mjs'));
assert(context.dependents.includes('core/background.mjs'));
assert(context.source.includes('export async function catalog'));
assert(context.contracts.some(c=>c.file==='core/kernel.mjs'));
let stale=false;
try{run(['context','core/catalog.mjs','0'.repeat(64)]);}
catch(e){stale=true;assert.equal(e.status,2);}
assert(stale);
console.log('CODEGRAPH_OK',graph.nodes.length,'files',graph.edges.length,'imports');
