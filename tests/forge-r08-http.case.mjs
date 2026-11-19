import {strict as assert} from 'node:assert';
import {withForgeHost} from './forge-http-common.mjs';
export async function testHttp({request}){
 await withForgeHost('forge-r08-internal-secret-is-long-enough',async query=>{
  const graph=await (await query('/graph')).json();
  assert(graph.nodes.some(x=>x.id==='forge.projection.plan'));
  assert(graph.nodes.some(x=>x.id==='forge.projection.reconnect'));
  const desc=await (await query('/invoke',{action:'forge.describe'})).json();
  assert.equal(desc.result.schema,'mechanicus.forge.adapter.v8');
  assert.equal(desc.result.adapter_actions.length,19);
  assert.equal(desc.result.stores_state,false);
  const p=await (await query('/invoke',{action:'forge.projection.plan',params:request})).json();
  assert.equal(p.result.ok,true);assert.equal(p.result.can_execute,false);
  const r=await (await query('/invoke',{action:'forge.projection.reconnect',
   params:{schema:'forge.projection.reconnect.request.v1'}})).json();
  assert.equal(r.result.ok,false);
  const unauthorized=await query('/invoke',{action:'forge.projection.plan',params:request},false);
  assert.equal(unauthorized.status,401);
 });
}
