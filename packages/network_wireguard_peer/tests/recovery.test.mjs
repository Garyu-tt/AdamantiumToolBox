import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {planRestore,applyRestore} from '../lib/recovery.mjs';
const key=()=>randomBytes(32).toString('base64');
const a=key(),b=key(),p={publicKey:a,allowedIP:'10.223.44.8/32'};
const options={interfaceName:'wg0',serverIP:'10.223.44.1'};
test('signed desired state only restores a missing peer without touching unknown peers',async()=>{
 let peers=[{publicKey:b,allowedIPs:['10.223.44.22/32']}],calls=[];
 const backend={state:async()=>peers};
 const preview=planRestore([p],peers,options);
 assert.equal(preview.missing.length,1);
 const result=await applyRestore({backend,plan:preview,recheck:{managed:[p],options},
  runner:async(args)=>{calls.push(args);peers=[...peers,{publicKey:p.publicKey,allowedIPs:[p.allowedIP]}]}});
 assert.equal(result.verified,true);
 assert.equal(result.restored,1);
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0],['set','wg0','peer',a,'allowed-ips','10.223.44.8/32']);
 assert.equal(peers.length,2);
 assert.equal(planRestore([p],peers,options).missing.length,0);
});
test('refuse duplicate, drift, unknown route overlaps and server conflicts',()=>{
 assert.throws(()=>planRestore([p,p],[],options),/duplicate_managed_peer/);
 assert.throws(()=>planRestore([p],[{publicKey:a,allowedIPs:['10.223.44.9/32']}],options),/managed_peer_drift/);
 assert.throws(()=>planRestore([p],[{publicKey:b,allowedIPs:['10.223.44.0/24']}],options),/address_conflict/);
 assert.throws(()=>planRestore([p],[{publicKey:b,allowedIPs:['0.0.0.0/0']}],options),/address_conflict/);
 assert.throws(()=>planRestore([p],[],{...options,serverIP:'10.223.44.8'}),/server_address_conflict/);
 assert.throws(()=>planRestore([p],[],{...options,serverIP:''}),/server_address_required/);
});
test('apply stops on changed live state before any write',async()=>{
 const preview=planRestore([p],[],options);let writes=0;
 await assert.rejects(()=>applyRestore({backend:{state:async()=>[{publicKey:b,allowedIPs:['10.223.44.22/32']}]},
  plan:preview,recheck:{managed:[p],options},runner:async()=>writes++}),/recovery_state_changed/);
 assert.equal(writes,0);
});
