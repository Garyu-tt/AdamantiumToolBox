import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {randomBytes,createHash} from 'node:crypto';
import {
 OP_REGISTRY_ABI,GRAPH_PLAN_ABI,REGISTRY_SHA256,REGISTRY_FINGERPRINT_HEX,
 getOperationCatalog,resolveOperation,validateOperationPlan,
 buildEncodeDecodeGraphs,LEGACY_R02_TRANSFORMS
} from '../apps/math_lab/operation_registry.mjs';
import {runMathByteOperation} from '../apps/math_lab/operation_kernels.mjs';
import {
 MATH_GRAPH_FRAME_MAGIC,encodeOperationGraphFrame,
 decodeOperationGraphFrame,migrateLegacyMLG2
} from '../apps/math_lab/operation_graph_codec.mjs';
import {tryRootTransform} from '../apps/math_lab/root_transform.mjs';
import {referenceDecodeGraph} from '../apps/math_lab/reference_verify.mjs';
const plan=(operations,codec=0x0201)=>({
 schema:GRAPH_PLAN_ABI,operationIds:operations,codecId:codec
});
const v=n=>{
 const bytes=[];
 do{const digit=n%128;n=Math.floor(n/128);bytes.push(digit+(n?128:0));}while(n);
 return Buffer.from(bytes);
};
const legacy=(original,steps,codec=1,payload)=>{
 let data=Buffer.from(original);
 for(const op of steps)data=runMathByteOperation(data,LEGACY_R02_TRANSFORMS[op]);
 const leaf=payload??deflateSync(data,{level:9});
 return Buffer.concat([
  Buffer.from('MLG2'),v(original.length),
  Buffer.from([steps.length,...steps,codec]),leaf
 ]);
};

test('MLG3 exact roundtrip preserves empty buffers and leading zeros',()=>{
 for(const source of [Buffer.alloc(0),Buffer.alloc(300),Buffer.from([0,0,0,1]),randomBytes(257)]){
  for(const ops of [[],[0x0101],[0x0102,0x0105],[0x0104,0x0103,0x0102]]){
   const encoded=encodeOperationGraphFrame(source,plan(ops));
   assert.deepEqual(decodeOperationGraphFrame(encoded.frame).data,source);
   assert.ok(encoded.bytes>0);
  }
 }
});

test('MLG3 RootTransform terminal has an explicit codec ID and reconstructs exact integer data',()=>{
 let hex=(10n**1000n).toString(16);if(hex.length%2)hex='0'+hex;
 const original=Buffer.from(hex,'hex');
 const packed=encodeOperationGraphFrame(original,plan([],0x0202),{
  rootDegrees:[1000],maxRootEvaluations:5
 });
 const decoded=decodeOperationGraphFrame(packed.frame);
 assert.deepEqual(decoded.data,original);
 assert.deepEqual(decoded.graphs.decode.nodes.filter(n=>n.operationId!==null).map(n=>n.operationId),[0x8202]);
 assert.ok(packed.bytes<original.length);
 assert.throws(()=>encodeOperationGraphFrame(randomBytes(100),plan([],0x0202),{
  rootDegrees:[1000],maxRootEvaluations:2
 }),/no smaller/);
});

test('migrates every legacy R02 operation without changing data semantics',()=>{
 const bytes=Buffer.from([0,0,17,51,85,119,153,187,221,16,48,80,112,144,176]);
 for(const legacyId of [1,2,3,4,5]){
  const old=legacy(bytes,[legacyId]);
  assert.deepEqual(referenceDecodeGraph(old),bytes);
  const upgraded=migrateLegacyMLG2(old);
  assert.deepEqual(decodeOperationGraphFrame(upgraded.frame).data,bytes);
  assert.deepEqual(upgraded.plan.operationIds,[LEGACY_R02_TRANSFORMS[legacyId]]);
  assert.equal(upgraded.preservedExactly,true);
 }
 const old=legacy(bytes,[1,4,3]);
 assert.deepEqual(decodeOperationGraphFrame(migrateLegacyMLG2(old).frame).data,bytes);
});

test('migrates legacy R02 RootTransform leaf with validated original, no recompression',()=>{
 const original=Buffer.alloc(129,17);
 const reversed=runMathByteOperation(original,0x0105);
 const root=tryRootTransform(reversed,{maxDepth:2,degrees:[2,4,8,16],maxEvaluations:10});
 if(root.compressed){
  const old=legacy(original,[5],2,root.compressed);
  const migrated=migrateLegacyMLG2(old);
  assert.equal(migrated.plan.codecId,0x0202);
  assert.deepEqual(decodeOperationGraphFrame(migrated.frame).data,original);
 }
});

