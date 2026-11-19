import {strict as assert} from 'node:assert';
import {planRemediation} from '../apps/forge/remediation.mjs';
import {planRequest} from './forge-r10-fixtures.mjs';
export function testPlan(){
 const run=()=>structuredClone(planRequest);
 let p=run(),r=planRemediation(p);
 assert.equal(r.ok,true,JSON.stringify(r.issues));
 assert.equal(r.safe_candidates.length,1);
 assert.equal(r.deferred_candidates.length,1);
 assert.equal(r.deferred_candidates[0].reason_codes[0],'requires-explicit-approval');
 assert(r.steps.every(x=>x.executable===false&&x.authorized===false));
 assert.equal(r.executed,false);assert.equal(r.cleared,false);
 assert.equal(r.safe_candidates[0].authorized,false);
 p=run();delete p.incident.cause.explanation;
 assert.equal(planRemediation(p).ok,false,'unexplained blocker rejected');
 p=run();p.incident.remedies.push({...p.incident.remedies[0]});
 assert.equal(planRemediation(p).ok,false,'duplicate remedy denied');
 p=run();p.snapshot.attempts[0].count=2;
 assert.equal(planRemediation(p).safe_candidates.length,0,'bounded retry budget');
 p=run();p.incident.remedies[0].reversible=false;
 assert.equal(planRemediation(p).safe_candidates.length,0,'no unsafe automation');
 p=run();p.incident.remedies[0].idempotency_key='';
 assert.equal(planRemediation(p).safe_candidates.length,0,'needs durable key');
 p=run();p.incident.remedies[0].acceptance_checks=[];
 assert.equal(planRemediation(p).safe_candidates.length,0,'needs independent checks');
 p=run();p.snapshot.providers[0].available=false;
 assert.equal(planRemediation(p).safe_candidates.length,0,'missing provider explained');
 p=run();p.snapshot.providers.push({...p.snapshot.providers[0]});
 assert.equal(planRemediation(p).ok,false,'duplicate provider rejected');
 p=run();p.snapshot.attempts=[];
 assert.equal(planRemediation(p).ok,false,'no attempt journal cannot mean zero');
 p=run();p.incident.remedies.push({...p.incident.remedies[0],
  remedy_ref:'demo.alternate_fix',idempotency_key:'another-durable-key'});
 p.snapshot.attempts.push({remedy_ref:'demo.alternate_fix',count:0});
 const two=planRemediation(p);
 assert.equal(two.safe_candidates.length,2);
 assert.equal(two.steps.filter(x=>x.port==='remediation.attempt.safe').length,1,
  'one deterministic attempt per external readback cycle');
 p=run();p.max_attempts=100;
 assert.equal(planRemediation(p).ok,false,'unbounded attempt disallowed');
}
