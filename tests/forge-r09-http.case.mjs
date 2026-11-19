import {strict as assert} from 'node:assert';
import {withForgeHost} from './forge-http-common.mjs';
export async function testHttp({leaseRequest,revokeRequest}){
 await withForgeHost('forge-r09-internal-secret-is-long-enough',async query=>{
  const graph=await (await query('/graph')).json();
  assert(graph.nodes.some(x=>x.id==='forge.access.lease.plan'));
  assert(graph.nodes.some(x=>x.id==='forge.access.revocation.assess'));
  const desc=await (await query('/invoke',{action:'forge.describe'})).json();
  assert.equal(desc.result.schema,'mechanicus.forge.adapter.v11');
  assert.equal(desc.result.adapter_actions.length,25);
  assert.equal(desc.result.stores_state,false);
  const p=await (await query('/invoke',{action:'forge.access.lease.plan',params:leaseRequest})).json();
  assert.equal(p.result.ok,true);assert.equal(p.result.can_execute,false);
  const a=await (await query('/invoke',{action:'forge.access.revocation.assess',params:revokeRequest})).json();
  assert.equal(a.result.evidence_consistent,true);assert.equal(a.result.access_revoked,false);
  const unauthorized=await query('/invoke',{action:'forge.access.lease.plan',params:leaseRequest},false);
  assert.equal(unauthorized.status,401);
 });
}
