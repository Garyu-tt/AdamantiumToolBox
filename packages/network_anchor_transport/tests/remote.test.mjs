import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import https from 'node:https';
import {fixture as anchorFixture} from '../../network_anchor/tests/fixture.mjs';
import {ORIGIN} from '../lib/anchor-contract.mjs';
import {free,tlsFixture,spawnService,stop,invoke,config} from './fixture.mjs';
import {client} from '../lib/mtls.mjs';
const repo=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const anchorSvc=join(repo,'packages/network_anchor/service.mjs');
const transportSvc=join(repo,'packages/network_anchor_transport/service.mjs');
const credential='test-independent-anchor-relay-key-long';
async function environment(count=1){
 const f=await anchorFixture(),tls=await tlsFixture();let anchor,receiver,sender;
 const anchorPort=await free(),receiverPort=await free(),senderPort=await free();
 const witnessLog=join(f.home,'witness.jsonl'),senderConfig=join(f.home,'sender.json'),receiverConfig=join(f.home,'receiver.json');
 let previous=ORIGIN;const rows=[];
 for(let i=0;i<count;i++){const item=f.next();rows.push({seq:i+1,previous,record:item.receipt,
  signature:item.signature,hash:item.witnessRevision});previous=item.witnessRevision;}
 try{
  await writeFile(witnessLog,rows.map(r=>JSON.stringify(r)).join('\n')+(rows.length?'\n':''),{mode:0o600});
  anchor=await spawnService(anchorSvc,anchorPort,{ADA_INTERNAL_KEY:credential,
   ADA_CAPS:'network_anchor.read,network_anchor.write',NETWORK_ANCHOR_LOG:f.logPath,
   NETWORK_ANCHOR_TRUST:f.trustPath,NETWORK_ANCHOR_KEY:f.keyPath});
  await config(receiverConfig,{schema:'network-anchor-transport-config-v1',mode:'receiver',trustFile:f.trustPath,
   receiver:{listenHost:'127.0.0.1',listenPort:receiverPort,serverCertFile:tls.serverCert,
    serverKeyFile:tls.serverKey,caFile:tls.ca,clientSpkiSha256:tls.clientPin,
    localAnchorUrl:'http://127.0.0.1:'+anchorPort+'/'}});
  receiver=await spawnService(transportSvc,await free(),{ADA_INTERNAL_KEY:credential,
   ADA_CAPS:'network_anchor_transport.read,network_anchor_transport.receive,network_anchor.read,network_anchor.write',
   NETWORK_ANCHOR_TRANSPORT_CONFIG:receiverConfig});
  await config(senderConfig,{schema:'network-anchor-transport-config-v1',mode:'sender',trustFile:f.trustPath,
   sender:{witnessLog,proofCache:join(f.home,'receipt-cache.json'),url:'https://localhost:'+receiverPort+'/',
    caFile:tls.ca,clientCertFile:tls.clientCert,clientKeyFile:tls.clientKey,
    serverSpkiSha256:tls.serverPin}});
  sender=await spawnService(transportSvc,senderPort,{ADA_INTERNAL_KEY:credential,
   ADA_CAPS:'network_anchor_transport.read,network_anchor_transport.send',NETWORK_ANCHOR_TRANSPORT_CONFIG:senderConfig});
  return {f,tls,rows,witnessLog,senderConfig,receiverConfig,anchorPort,receiverPort,senderPort,
   stop:async()=>{await Promise.all([stop(sender),stop(receiver),stop(anchor)]);await tls.remove();await f.remove();}};
 }catch(e){await Promise.all([stop(sender),stop(receiver),stop(anchor)]);await tls.remove();await f.remove();throw e;}
}

test('real mTLS Witness -> independent Anchor, bounded batches, independent receipt and source rollback',{timeout:90000},async()=>{
 const f=await environment(20);
 try{
  const p=await invoke(f.senderPort,credential,'network_anchor_transport.preview');
  assert.equal(p.status,200,JSON.stringify(p.body));assert.equal(p.body.result.nextBatch,16);
  const a=await invoke(f.senderPort,credential,'network_anchor_transport.deliver');
  assert.equal(a.status,200,JSON.stringify(a.body));assert.equal(a.body.result.state,'delivered_verified');
  assert.equal(a.body.result.witnessSeq,16);
  const b=await invoke(f.senderPort,credential,'network_anchor_transport.deliver');
  assert.equal(b.status,200,JSON.stringify(b.body));assert.equal(b.body.result.witnessSeq,20);
  const status=await invoke(f.anchorPort,credential,'network_anchor.status');
  assert.equal(status.body.result.witnessSeq,20);assert.equal(status.body.result.count,2);
  const synced=await invoke(f.senderPort,credential,'network_anchor_transport.deliver');
  assert.equal(synced.body.result.state,'in_sync');
  const log=await readFile(f.f.logPath,'utf8');assert(!log.includes('privateKey'));
  await writeFile(f.witnessLog,JSON.stringify(f.rows[0])+'\n');
  const rollback=await invoke(f.senderPort,credential,'network_anchor_transport.preview');
  assert.equal(rollback.body.result.state,'witness_rollback_detected');
  assert.equal((await invoke(f.senderPort,credential,'network_anchor_transport.deliver')).status,400);
 }finally{await f.stop();}
});

test('forged target identity and missing TLS client identity fail closed',{timeout:90000},async()=>{
 const f=await environment(1);
 try{
  const configFile=JSON.parse(await readFile(f.senderConfig,'utf8'));
  configFile.sender.serverSpkiSha256='f'.repeat(64);
  const clientWithWrongPin=await client(configFile);
  await assert.rejects(clientWithWrongPin.get(),/remote_spki_mismatch/);
  const ca=await readFile(f.tls.ca);
  const res=new Promise((yes,no)=>{const req=https.get('https://localhost:'+f.receiverPort+'/state',
   {ca,minVersion:'TLSv1.3'},yes);req.on('error',no);});
  await assert.rejects(res,/certificate|alert|handshake|socket|tls/i);
  const denied=await invoke(f.senderPort,credential,'network_anchor_transport.apply');
  assert.equal(denied.status,403);
  assert.equal((await fetch('http://127.0.0.1:'+f.senderPort+'/graph')).status,401);
 }finally{await f.stop();}
});
