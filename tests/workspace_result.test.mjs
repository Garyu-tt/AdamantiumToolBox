import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWorkspaceResult} from '../sdk/workspace-result.mjs';

const hash='a'.repeat(64),workspace_ref='workspace:'+hash;
const prepare={result:{allowed:true,workspace_ref,sha256:hash,bytes:88}};
const revoke={result:{allowed:true,revoked:true,workspace_ref}};
test('accept minimal safe prepare result and freeze it',()=>{
 const r=normalizeWorkspaceResult('prepare',prepare);
 assert.deepEqual(r,{available:true,workspace_ref,sha256:hash,bytes:88});
 assert.equal(Object.isFrozen(r),true);
});
test('accept only true, scoped revoke result',()=>{
 assert.deepEqual(normalizeWorkspaceResult('revoke',revoke),
  {available:true,revoked:true,workspace_ref});
 assert.deepEqual(normalizeWorkspaceResult('revoke',{result:{...revoke.result,revoked:false}}),
  {available:false});
});
test('drop accidental private path, raw bytes, or access token fields',()=>{
 for(const extra of [{path:'/private/agent/home'},{content:'secret'},
  {token:'credential'},{workspace_uid:1000}]) {
  assert.deepEqual(normalizeWorkspaceResult('prepare',{
   result:{...prepare.result,...extra}}),{available:false});
 }
});
test('deny bad references, malformed digests, sizes and unknown operations',()=>{
 const bad={...prepare.result,workspace_ref:'workspace:../../unsafe'};
 assert.deepEqual(normalizeWorkspaceResult('prepare',{result:bad}),{available:false});
 assert.deepEqual(normalizeWorkspaceResult('prepare',{result:{
  ...prepare.result,sha256:'notsha'}}),{available:false});
 assert.deepEqual(normalizeWorkspaceResult('prepare',{result:{
  ...prepare.result,bytes:Infinity}}),{available:false});
 assert.deepEqual(normalizeWorkspaceResult('unknown',prepare),{available:false});
});
test('no permission or incomplete envelope is not available',()=>{
 for(const payload of [null,{}, {result:null},{result:{allowed:false}},
  {result:{...prepare.result,allowed:'true'}},
  {result:{allowed:true,workspace_ref}}]) {
  assert.deepEqual(normalizeWorkspaceResult('prepare',payload),{available:false});
 }
});
