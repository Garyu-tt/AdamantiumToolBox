import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {connect} from 'node:net';
import {fileURLToPath} from 'node:url';
import {fixture as anchorFixture} from '../../network_anchor/tests/fixture.mjs';
import {tlsFixture,free,config,spawnService,stop,invoke} from './fixture.mjs';
const service=fileURLToPath(new URL('../service.mjs',import.meta.url));
const secret='test-anchor-transport-grant-boundary-long';

test('receiver without complete host grants does not bind an mTLS listener',{timeout:35000},async()=>{
 const f=await anchorFixture(),tls=await tlsFixture(),listenPort=await free(),appPort=await free();let child;
 try{
  const cfg=join(f.home,'missing-grants.json');
  await config(cfg,{schema:'network-anchor-transport-config-v1',mode:'receiver',trustFile:f.trustPath,
   receiver:{listenHost:'127.0.0.1',listenPort,serverCertFile:tls.serverCert,
    serverKeyFile:tls.serverKey,caFile:tls.ca,clientSpkiSha256:tls.clientPin,
    localAnchorUrl:'http://127.0.0.1:8911/'}});
  child=await spawnService(service,appPort,{ADA_INTERNAL_KEY:secret,ADA_CAPS:'network_anchor_transport.read',
   NETWORK_ANCHOR_TRANSPORT_CONFIG:cfg});
  const status=await invoke(appPort,secret,'network_anchor_transport.status');
  assert.equal(status.status,200);assert.equal(status.body.result.configured,false);
  assert.match(status.body.result.error,/receiver_permissions_missing/);
  await assert.rejects(new Promise((ok,no)=>{const sock=connect({host:'127.0.0.1',port:listenPort},()=>{
   sock.destroy();ok();});sock.on('error',no);}),/ECONNREFUSED/);
 }finally{await stop(child);await tls.remove();await f.remove();}
});
