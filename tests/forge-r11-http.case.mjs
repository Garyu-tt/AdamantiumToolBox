import {strict as assert} from 'node:assert';
import {withForgeHost} from './forge-http-common.mjs';
import {auditRequest,clone} from './forge-r11-fixtures.mjs';
export async function testHttp(){
 await withForgeHost('forge-r11-internal-secret-is-long-enough',async query=>{
  const graph=await (await query('/graph')).json();
  assert(graph.nodes.some(x=>x.id==='forge.integrity.audit'));
  assert(graph.nodes.some(x=>x.id==='forge.integrity.plan'));
  const d=await (await query('/invoke',{action:'forge.describe'})).json();
  assert.equal(d.result.schema,'mechanicus.forge.adapter.v11');
  assert.equal(d.result.adapter_actions.length,25);
  let p=clone();p.snapshot.mounts[0].capability_ref='demo.no_cap';
  const a=await (await query('/invoke',{action:'forge.integrity.audit',params:p})).json();
  assert.equal(a.result.ok,true);assert.equal(a.result.consistent,false);
  const plan=await (await query('/invoke',{action:'forge.integrity.plan',params:{
   schema:'forge.integrity.plan.request.v1',request_id:'integrity-plan-11',audit:a.result}})).json();
  assert.equal(plan.result.ok,true);
  assert.equal(plan.result.executed,false);
  const u=await query('/invoke',{action:'forge.integrity.audit',params:auditRequest},false);
  assert.equal(u.status,401);
 });
}
