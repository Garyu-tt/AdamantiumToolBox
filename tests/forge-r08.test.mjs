import {strict as assert} from 'node:assert';
import {planProjection,planReconnect} from '../apps/forge/projection.mjs';
import {testReconnect} from './forge-r08-reconnect.case.mjs';
import {testHttp} from './forge-r08-http.case.mjs';
const revisions={graph_revision:'graph-10',policy_revision:'policy-10',
 capability_revision:'cap-10',ui_revision:'ui-10',identity_revision:'id-10'};
const spec=(mount,action,required)=>({mount_ref:mount,function_ref:'sample.inspect',
 action_id:action,requires:required,status:'active',verified:true,published:true});
const snapshot={schema:'forge.projection.snapshot.v1',client_ref:'sample.client',
 principal_ref:'sample-principal',snapshot_ref:'snapshot-10',...revisions,
 grants:[{capability_ref:'sample.read',decision:'allow',policy_revision:'policy-10'},
 {capability_ref:'sample.write',decision:'deny',policy_revision:'policy-10'}],
 revoked:[],contributions:[spec('sample.mount','sample.inspect',['sample.read']),
 spec('sample.secret','sample.inspect_secret',['sample.write'])]};
const request={schema:'forge.projection.request.v1',request_id:'r08-sample-1',
 client_ref:'sample.client',principal_ref:'sample-principal',snapshot};
const result=planProjection(request);
assert.equal(result.ok,true,JSON.stringify(result.issues));
assert.equal(result.schema,'forge.projection.plan.v1');
assert.deepEqual(result.contributions.map(x=>x.mount_ref),['sample.mount']);
assert.equal(result.suppressed_counts.denied,1);
assert.equal(JSON.stringify(result).includes('sample.secret'),false);
assert(result.steps.every(s=>s.executable===false&&s.authorized===false));
for(const k of ['authoritative','authorized','executed','ui_updated','can_execute',
 'projection_applied','principal_authenticated'])assert.equal(result[k],false,k);
const noRights=planProjection({...request,snapshot:{...snapshot,grants:[]}});
assert.equal(noRights.ok,true);assert.equal(noRights.contributions.length,0);
const revoked=planProjection({...request,snapshot:{...snapshot,revoked:['sample.read']}});
assert.equal(revoked.ok,true);assert.equal(revoked.suppressed_counts.revoked,1);
const unseen=planProjection({...request,snapshot:{...snapshot,contributions:[
 {...snapshot.contributions[0],verified:false}]}});
assert.equal(unseen.ok,true);assert.equal(unseen.contributions.length,0);
const broken=planProjection({...request,snapshot:{...snapshot,grants:[
 ...snapshot.grants,snapshot.grants[0]]}});
assert.equal(broken.ok,false);assert(broken.issues[0].remedies.length);
const malformed=planProjection({...request,snapshot:{...snapshot,contributions:[
 snapshot.contributions[0],snapshot.contributions[0]]}});
assert.equal(malformed.ok,false);
assert.equal(planProjection({...request,snapshot:{...snapshot,client_ref:'other.client'}}).ok,false);
assert.equal(planProjection({...request,snapshot:{...snapshot,revoked:['sample.read','sample.read']}}).ok,false);
assert.equal(planProjection({...request,snapshot:{...snapshot,contributions:[
 {...snapshot.contributions[0],requires:[]}]}}).ok,false);
await testReconnect({planReconnect});await testHttp({request});
console.log('FORGE_R08_TEST_OK: scoped permission/revocation, session recovery, standalone HTTP');
