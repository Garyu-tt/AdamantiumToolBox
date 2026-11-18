import {strict as assert} from 'node:assert';
import {withForgeHost} from './forge-http-common.mjs';
export async function runHttpR06({input,baseRecovery}){
 await withForgeHost('forge-r06-test-secret-key-long',async query=>{

 let ready=false;
 for(let i=0;i<45;i++){try{if((await query('/health')).ok){ready=true;break;}}catch{}
  await new Promise(done=>setTimeout(done,50));}
 assert(ready,'Forge-alone service must start');
 const graph=await (await query('/graph')).json();
 assert(graph.nodes.some(x=>x.id==='forge.distribution.plan'));
 assert(graph.nodes.some(x=>x.id==='forge.distribution.recover'));
 const p=await (await query('/invoke',{action:'forge.distribution.plan',params:input})).json();
 assert.equal(p.result.complete,true);
 const r=await (await query('/invoke',{action:'forge.distribution.recover',params:baseRecovery})).json();
 assert.equal(r.result.ok,true);assert.equal(r.result.authoritative,false);
 assert.equal((await query('/invoke',{action:'forge.distribution.plan',params:input},false)).status,401);
 const desc=await (await query('/invoke',{action:'forge.describe'})).json();
 assert.equal(desc.result.schema,'mechanicus.forge.adapter.v6');
 assert.equal(desc.result.stores_state,false);assert.equal(desc.result.external_effects,false);
 console.log('FORGE_R06_TEST_OK: explicit distributed placement, partial recovery, negative/HTTP/permission checks');
 });
}
