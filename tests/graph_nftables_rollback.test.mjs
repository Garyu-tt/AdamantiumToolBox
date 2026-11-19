import {strict as assert} from 'node:assert';
import {simulateRollbackTrial} from '../apps/nftables_lab/trial.mjs';
const events=[
 {kind:'syntax_validated',atMs:0},{kind:'arm_rollback',atMs:10},
 {kind:'commit_simulated',atMs:20},{kind:'management_probe_ok',atMs:30}];
const expired=simulateRollbackTrial({deadlineMs:100,advanceToMs:150,events});
assert.equal(expired.state,'rolled_back');
assert.equal(expired.rollbackSimulated,true);
assert.equal(expired.kernelChanged,false);
assert.equal(expired.privilegedOperations,0);
assert.equal(expired.watchdogArmedLive,false);
assert(expired.journal.some(x=>x.event==='timeout_rollback'));
const confirmed=simulateRollbackTrial({deadlineMs:100,advanceToMs:150,
 events:[...events,{kind:'operator_confirmed',atMs:80}]});
assert.equal(confirmed.state,'confirmed');
assert.equal(confirmed.confirmedInProduction,false);
assert.equal(confirmed.rollbackSimulated,false);
const denied=simulateRollbackTrial({deadlineMs:100,advanceToMs:150,
 events:[...events.slice(0,3),{kind:'management_probe_failed',atMs:40}]});
assert.equal(denied.state,'rolled_back');
assert(denied.journal.some(x=>x.cause==='management_probe_failed'));
const wrongOrder=simulateRollbackTrial({deadlineMs:100,advanceToMs:20,
 events:[{kind:'commit_simulated',atMs:10}]});
assert.equal(wrongOrder.state,'blocked');
assert.match(wrongOrder.reason,/invalid_transition/);
const late=simulateRollbackTrial({deadlineMs:100,advanceToMs:150,
 events:[...events.slice(0,2),{kind:'commit_simulated',atMs:120}]});
assert.equal(late.state,'blocked');
assert.equal(late.reason,'deadline_before_commit');
assert.throws(()=>simulateRollbackTrial({deadlineMs:100,advanceToMs:50,
 events:[{kind:'arm_rollback',atMs:60}]}),/invalid_event/);
assert.deepEqual(expired,simulateRollbackTrial({deadlineMs:100,advanceToMs:150,events}));
console.log('NFTABLES_ROLLBACK_TRIAL_OK deterministic expiry/confirm/denial, simulation only');
