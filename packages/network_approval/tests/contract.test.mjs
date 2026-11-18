import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {prepare,canonicalRequest,message,revokeMessage,verifyProof,distinctPins,validateTrust,publicRequest} from '../lib/contract.mjs';

const gen=()=>generateKeyPairSync('ed25519');
function fixture(){
 const a=gen(),b=gen(),trust={schema:'network-approval-trust-v1',nodes:{
  laptop:{keyId:'laptop-v1',publicKey:a.publicKey.export({type:'spki',format:'pem'}).toString()},
  server:{keyId:'server-v1',publicKey:b.publicKey.export({type:'spki',format:'pem'}).toString()}}};
 const flow={source:'laptop',destination:'server',principal:'owner',protocol:'tcp',port:443};
 const draft=prepare({flow,revision:'rev-5',expiresAt:new Date(Date.now()+60_000).toISOString()});
 const proof=(side,kind='sign',reason)=>({side,keyId:trust.nodes[side==='source'?'laptop':'server'].keyId,
  signature:sign(null,kind==='revoke'?revokeMessage(draft.request,side,reason):message(draft.request,side),
   side==='source'?a.privateKey:b.privateKey).toString('base64')});
 return {a,b,trust,draft,proof};
}
test('request is canonical, unsigned preparation changes no rights',()=>{
 const {draft}=fixture();assert.equal(draft.mode,'proof_required');assert.equal(draft.enforcement,false);
 assert.deepEqual(canonicalRequest(draft.request),draft.request);
 assert.throws(()=>prepare({flow:{...draft.request.flow,port:0},revision:'x',expiresAt:draft.request.expiresAt}),/invalid_request/);
});
test('two independently pinned Ed25519 proofs pass and tampering fails',()=>{
 const {trust,draft,proof}=fixture();
 assert(distinctPins(draft.request,trust));assert(verifyProof(draft.request,proof('source'),trust));
 assert(verifyProof(draft.request,proof('destination'),trust));
 assert(!verifyProof({...draft.request,revision:'rev-6'},proof('destination'),trust));
 assert(!verifyProof(draft.request,{...proof('destination'),keyId:'other'},trust));
 assert(!verifyProof(draft.request,{...proof('destination'),signature:'A'.repeat(84)},trust));
});
test('same Ed25519 identity cannot approve both ends',()=>{
 const {trust,draft}=fixture();trust.nodes.server.publicKey=trust.nodes.laptop.publicKey;
 assert.equal(distinctPins(draft.request,trust),false);
});
test('revoke signature binds reason and side',()=>{
 const {trust,draft,proof}=fixture();const p=proof('destination','revoke','policy_change');
 assert(verifyProof(draft.request,p,trust,{kind:'revoke',reason:'policy_change'}));
 assert(!verifyProof(draft.request,p,trust,{kind:'revoke',reason:'owner_withdrawal'}));
 assert(!verifyProof(draft.request,p,trust,{kind:'sign'}));
});
test('expired and revoked status never claims enforcement',()=>{
 const {draft,proof}=fixture();const r={request:draft.request,source:proof('source'),destination:proof('destination'),revoke:null};
 assert.equal(publicRequest(r).state,'bilaterally_signed');assert.equal(publicRequest(r).enforcement,false);
 assert.equal(publicRequest({...r,revoke:{reason:'policy_change'}}).state,'revoked');
 assert.equal(publicRequest(r,Date.parse(draft.request.expiresAt)+1).state,'expired');
});
test('reject invalid trust public keys and missing signer',()=>{
 const {trust,draft,proof}=fixture();assert.equal(validateTrust(trust),trust);
 assert.throws(()=>validateTrust({schema:'network-approval-trust-v1',nodes:{laptop:{keyId:'a',publicKey:'x'}}}),/invalid_trust/);
 assert(!verifyProof(draft.request,proof('source'),{schema:'network-approval-trust-v1',nodes:{}}));
});
