import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSourceResult} from '../sdk/source-resolver-result.mjs';

const hash='a'.repeat(64);
test('accept only redacted, strictly typed resolve metadata',()=>{
 const payload={result:{allowed:true,artifact:{id:'demo.plugin',version:'0.1.0',
  sha256:hash,bytes:20}}};
 assert.deepEqual(normalizeSourceResult('resolve',payload),
  {available:true,id:'demo.plugin',version:'0.1.0',sha256:hash,bytes:20});
 assert.equal(Object.isFrozen(normalizeSourceResult('resolve',payload)),true);
});
test('deny missing, denied and malformed payloads',()=>{
 for(const obj of [null,{}, {result:{allowed:false}}, {result:{allowed:true}},
  {result:{allowed:'true',artifact:{id:'demo.plugin'}}}]) {
  assert.deepEqual(normalizeSourceResult('resolve',obj),{available:false});
 }
});
test('reject unsolicited paths and secret fields',()=>{
 const a={id:'demo.plugin',version:'0.1.0',sha256:hash,bytes:20};
 assert.deepEqual(normalizeSourceResult('resolve',{result:{allowed:true,
  artifact:{...a,path:'/private/repo'}}}),{available:false});
 assert.deepEqual(normalizeSourceResult('resolve',{result:{allowed:true,
  artifact:a,token:'leak'}}),{available:false});
});
test('stage reference contains digest only',()=>{
 assert.deepEqual(normalizeSourceResult('stage',{result:{allowed:true,
  artifact_ref:'sha256:'+hash,bytes:20}}),{available:true,artifact_ref:'sha256:'+hash,bytes:20});
 for(const reference of ['../../leak','file:///var/private','sha256:../leak']) {
  assert.deepEqual(normalizeSourceResult('stage',{result:{allowed:true,
   artifact_ref:reference,bytes:20}}),{available:false});
 }
});
test('invalid types and unfamiliar response kinds fail closed',()=>{
 const r={result:{allowed:true,artifact:{id:'demo.plugin',version:'0.1.0',
  sha256:hash,bytes:999999999}}};
 assert.deepEqual(normalizeSourceResult('resolve',r),{available:false});
 assert.deepEqual(normalizeSourceResult('custom',r),{available:false});
});
