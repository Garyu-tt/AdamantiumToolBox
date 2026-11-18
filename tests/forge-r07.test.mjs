import {strict as assert} from 'node:assert';
import {planReactive,assessReactive} from '../apps/forge/reactive.mjs';
import {runAssessmentR07} from './forge-r07-assess.case.mjs';
import {runHttpR07} from './forge-r07-http.case.mjs';
const cursor={stream_id:'host-events',sequence:12,graph_revision:'g-12',
 ui_revision:'ui-8',policy_revision:'policy-7'};
const event=(id,sequence,kind,fn,base,rev,mount,action)=>({
 schema:'forge.reactive.event.v1',id,sequence,kind,function_ref:fn,
 base_revision:base,graph_revision:rev,capability_revision:'cap-'+sequence,
 policy_revision:cursor.policy_revision,transaction_ref:'transaction-88',
 receipt_ref:'receipt-'+sequence,action_id:action,ui_mount_refs:mount});
const e1=event('event-a',13,'publication.committed','sample.create','g-12','g-13',
 ['ui.create_button'],'sample.create');
const e2=event('event-b',14,'capability.revoked','sample.legacy','g-13','g-14',
 ['ui.legacy_button']);
const request={schema:'forge.reactive.request.v1',request_id:'batch-request-88',
 stream_id:cursor.stream_id,cursor,events:[e1,e2]};
const plan=planReactive(request);
assert.equal(plan.ok,true,JSON.stringify(plan.issues));
assert.equal(plan.schema,'forge.reactive.plan.v1');
assert.equal(plan.changes.length,2);
assert.equal(plan.proposed_cursor.sequence,14);
assert.equal(plan.proposed_cursor.graph_revision,'g-14');
assert.deepEqual(plan.changes.map(x=>x.desired_state),['visible','hidden']);
assert(plan.steps.every(x=>x.executable===false&&x.authorized===false));
for(const flag of ['authoritative','authorized','executed','ui_updated','cursor_committed','can_execute'])
 assert.equal(plan[flag],false,flag);
assert.equal(planReactive(request).changes.length,2);
const issueCheck=r=>assert((r.issues||[]).every(x=>x.code&&x.reason&&
 x.evidence?.path&&x.impact&&x.remedies?.length));
const rejects=(rq,code)=>{const r=planReactive(rq);assert.equal(r.ok,false,code);
 assert(r.issues.some(x=>x.code===code),JSON.stringify(r.issues));issueCheck(r);return r;};
rejects({...request,events:[e2]},'EVENT_GAP');
rejects({...request,events:[e1,{...e2,base_revision:'g-8'}]},'REVISION_FORK');
rejects({...request,events:[e1,{...e2,policy_revision:'policy-8'}]},'POLICY_CHANGED');
rejects({...request,events:[e1,{...e2,id:'event-a'}]},'DUPLICATE_EVENT_OR_TARGET');
rejects({...request,events:[e1,{...e2,function_ref:e1.function_ref}]},'DUPLICATE_EVENT_OR_TARGET');
rejects({...request,events:[e1,{...e2,ui_mount_refs:e1.ui_mount_refs}]},'MOUNT_CONFLICT');
rejects({...request,events:[{...e1,receipt_ref:null}]},'BAD_EVENT');
rejects({...request,events:[{...e1,action_id:null}]},'BAD_EVENT');
rejects({...request,events:[{...e1,ui_mount_refs:['ui.create_button','ui.create_button']}]},'DUPLICATE_MOUNT');
const refresh=event('event-refresh',13,'ui.mount.changed','sample.create',
 'g-12','g-13',['ui.create_button'],'sample.create');
rejects({...request,events:[refresh]},'BAD_EVENT');
assert.equal(planReactive({...request,events:[{...refresh,desired_state:'visible'}]}).ok,true);
assert.equal(planReactive({...request,events:[{...refresh,desired_state:'hidden'}]}).ok,true);
const headless=planReactive({...request,events:[{...e1,ui_mount_refs:[]}]});
assert.equal(headless.ok,true);
const invalid=assessReactive({schema:'forge.reactive.assess.request.v1'});
assert.equal(invalid.ok,false);issueCheck(invalid);
await runAssessmentR07({request,plan,headless,issueCheck,assessReactive});
await runHttpR07({request,plan});
console.log('FORGE_R07_TEST_OK: reactive plans, gaps, CAS, receipts, UI and isolated MAS HTTP');
