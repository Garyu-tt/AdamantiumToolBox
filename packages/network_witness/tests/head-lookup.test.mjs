import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {fixture} from './fixture.mjs';
import {openWitness} from '../lib/store.mjs';
import {ORIGIN,SOURCE_SCHEMA,sourceBytes} from '../lib/contract.mjs';
const pub=k=>k.publicKey.export({format:'pem',type:'spki'}).toString();

test('addressed journal head survives >50 newer unrelated receipts', {timeout:30000},async()=>{
 const f=await fixture(),other=generateKeyPairSync('ed25519');let w;
 try{
  const trust=JSON.parse(await readFile(f.trustPath,'utf8'));
  trust.sources.other={id:'other',keyId:'other-key',publicKey:pub(other)};
  await writeFile(f.trustPath,JSON.stringify(trust),{mode:0o600});
  w=await openWitness({logPath:f.logPath,trustPath:f.trustPath,keyPath:f.keyPath});
  const first=await w.anchor({...f.segment(),expectedRevision:ORIGIN});
  let previous=ORIGIN;
  for(let i=1;i<=51;i++){
   const event={type:'propose',counter:i};
   const row={seq:i,previous,event};
   row.hash=createHash('sha256').update(JSON.stringify({seq:i,previous,event})).digest('hex');
   const checkpoint={schema:SOURCE_SCHEMA,journalId:'other',keyId:'other-key',
    seq:i,head:row.hash,at:new Date().toISOString()};
   const signature=sign(null,sourceBytes(checkpoint),other.privateKey).toString('base64');
   await w.anchor({checkpoint,signature,segment:[row],expectedRevision:w.head});
   previous=row.hash;
  }
  assert.equal(w.list(50).receipts.some(x=>x.receipt.journalId==='approval'),false);
  const head=w.headForJournal('approval');
  assert.equal(head.schema,'network-witness-journal-head-v1');
  assert.equal(head.witnessId,'auditor');
  assert.equal(head.revision,w.head);
  assert.equal(head.count,52);
  assert.equal(head.latest.receipt.ledgerSeq,1);
  assert.equal(head.latest.witnessRevision,first.witnessRevision);
  assert.equal(w.headForJournal('other').latest.receipt.ledgerSeq,51);
  assert.equal(w.headForJournal('approval').enforcement,false);
  assert.throws(()=>w.headForJournal('untrusted'),/untrusted_journal/);
  await w.close();w=null;
  w=await openWitness({logPath:f.logPath,trustPath:f.trustPath,keyPath:f.keyPath});
  assert.equal(w.headForJournal('approval').latest.witnessRevision,first.witnessRevision);
 }finally{await w?.close();await f.remove();}
});
