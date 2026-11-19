import {strict as assert} from 'node:assert';
import {withForgeHost} from './forge-http-common.mjs';
export async function runHttpR05({request,changed}){
 await withForgeHost('forge-r05-test-secret-key-long',async query=>{

 let ready=false;
 for(let i=0;i<40;i++){try{if((await query('/health')).ok){ready=true;break;}}catch{}
  await new Promise(done=>setTimeout(done,50));}
 assert(ready,'Forge-alone service must launch');
 const graph=await (await query('/graph')).json();
 assert(graph.nodes.some(x=>x.id==='forge.composite.plan'));
 assert(graph.nodes.some(x=>x.id==='forge.composite.impact'));
 const cp=await (await query('/invoke',{action:'forge.composite.plan',params:request})).json();
 assert.equal(cp.result.ok,true);assert.equal(cp.result.topology.reused_function_mounts,1);
 const ci=await (await query('/invoke',{action:'forge.composite.impact',params:changed})).json();
 assert.equal(ci.result.ok,true);assert.equal(ci.result.ui_revoked,false);
 assert.equal((await query('/invoke',{action:'forge.composite.plan',params:request},false)).status,401);
 const info=await (await query('/invoke',{action:'forge.describe'})).json();
 assert.equal(info.result.schema,'mechanicus.forge.adapter.v11');
 assert.equal(info.result.stores_state,false);assert.equal(info.result.external_effects,false);
 console.log('FORGE_R05_TEST_OK: recursive/shared function composition, cycle rejection, reverse impact, fail-closed HTTP');
 });
}
