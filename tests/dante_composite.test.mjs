import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectComposition,STAGES} from '../apps/dante/composition.js';
import {validateManifest,validateGraph} from '../core/contract.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const manifest=JSON.parse(await readFile(join(root,'apps/dante/manifest.json'),'utf8'));
assert(validateManifest(manifest));
const graph={app:'dante',version:1,nodes:[
 {id:'dante.view',type:'view',title:'Данте',icon:'dante',requires:['dante.read']},
 {id:'dante.status',type:'action',title:'Статус',requires:['dante.read']}
],edges:[{from:'dante.view',to:'dante.status',type:'uses'}]};
assert(validateGraph(graph,manifest));
const empty=inspectComposition({version:1,nodes:[]});
assert.equal(empty.discovered,false);assert.equal(empty.runnable,false);
assert(empty.stages.every(x=>x.status==='missing'));
const nodes=STAGES.map((stage,i)=>({id:`provider${i}.call`,contract:stage.contract,type:'action'}));
const composed=inspectComposition({nodes});
assert.equal(composed.stages.length,7);
assert.equal(composed.discovered,true);
assert.equal(composed.runnable,false);
assert(composed.stages.every(x=>x.providers.length===1));
const simulated=inspectComposition({nodes:nodes.map((n,i)=>i===0?{...n,fixture:true}:n)});
assert.equal(simulated.discovered,false);
assert.equal(simulated.stages[0].status,'fixture');
assert.equal(simulated.runnable,false);
const collided=inspectComposition({nodes:[...nodes,{...nodes[2],id:'other.call'}]});
assert.equal(collided.discovered,false);
assert.equal(collided.stages[2].status,'ambiguous');
assert.equal(inspectComposition({nodes:[{id:'x.run',type:'view',contract:STAGES[0].contract}]}).discovered,false);
assert.equal(inspectComposition(null).discovered,false);
console.log('DANTE_COMPOSITE_CONTRACT_OK roles=7 no_fake_genesis');
