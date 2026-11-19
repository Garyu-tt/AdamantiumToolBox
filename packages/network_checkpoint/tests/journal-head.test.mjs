import test from 'node:test';
import assert from 'node:assert/strict';
import {stateFor} from '../lib/receiver.mjs';
import {environment,key} from './interop-fixture.mjs';
import {invoke} from './fixture.mjs';

test('receiver resolves exact current journal via independent Witness latest capability',{timeout:60000},async()=>{
 const f=await environment();
 const cfg={receiver:{localWitnessUrl:'http://127.0.0.1:'+f.witnessPort+'/',
  journalId:'approval',witnessId:'remote_witness'}};
 try{
  const genesis=await stateFor(cfg,key);
  assert.equal(genesis.ledgerSeq,0);
  assert.equal(genesis.latest,null);
  await f.grant();
  const posted=await invoke(f.sourcePort,key,'network_checkpoint.deliver');
  assert.equal(posted.data.result.state,'delivered_verified',JSON.stringify(posted.data));
  const head=await stateFor(cfg,key);
  assert.equal(head.ledgerSeq,1);
  assert.equal(head.latest.receipt.journalId,'approval');
  assert.equal(head.latest.witnessRevision,posted.data.result.witnessRevision);
  const api=await invoke(f.witnessPort,key,'network_witness.latest',{journalId:'approval'});
  assert.equal(api.status,200);
  assert.equal(api.data.result.schema,'network-witness-journal-head-v1');
  const denied=await invoke(f.witnessPort,key,'network_witness.latest',{journalId:'unknown'});
  assert.equal(denied.status,400);
  await assert.rejects(stateFor({receiver:{...cfg.receiver,journalId:'unknown'}},key),/witness_400/);
  await assert.rejects(stateFor({receiver:{...cfg.receiver,witnessId:'wrong'}},key),/invalid_witness_journal_head/);
 }finally{await f.stop();}
});
