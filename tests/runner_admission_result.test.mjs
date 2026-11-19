import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRunnerPreview} from '../sdk/runner-admission-result.mjs';

const hex='a'.repeat(64),workspace_ref='workspace:'+hex;
const good={result:{eligible:true,runnable:false,reason:'isolation_unavailable',
 workspace_ref,sha256:hex,bytes:52,
 budget:{timeout_ms:1200,memory_mib:64,cpu_percent:20,network:'deny'}}};
const denied={result:{eligible:false,runnable:false,reason:'unavailable'}};
test('accept only a bounded non-executing presentation descriptor',()=>{
 assert.deepEqual(normalizeRunnerPreview(good),{eligible:true,runnable:false,
  workspace_ref,sha256:hex,bytes:52,budget:good.result.budget});
 assert.equal(Object.isFrozen(normalizeRunnerPreview(good).budget),true);
});
test('reject any executable, unbounded or network-enabled claim',()=>{
 for(const payload of [
  {result:{...good.result,runnable:true}},
  {result:{...good.result,budget:{...good.result.budget,network:'allow'}}},
  {result:{...good.result,budget:{...good.result.budget,memory_mib:99999}}},
  {result:{...good.result,budget:{...good.result.budget,timeout_ms:-1}}}
 ])assert.deepEqual(normalizeRunnerPreview(payload),{eligible:false,runnable:false});
});
test('reject private paths, credentials and accidental source bytes',()=>{
 for(const field of [{path:'/private/users'},{token:'secret'},
  {source:'private code'},{credential:'agent-key'}]){
  assert.deepEqual(normalizeRunnerPreview({result:{...good.result,...field}}),
   {eligible:false,runnable:false});
 }
});
test('missing, denied and corrupt responses remain unavailable',()=>{
 for(const value of [null,{},denied,{result:{eligible:true,runnable:false}},
  {result:{...good.result,sha256:'bad'}},
  {result:{...good.result,workspace_ref:'workspace:../secret'}},
  {result:{...good.result,bytes:'52'}}])
  assert.deepEqual(normalizeRunnerPreview(value),{eligible:false,runnable:false});
});
