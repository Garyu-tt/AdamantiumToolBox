import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {environment,key} from './interop-fixture.mjs';
import {invoke} from './fixture.mjs';
test('real source -> mutually authenticated TLS -> independent Witness: actual approval rows', {timeout:60000},async()=>{
 const f=await environment();try{const {req}=await f.grant();
  const p=await invoke(f.sourcePort,key,'network_checkpoint.preview');
  assert.equal(p.status,200,JSON.stringify(p.data));assert.equal(p.data.result.nextBatch,1);
  const a=await invoke(f.sourcePort,key,'network_checkpoint.deliver');
  assert.equal(a.status,200,JSON.stringify(a.data));assert.equal(a.data.result.state,'delivered_verified',JSON.stringify(a.data));
  assert.equal(a.data.result.ledgerSeq,1);
  const receipts=await invoke(f.witnessPort,key,'network_witness.receipts');
  assert.equal(receipts.data.result.receipts.length,1);
  assert(!((await readFile(f.f.witnessLog,'utf8')).includes('"principal":"operator"')),'events stored at witness');
  const again=await invoke(f.sourcePort,key,'network_checkpoint.deliver');assert.equal(again.status,200,JSON.stringify(again.data));assert.equal(again.data.result.state,'in_sync');
  await f.endorse(req);await f.revoke(req);
  const b=await invoke(f.sourcePort,key,'network_checkpoint.deliver');
  assert.equal(b.data.result.state,'delivered_verified',JSON.stringify(b.data));assert.equal(b.data.result.ledgerSeq,3);
  assert.equal((await invoke(f.witnessPort,key,'network_witness.receipts')).data.result.receipts.length,2);
  const raw=await readFile(f.f.ledgerPath,'utf8');await writeFile(f.f.ledgerPath,raw.split('\n').slice(0,1).join('\n')+'\n');
  const rollback=await invoke(f.sourcePort,key,'network_checkpoint.preview');
  assert.equal(rollback.data.result.state,'rollback_detected');
  const denied=await invoke(f.sourcePort,key,'network_checkpoint.deliver');assert.equal(denied.status,400);
  assert.equal((await invoke(f.witnessPort,key,'network_witness.receipts')).data.result.receipts.length,2);
 }finally{await f.stop();}
});

