import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {checkpoint,signCheckpoint,verifyCheckpoint,verifyLedger,ORIGIN,sha,stateCheck} from '../lib/contract.mjs';
import {setup,pub,pem} from './fixture.mjs';
test('source checkpoint signed only with pinned independent Ed25519 identity',()=>{
 const a=generateKeyPairSync('ed25519'),b=generateKeyPairSync('ed25519');
 const c=checkpoint('approval','key',1,'a'.repeat(64),new Date().toISOString());
 const signed=signCheckpoint(c,pem(a),pub(a));assert(verifyCheckpoint(c,signed,pub(a)));
 assert(!verifyCheckpoint({...c,head:'b'.repeat(64)},signed,pub(a)));
 assert.throws(()=>signCheckpoint(c,pem(b),pub(a)),/source_signer_mismatch/);
});
test('journal chain rejects missing rows, corruption and truncation',()=>{
 const event={type:'propose',at:new Date().toISOString(),x:1};const row={seq:1,previous:ORIGIN,event};row.hash=sha(JSON.stringify({seq:1,previous:ORIGIN,event}));
 assert.equal(verifyLedger(JSON.stringify(row)+'\n').head,row.hash);
 assert.throws(()=>verifyLedger(JSON.stringify({...row,hash:'f'.repeat(64)})+'\n'),/journal_corrupt/);
 assert.throws(()=>verifyLedger(JSON.stringify(row)),/journal_incomplete/);
});
test('witness state rejects invented genesis, missing signed receipt and bad witness ID',()=>{
 const c={schema:'network-checkpoint-state-v1',witnessId:'remote_witness',journalId:'approval',
  witnessRevision:ORIGIN,ledgerHead:ORIGIN,ledgerSeq:0};const expected={witnessId:'remote_witness',journalId:'approval'};
 assert.equal(stateCheck(c,expected).ledgerSeq,0);
 assert.throws(()=>stateCheck({...c,ledgerSeq:5},expected),/invalid_remote_state|invalid_witness_receipt/);
 assert.throws(()=>stateCheck({...c,witnessId:'attacker'},expected),/invalid_remote_state/);
});
test('journal rejects a gap and modified event even when attacker adjusts the tip label',()=>{
 const e={type:'propose',at:new Date().toISOString(),request:{id:'x'}};
 const one={seq:1,previous:ORIGIN,event:e};one.hash=sha(JSON.stringify({seq:1,previous:ORIGIN,event:e}));
 const bad={seq:3,previous:one.hash,event:e};bad.hash=sha(JSON.stringify({seq:3,previous:one.hash,event:e}));
 assert.throws(()=>verifyLedger(JSON.stringify(one)+'\n'+JSON.stringify(bad)+'\n'),/journal_corrupt/);
 assert.throws(()=>verifyLedger(JSON.stringify({...one,event:{...e,modified:true}})+'\n'),/journal_corrupt/);
});
