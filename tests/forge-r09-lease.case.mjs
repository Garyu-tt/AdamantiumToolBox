import {strict as assert} from 'node:assert';
import {planLeases} from '../apps/forge/access.mjs';
export const revisions={graph_revision:'graph-20',policy_revision:'policy-20',
 identity_revision:'id-20',ui_revision:'ui-20'};
const at='2026-11-19T01:00:00.000Z';
const g=(ref,decision,until)=>({capability_ref:ref,lease_ref:'lease-'+ref,
 decision,valid_from:'2026-11-19T00:00:00.000Z',valid_until:until,
 policy_revision:revisions.policy_revision,identity_revision:revisions.identity_revision});
const mount=(id,requires,status='active')=>({mount_ref:'demo.'+id,
 function_ref:'demo.inspect',action_id:'demo.invoke',requires,
 status,verified:true,published:true});
export const leaseRequest={schema:'forge.access.lease.request.v1',
 request_id:'request-lease-1',principal_ref:'principal-demo',client_ref:'demo.client',
 renew_before_seconds:60,snapshot:{schema:'forge.access.lease.snapshot.v1',
  principal_ref:'principal-demo',client_ref:'demo.client',snapshot_ref:'snapshot-lease-1',
  ...revisions,observed_at:at,grants:[
   g('demo.read','allow','2026-11-19T01:00:45.000Z'),
   g('demo.write','allow','2026-11-19T01:00:00.000Z'),
   g('demo.admin','deny','2026-11-19T04:00:00.000Z'),
   g('demo.safe','allow','2026-11-19T05:00:00.000Z')],
  mounts:[mount('read',['demo.read']),mount('write',['demo.read','demo.write']),
   mount('admin',['demo.admin']),mount('unknown',['demo.unknown']),
   mount('safe',['demo.safe'])]}};
export function testLease(){
 const r=planLeases(leaseRequest);
 assert.equal(r.ok,true,JSON.stringify(r.issues));
 assert.equal(r.revocation_candidates.length,3);
 assert.equal(r.renewal_candidates.length,1);
 assert.deepEqual(r.retain_candidates.map(x=>x.mount_ref),['demo.read','demo.safe']);
 assert(r.revocation_candidates.find(x=>x.mount_ref==='demo.write').reason_codes.includes('LEASE_EXPIRED'));
 assert(r.revocation_candidates.find(x=>x.mount_ref==='demo.admin').reason_codes.includes('EXPLICIT_DENY'));
 assert(r.revocation_candidates.find(x=>x.mount_ref==='demo.unknown').reason_codes.includes('MISSING_GRANT'));
 assert(r.steps.every(s=>s.executable===false&&s.authorized===false));
 for(const k of ['authoritative','authorized','executed','can_execute','access_revoked'])
  assert.equal(r[k],false,k);
 const clone=()=>structuredClone(leaseRequest);
 let p=clone();p.snapshot.grants.push(p.snapshot.grants[0]);
 assert.equal(planLeases(p).ok,false,'duplicate grant');
 p=clone();p.snapshot.mounts.push(p.snapshot.mounts[0]);
 assert.equal(planLeases(p).ok,false,'duplicate mount');
 p=clone();p.snapshot.grants[0].policy_revision='policy-stale';
 assert.equal(planLeases(p).ok,false,'mismatched policy epoch');
 p=clone();p.snapshot.observed_at='suspicious-clock';
 assert.equal(planLeases(p).ok,false,'invalid external clock');
 p=clone();p.snapshot.grants[0].valid_until=p.snapshot.grants[0].valid_from;
 assert.equal(planLeases(p).ok,false,'invalid lease interval');
 p=clone();p.snapshot.client_ref='other.client';
 assert.equal(planLeases(p).ok,false,'wrong client scope');
 p=clone();p.renew_before_seconds=90000;
 assert.equal(planLeases(p).ok,false,'unbounded horizon');
 p=clone();p.snapshot.mounts=[mount('inactive',['demo.safe'],'disabled')];
 assert.equal(planLeases(p).revocation_candidates.length,1);
}
