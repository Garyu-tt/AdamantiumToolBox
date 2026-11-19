import {strict as assert} from 'node:assert';
import {withForgeHost} from './forge-http-common.mjs';
export async function runHttpR04({call,request}){
 await withForgeHost('forge-r04-test-secret-key-long',async query=>{

 let ready=false;
 for(let i=0;i<40;i++){
  try{if((await query('/health')).ok){ready=true;break;}}catch{}
  await new Promise(done=>setTimeout(done,50));
 }
 assert(ready,'R04 isolated Forge must launch');
 const g=await (await query('/graph')).json();
 assert(g.nodes.some(x=>x.id==='forge.integration.prepare'));
 assert(g.nodes.some(x=>x.id==='forge.visibility.assess'));
 const p=await (await query('/invoke',{action:'forge.integration.prepare',params:call})).json();
 assert.equal(p.result.ok,true);assert.equal(p.result.provider_bound,false);
 const v=await (await query('/invoke',{action:'forge.visibility.assess',params:request})).json();
 assert.equal(v.result.structurally_consistent,true);assert.equal(v.result.ui_visible,false);
 assert.equal((await query('/invoke',{action:'forge.visibility.assess',params:request},false)).status,401);
 const desc=await (await query('/invoke',{action:'forge.describe'})).json();
 assert.equal(desc.result.schema,'mechanicus.forge.adapter.v10');
 assert.equal(desc.result.stores_state,false);assert.equal(desc.result.external_effects,false);
 console.log('FORGE_R04_TEST_OK: dispatch intent, revision/policy coherence, publish/revoke receipts, fail-closed HTTP');
 });
}
