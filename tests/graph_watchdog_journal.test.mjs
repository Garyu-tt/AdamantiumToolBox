import {strict as assert} from 'node:assert';
import {makeJournalEvent,inspectJournal} from '../apps/rollback_watchdog/journal.mjs';
const leaseId='lease-1',planDigest='a'.repeat(64);
const ctx={leaseId,planDigest};
const event=(seq,state,kind,atSeconds,prev)=>makeJournalEvent(
 {...ctx,seq,state},prev,kind,atSeconds);
const armed=event(1,'draft','armed',100);
const staged=event(2,'armed','staged',110,armed.hash);
const probe=event(3,'staged','probe_passed',120,staged.hash);
const confirm=event(4,'observed','operator_confirmed',125,probe.hash);
const input={schema:'rollback-watchdog-journal-1',leaseId,planDigest,
 deadlineSeconds:160,events:[armed,staged,probe,confirm]};
const valid=inspectJournal(input,{nowSeconds:200});
assert.equal(valid.state,'confirmed');
assert.equal(valid.chainConsistent,true);
assert.equal(valid.journalIntegrityVerified,false);
assert.equal(valid.writerAuthenticated,false);
assert.equal(valid.readyToApply,false);
assert.equal(valid.rollbackCompleted,false);
assert.deepEqual(valid,inspectJournal(input,{nowSeconds:200}));
const tampered=inspectJournal({...input,events:[armed,{...staged,atSeconds:115},probe,confirm]},
 {nowSeconds:200});
assert.equal(tampered.chainConsistent,false);
assert(tampered.issues.some(x=>x.code==='journal_integrity_failure'));
const duplicated=inspectJournal({...input,events:[armed,{...staged,seq:1}]},{nowSeconds:200});
assert(duplicated.issues.some(x=>x.code==='journal_integrity_failure'));
const expired=inspectJournal({...input,events:[armed,staged]},{nowSeconds:200});
assert.equal(expired.state,'staged');
assert.equal(expired.requiresRecovery,true);
assert(expired.issues.some(x=>x.code==='rollback_overdue'));
assert.equal(expired.rollbackCompleted,false);
const rollback=event(3,'staged','rollback_requested',130,staged.hash);
const restored=event(4,'rollback_pending','rollback_verified',135,rollback.hash);
const complete=inspectJournal({...input,events:[armed,staged,rollback,restored]},
 {nowSeconds:200});
assert.equal(complete.rollbackClaimed,true);
assert.equal(complete.rollbackCompleted,false);
assert.equal(complete.requiresRecovery,true);
assert.equal(complete.kernelReadbackVerified,false);
const late=event(4,'observed','operator_confirmed',170,probe.hash);
const rejected=inspectJournal({...input,events:[armed,staged,probe,late]},{nowSeconds:200});
assert(rejected.issues.some(x=>x.code==='invalid_transition'));
assert.throws(()=>inspectJournal({...input,deadlineSeconds:-1}),/invalid_journal/);
console.log('GRAPH_WATCHDOG_JOURNAL_OK chain, deadline, tampering, unverified rollback');
