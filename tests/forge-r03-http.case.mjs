import {strict as assert} from 'node:assert';
import {withForgeHost} from './forge-http-common.mjs';
export async function runHttpR03({flow,batch}){
 await withForgeHost('forge-r03-test-secret-key-long',async query=>{

 let active=false;
 for(let i=0;i<40;i++){
  try{if((await query('/health')).ok){active=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,50));
 }
 assert(active,'isolated core+Forge service must launch');
 const graph=await (await query('/graph')).json();
 assert(graph.nodes.some(n=>n.id==='forge.providers.negotiate'));
 assert(graph.nodes.some(n=>n.id==='forge.events.project'));
 const p=await (await query('/invoke',{action:'forge.providers.negotiate',params:flow})).json();
 assert.equal(p.result.complete,false);
 const e=await (await query('/invoke',{action:'forge.events.project',params:batch})).json();
 assert.equal(e.result.actions.length,3);
 assert.equal((await query('/invoke',{action:'forge.events.project',params:batch},false)).status,401);
 const desc=await (await query('/invoke',{action:'forge.describe'})).json();
 assert.equal(desc.result.schema,'mechanicus.forge.adapter.v6');
 assert.equal(desc.result.external_effects,false);assert.equal(desc.result.stores_state,false);
 console.log('FORGE_R03_TEST_OK: fail-closed negotiation, no silent write failover, strict event projection, standalone HTTP');
 });
}
