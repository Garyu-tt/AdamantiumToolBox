import {strict as assert} from 'node:assert';
import {withForgeHost} from './forge-http-common.mjs';
import {planRequest,assessmentRequest} from './forge-r10-fixtures.mjs';
export async function testHttp(){
 await withForgeHost('forge-r10-internal-secret-is-long-enough',async query=>{
  const graph=await (await query('/graph')).json();
  assert(graph.nodes.some(x=>x.id==='forge.remediation.plan'));
  assert(graph.nodes.some(x=>x.id==='forge.remediation.assess'));
  const desc=await (await query('/invoke',{action:'forge.describe'})).json();
  assert.equal(desc.result.schema,'mechanicus.forge.adapter.v10');
  assert.equal(desc.result.adapter_actions.length,23);
  const p=await (await query('/invoke',{action:'forge.remediation.plan',params:planRequest})).json();
  assert.equal(p.result.ok,true);assert.equal(p.result.safe_candidates.length,1);
  const a=await (await query('/invoke',{action:'forge.remediation.assess',params:assessmentRequest})).json();
  assert.equal(a.result.evidence_consistent,true);assert.equal(a.result.cleared,false);
  const u=await query('/invoke',{action:'forge.remediation.plan',params:planRequest},false);
  assert.equal(u.status,401);
 });
}
