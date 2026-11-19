import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {environment,key} from './interop-fixture.mjs';
import {invoke} from './fixture.mjs';
import {compareCache,readCache} from '../lib/cache.mjs';

test('local independent witness receipt detects remote rollback or equal-sequence fork',{timeout:60000},async()=>{
 const f=await environment();try{await f.grant();
  const result=await invoke(f.sourcePort,key,'network_checkpoint.deliver');
  assert.equal(result.data.result.state,'delivered_verified',JSON.stringify(result));
  const cfg=JSON.parse(await readFile(f.sourceConfig,'utf8'));
  const c=await readCache(cfg.source.receiptPath,cfg.witness);
  assert.equal(c.seq,1);
  assert.throws(()=>compareCache(c,{ledgerSeq:0,ledgerHead:'0'.repeat(64)}),/witness_rollback_detected/);
  assert.throws(()=>compareCache(c,{ledgerSeq:1,ledgerHead:'f'.repeat(64)}),/witness_fork_detected/);
  const persisted=JSON.parse(await readFile(cfg.source.receiptPath,'utf8'));
  persisted.result.receipt.ledgerHead='f'.repeat(64);
  await writeFile(cfg.source.receiptPath,JSON.stringify(persisted)+'\n');
  const observed=await invoke(f.sourcePort,key,'network_checkpoint.preview');
  assert.equal(observed.status,400);
  assert.match(observed.data.error,/invalid_witness_receipt|invalid_witness_signature/);
 }finally{await f.stop();}
});

test('mutual TLS is necessary but insufficient: forged source proof never anchors',{timeout:60000},async()=>{
 const f=await environment();try{await f.grant();
  const config=JSON.parse(await readFile(f.sourceConfig,'utf8'));
  const {client}=await import('../lib/tls.mjs');
  const tls=await client(config);
  const state=await tls.get();
  const row=JSON.parse((await readFile(f.f.ledgerPath,'utf8')).trim());
  const checkpoint={schema:'network-approval-checkpoint-v1',journalId:'approval',keyId:'approval-key',
    seq:1,head:row.hash,at:new Date().toISOString()};
  const bad={schema:'network-checkpoint-transfer-v1',checkpoint,signature:Buffer.alloc(64).toString('base64'),
    segment:[row],expectedRevision:state.witnessRevision};
  await assert.rejects(()=>tls.post(bad),/witness_400/);
  assert.equal((await invoke(f.witnessPort,key,'network_witness.receipts')).data.result.receipts.length,0);
 }finally{await f.stop();}
});
