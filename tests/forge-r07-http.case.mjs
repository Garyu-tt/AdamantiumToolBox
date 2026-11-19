import {strict as assert} from 'node:assert';
import {withForgeHost} from './forge-http-common.mjs';
export async function runHttpR07({request,plan}){
 await withForgeHost('forge-r07-secret-key-must-be-long',async query=>{
  const graph=await (await query('/graph')).json();
  assert(graph.nodes.some(x=>x.id==='forge.reactive.plan'));
  assert(graph.nodes.some(x=>x.id==='forge.reactive.assess'));
  const desc=await (await query('/invoke',{action:'forge.describe'})).json();
  assert.equal(desc.result.schema,'mechanicus.forge.adapter.v9');
  assert.equal(desc.result.stores_state,false);
  assert.equal(desc.result.external_effects,false);
  assert.equal(desc.result.adapter_actions.length,21);
  const result=await (await query('/invoke',{
   action:'forge.reactive.plan',params:request})).json();
  assert.deepEqual(result.result.changes,plan.changes);
  assert.equal(result.result.executed,false);
  const check=await (await query('/invoke',{action:'forge.reactive.assess',
   params:{schema:'forge.reactive.assess.request.v1',plan}})).json();
  assert.equal(check.result.ok,false);
  const unauthorized=await query('/invoke',{
   action:'forge.reactive.plan',params:request},false);
  assert.equal(unauthorized.status,401);
 });
}
