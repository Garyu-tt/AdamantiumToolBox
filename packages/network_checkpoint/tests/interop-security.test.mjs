import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {environment,key} from './interop-fixture.mjs';
import {invoke} from './fixture.mjs';
import {message} from '../../network_approval/lib/contract.mjs';
test('source and receiver reject unknown API actions and unauthenticated calls', {timeout:60000},async()=>{
 const f=await environment();try{
  assert.equal((await fetch('http://127.0.0.1:'+f.sourcePort+'/graph')).status,401);
  assert.equal((await invoke(f.sourcePort,key,'network_checkpoint.apply')).status,403);
  assert.equal((await invoke(f.sourcePort,key,'network_checkpoint.status')).data.result.enforcement,false);
  const https=await import('node:https');const ca=await readFile(f.tls.caCert);
  await assert.rejects(()=>new Promise((done,fail)=>{const r=https.get('https://localhost:'+f.receiverPort+'/state',
   {ca,minVersion:'TLSv1.3'},done);r.on('error',fail);}),/certificate|alert|socket|tls|handshake/i);
 }finally{await f.stop();}
});

test('sender rejects a TLS server SPKI substitution even under a trusted CA', {timeout:60000},async()=>{
 const f=await environment();try{await f.grant();
  const {client}=await import('../lib/tls.mjs');const cfg=JSON.parse(await readFile(f.sourceConfig,'utf8'));
  cfg.witness.serverSpkiSha256='f'.repeat(64);
  const transport=await client(cfg);await assert.rejects(()=>transport.get(),/server_identity_mismatch/);
 }finally{await f.stop();}
});

test('bounded transport sends at most 32 ledger entries per signed checkpoint',{timeout:60000},async()=>{
 const f=await environment();try{
  for(let i=0;i<35;i++){
   const req={schema:'network-approval-request-v1',id:i.toString(16).padStart(32,'0'),revision:'rev1',
    flow:{source:'approval',destination:'destination',principal:'operator',protocol:'tcp',port:22},
    expiresAt:new Date(Date.now()+120000).toISOString()};
   const proof={side:'source',keyId:'approval-key',signature:(await import('node:crypto')).sign(null,
    message(req,'source'),f.f.source.privateKey).toString('base64')};
   await f.ledger.mutate({expectedRevision:f.ledger.head,event:{type:'propose',at:new Date().toISOString(),request:req,proof}});
  }
  const preview=await invoke(f.sourcePort,key,'network_checkpoint.preview');
  assert.equal(preview.data.result.nextBatch,32);
  const first=await invoke(f.sourcePort,key,'network_checkpoint.deliver');
  assert.equal(first.data.result.state,'delivered_verified',JSON.stringify(first.data));
  assert.equal(first.data.result.ledgerSeq,32);
  const second=await invoke(f.sourcePort,key,'network_checkpoint.deliver');
  assert.equal(second.data.result.state,'delivered_verified',JSON.stringify(second.data));
  assert.equal(second.data.result.ledgerSeq,35);
 }finally{await f.stop();}
});
