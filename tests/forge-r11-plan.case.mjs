import {strict as assert} from 'node:assert';
import {auditIntegrity,planIntegrityReconciliation} from '../apps/forge/integrity.mjs';
import {clone} from './forge-r11-fixtures.mjs';
export function testPlan(){
 let p=clone();p.snapshot.capabilities[1].state='revoked';
 const audit=auditIntegrity(p);
 const planRequest={schema:'forge.integrity.plan.request.v1',
  request_id:'request-reconcile-11',audit};
 const r=planIntegrityReconciliation(planRequest);
 assert.equal(r.ok,true);assert(r.candidate_operations.length>0);
 assert(r.candidate_operations.some(x=>x.action.port==='ui.projection.invalidate'));
 assert(r.steps.every(x=>x.executable===false&&x.authorized===false));
 assert.equal(r.graph_mutated,false);assert.equal(r.ui_updated,false);
 const invalid=structuredClone(planRequest);
 invalid.audit.issues[0].code='UNRECOGNIZED_REMOTELY_EXECUTE';
 assert.equal(planIntegrityReconciliation(invalid).ok,false);
 const mismatch=structuredClone(planRequest);
 mismatch.audit.finding_count=0;
 assert.equal(planIntegrityReconciliation(mismatch).ok,false);
 const truncated=structuredClone(planRequest);
 truncated.audit.finding_count+=1;truncated.audit.findings_truncated=true;
 assert.equal(planIntegrityReconciliation(truncated).resnapshot_required,true);
 const empty=structuredClone(planRequest);
 empty.audit=auditIntegrity(clone());
 const res=planIntegrityReconciliation(empty);
 assert.equal(res.ok,true);assert.equal(res.candidate_operations.length,0);
 assert.equal(res.consistent,undefined);
}
