import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {validFlow,proposal,approvalPayload,inspect} from '../lib/contracts.mjs';
const flow={source:'desktop',destination:'server',principal:'owner',protocol:'tcp',port:443};
const keys=()=>{const {privateKey,publicKey}=generateKeyPairSync('ed25519');return {privateKey,publicKey:publicKey.export({type:'spki',format:'pem'})};};
function fixture(){
 const a=keys(),b=keys();const now=Date.now(),expiresAt=new Date(now+3600_000).toISOString(),revision='rev01';
 const trust={source:{keyId:'src-key',publicKey:a.publicKey},destination:{keyId:'dst-key',publicKey:b.publicKey}};
 const make=(side,key)=>{const v={...flow,side,revision,keyId:trust[side].keyId,expiresAt};return {...v,signature:sign(null,approvalPayload(v),key.privateKey).toString('base64')}};
 const policies=['source','destination'].map(side=>({...flow,side,revision,expiresAt,effect:'allow'}));
 return {trust,policies,approvals:[make('source',a),make('destination',b)],revision,keys:{a,b},now};
}
test('valid flow and protocol-specific ports',()=>{assert.equal(validFlow(flow),true);assert.equal(validFlow({...flow,port:0}),false);assert.equal(validFlow({...flow,protocol:'icmp',port:0}),true);});
test('proposal is unsigned and binds exact flow',()=>{const p=proposal(flow,'rev01',new Date(Date.now()+3600_000).toISOString());assert.equal(p.mode,'proposal_only');assert.deepEqual(p.requires,['source','destination']);assert.match(p.proposalHash,/^[a-f\d]{64}$/);});
test('independent signatures allow a *simulation* verdict only',()=>{const state=fixture();const out=inspect({flow,state,expectedRevision:state.revision,now:state.now});assert.equal(out.authorized,true);assert.equal(out.needsEnforcement,true);assert.equal(out.authoritative,false);});
test('wrong revision fails closed',()=>{const state=fixture();assert.equal(inspect({flow,state,expectedRevision:'wrong',now:state.now}).authorized,false);});
test('wrong direction fails closed',()=>{const state=fixture();assert.equal(inspect({flow:{...flow,source:'server',destination:'desktop'},state,expectedRevision:state.revision,now:state.now}).authorized,false);});
test('revoked and expired approvals fail closed',()=>{const state=fixture();state.approvals[1].expiresAt=new Date(state.now-1000).toISOString();assert.equal(inspect({flow,state,expectedRevision:state.revision,now:state.now}).authorized,false);});
test('one signer on both sides is denied',()=>{const state=fixture();state.trust.destination.publicKey=state.trust.source.publicKey;assert.equal(inspect({flow,state,expectedRevision:state.revision,now:state.now}).authorized,false);});
test('explicit deny overrides signed grant',()=>{const state=fixture();state.policies.push({...flow,side:'source',revision:state.revision,effect:'deny',expiresAt:state.policies[0].expiresAt});assert.equal(inspect({flow,state,expectedRevision:state.revision,now:state.now}).authorized,false);});
test('duplicate approvals are ambiguous',()=>{const state=fixture();state.approvals.push({...state.approvals[0]});assert.equal(inspect({flow,state,expectedRevision:state.revision,now:state.now}).authorized,false);});
test('signature over malformed payload fails',()=>{const state=fixture();state.approvals[0].signature='aaaa';assert.equal(inspect({flow,state,expectedRevision:state.revision,now:state.now}).authorized,false);});
