import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {approvalPayload,evaluateAccess} from '../lib/policy.mjs';
const s=generateKeyPairSync('ed25519'),d=generateKeyPairSync('ed25519');
const trust={source:{keyId:'a',publicKey:s.publicKey.export({type:'spki',format:'pem'})},destination:{keyId:'b',publicKey:d.publicKey.export({type:'spki',format:'pem'})}};
const flow={source:'a',destination:'b',principal:'owner',protocol:'tcp',port:443},now=Date.parse('2026-11-19T00:00:00Z');
const base={...flow,revision:'rev1',expiresAt:'2030-01-01T00:00:00Z'};
const policies=[{...base,side:'source',effect:'allow'},{...base,side:'destination',effect:'allow'}];
const approval=(side,keyId,key)=>{const a={...base,side,keyId};return {...a,signature:sign(null,approvalPayload(a),key).toString('base64')};};
const approvals=[approval('source','a',s.privateKey),approval('destination','b',d.privateKey)];
const evalWith=(x={})=>evaluateAccess({flow,policies,approvals,trust,now,...x});
test('two independent verified approvals grant simulation',()=>assert.deepEqual(evalWith(),{allowed:true,reasons:[],simulationOnly:true}));
test('missing destination approval fails',()=>assert(evalWith({approvals:approvals.slice(0,1)}).reasons.includes('destination_approval_unverified_or_ambiguous')));
test('reverse direction forbidden',()=>assert.equal(evalWith({flow:{...flow,source:'b',destination:'a'}}).allowed,false));
test('explicit deny overrides',()=>assert(evalWith({policies:[...policies,{...base,side:'source',effect:'deny'}]}).reasons.includes('source_explicit_deny')));
test('expiry rejects signed approval',()=>assert.equal(evalWith({now:Date.parse('2031-01-01Z')}).allowed,false));
test('policy revision mismatches approval',()=>assert.equal(evalWith({policies:[{...policies[0],revision:'rev2'},policies[1]]}).allowed,false));
test('signed payload mutation rejected',()=>assert.equal(evalWith({approvals:[{...approvals[0],port:80},approvals[1]]}).allowed,false));
test('signature substitution rejected',()=>assert.equal(evalWith({approvals:[{...approvals[0],signature:approvals[1].signature},approvals[1]]}).allowed,false));
test('duplicate allow rejected',()=>assert.equal(evalWith({policies:[...policies,policies[0]]}).allowed,false));
test('missing trust rejected',()=>assert.equal(evalWith({trust:{source:trust.source}}).allowed,false));
test('invalid flow protocol rejected',()=>assert.deepEqual(evalWith({flow:{...flow,protocol:'http'}}).reasons,['invalid_flow']));
test('invalid icmp port rejected',()=>assert.equal(evalWith({flow:{...flow,protocol:'icmp'}}).allowed,false));

test('TCP port 0 rejected',()=>assert.deepEqual(evalWith({flow:{...flow,port:0}}).reasons,['invalid_flow']));
test('UDP port 0 rejected',()=>assert.equal(evalWith({flow:{...flow,protocol:'udp',port:0}}).allowed,false));
test('identical bilateral verification keys are not two-party consent',()=>{
 const copies={source:trust.source,destination:{...trust.source,keyId:'b'}};
 const bad=approval('destination','b',s.privateKey);
 assert.deepEqual(evalWith({trust:copies,approvals:[approvals[0],bad]}).reasons,['bilateral_identity_not_independent']);
});
test('non Ed25519 identity cannot count as bilateral consent',()=>{
 const forged={source:trust.source,destination:{keyId:'b',publicKey:'invalid'}};
 assert.equal(evalWith({trust:forged}).allowed,false);
});
