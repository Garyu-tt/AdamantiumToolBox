import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomBytes} from 'node:crypto';
import {inPool,snapshotHash,validatePlan,checkTransition,authorizedSignatures,authorizedInternalKey} from '../lib/contract.mjs';
const key=()=>randomBytes(32).toString('base64');
const cfg={interface:'wg-test',pool:'10.223.44.0/24'};
const plan=()=>({schema:'network-wireguard-peer-plan-v1',operation:'add',interface:cfg.interface,
 peerPublicKey:key(),allowedIP:'10.223.44.8/32',expiresAt:Date.now()+50000,
 nonce:randomBytes(24).toString('base64url'),expectedState:snapshotHash([])});
test('strict interface, pool and short-lived plans',()=>{
 const p=plan();
 assert.equal(validatePlan(p,cfg),p);
 assert(inPool('10.223.44.8',cfg.pool));
 for(const ip of ['10.223.45.1','10.223.44.0','10.223.44.255','0.0.0.0']){
  assert.equal(inPool(ip,cfg.pool),false);
 }
 assert.throws(()=>validatePlan({...p,allowedIP:'0.0.0.0/0'},cfg));
 assert.throws(()=>validatePlan({...p,interface:'eth0'},cfg));
 assert.throws(()=>validatePlan({...p,expiresAt:Date.now()+800000},cfg));
 assert.throws(()=>validatePlan({...p,shell:'rm -rf /'},cfg));
 assert.throws(()=>validatePlan({...p,nonce:'abc'},cfg));
});
test('proposal cannot replace peers or steal an existing address',()=>{
 const p=plan();
 checkTransition(p,[]);
 assert.throws(()=>checkTransition(p,[{publicKey:p.peerPublicKey,allowedIPs:[p.allowedIP]}]),/stale_state/);
 const state=[{publicKey:p.peerPublicKey,allowedIPs:[p.allowedIP]}];
 const remove={...p,operation:'remove',expectedState:snapshotHash(state)};
 checkTransition(remove,state);
 assert.throws(()=>checkTransition({...remove,allowedIP:'10.223.44.9/32'},state),/peer_state_mismatch/);
});
test('two independently pinned Ed25519 signatures required; tamper and shared key fail',()=>{
 const a=generateKeyPairSync('ed25519'),b=generateKeyPairSync('ed25519');
 const trust={sourcePublicKeyPem:a.publicKey.export({type:'spki',format:'pem'}),
 destinationPublicKeyPem:b.publicKey.export({type:'spki',format:'pem'})};
 const p=plan(),message=Buffer.from(JSON.stringify(p));
 const proofs={source:sign(null,message,a.privateKey).toString('base64'),destination:sign(null,message,b.privateKey).toString('base64')};
 assert.equal(authorizedSignatures(p,proofs,trust),true);
 assert.throws(()=>authorizedSignatures({...p,allowedIP:'10.223.44.9/32'},proofs,trust),/signature_invalid/);
 assert.throws(()=>authorizedSignatures(p,{...proofs,destination:proofs.source},trust),/signature_invalid/);
 assert.throws(()=>authorizedSignatures(p,proofs,{...trust,destinationPublicKeyPem:trust.sourcePublicKeyPem}),/distinct_signers_required/);
 assert.equal(authorizedInternalKey('secret-longer-than-24-chars','secret-longer-than-24-chars'),true);
 assert.equal(authorizedInternalKey('no','secret-longer-than-24-chars'),false);
});
