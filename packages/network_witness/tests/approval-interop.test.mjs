import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {Journal} from '../../network_approval/lib/journal.mjs';
import {message} from '../../network_approval/lib/contract.mjs';
import {fixture} from './fixture.mjs';
import {openWitness} from '../lib/store.mjs';
import {ORIGIN,SOURCE_SCHEMA,sourceBytes} from '../lib/contract.mjs';

test('Witness anchors actual Approval Ledger rows, without requiring Ledger service',{timeout:20000},async()=>{
 const f=await fixture(),b=generateKeyPairSync('ed25519');let j,w;
 const pub=k=>k.publicKey.export({type:'spki',format:'pem'}).toString();
 try{
  const trust={schema:'network-approval-trust-v1',nodes:{
   approval:{keyId:'source-key',publicKey:pub(f.source)},beta:{keyId:'beta-key',publicKey:pub(b)}}};
  const path=join(f.home,'approval.jsonl');j=await new Journal(path,trust).start();
  const request={schema:'network-approval-request-v1',id:'ab'.repeat(16),revision:'rev1',
   flow:{source:'approval',destination:'beta',principal:'operator',protocol:'tcp',port:22},
   expiresAt:new Date(Date.now()+120000).toISOString()};
  const proof={side:'source',keyId:'source-key',signature:sign(null,message(request,'source'),f.source.privateKey).toString('base64')};
  await j.mutate({expectedRevision:ORIGIN,event:{type:'propose',at:new Date().toISOString(),request,proof}});
  const row=JSON.parse((await readFile(path,'utf8')).trim());
  const checkpoint={schema:SOURCE_SCHEMA,journalId:'approval',seq:row.seq,head:row.hash,
   keyId:'source-key',at:new Date().toISOString()};
  const signature=sign(null,sourceBytes(checkpoint),f.source.privateKey).toString('base64');
  w=await openWitness({logPath:f.logPath,keyPath:f.keyPath,trustPath:f.trustPath});
  const result=await w.anchor({checkpoint,signature,segment:[row],expectedRevision:ORIGIN});
  assert.equal(result.receipt.ledgerHead,j.head);
  assert.equal(w.inspect(checkpoint,signature).state,'matches_witness');
  assert(!(await readFile(f.logPath,'utf8')).includes('"principal":"operator"'));
 }finally{await Promise.all([j?.close(),w?.close()]);await f.remove();}
});
