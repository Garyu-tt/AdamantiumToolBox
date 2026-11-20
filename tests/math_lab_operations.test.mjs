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

test('operation registry has stable noncolliding IDs and complete inverse pairings',()=>{
 const registry=getOperationCatalog();
 assert.equal(registry.abi,OP_REGISTRY_ABI);
 assert.equal(registry.operations.length,14);
 assert.match(registry.sha256,/^[a-f0-9]{64}$/);
 assert.equal(REGISTRY_FINGERPRINT_HEX.length,16);
 const ids=new Set();
 for(const op of registry.operations){
  assert.ok(!ids.has(op.id));ids.add(op.id);
  assert.equal(resolveOperation(op.inverseId).inverseId,op.id);
  assert.equal(resolveOperation(op.inverseId).direction,op.direction==='encode'?'decode':'encode');
  assert.equal(op.version,1);
  assert.equal(op.parameters,'none');
 }
 assert.deepEqual(registry.operations.filter(x=>x.direction==='encode'&&x.kind==='transform')
  .map(x=>x.id),[0x0101,0x0102,0x0103,0x0104,0x0105]);
 assert.equal(resolveOperation(0x0201).key,'codec.zlib-wrapper');
 assert.equal(resolveOperation(0x0202).key,'codec.root-mlr1');
 assert.throws(()=>resolveOperation(0xffff),/unknown/);
 assert.throws(()=>resolveOperation(0x8101,{direction:'encode'}),/direction/);
});

test('typed encode/decode DAGs reverse operation IDs and preserve type joins',()=>{
 const graphs=buildEncodeDecodeGraphs(plan([0x0101,0x0103,0x0104],0x0201));
 assert.equal(graphs.plan.registrySha256,REGISTRY_SHA256);
 assert.equal(graphs.encode.nodes.length,6);
 assert.equal(graphs.decode.nodes.length,6);
 assert.deepEqual(graphs.encode.nodes.filter(n=>n.operationId!==null).map(n=>n.operationId),
  [0x0101,0x0103,0x0104,0x0201]);
 assert.deepEqual(graphs.decode.nodes.filter(n=>n.operationId!==null).map(n=>n.operationId),
  [0x8201,0x8104,0x8103,0x8101]);
 for(const graph of [graphs.encode,graphs.decode]){
  assert.equal(graph.edges.length,graph.nodes.length-1);
  assert.ok(graph.edges.every(edge=>graph.nodes.find(n=>n.id===edge.from).outputType===
    graph.nodes.find(n=>n.id===edge.to).inputType));
  assert.equal(graph.authorityToInvoke,false);
 }
 const noOps=buildEncodeDecodeGraphs(plan([]));
 assert.deepEqual(noOps.decode.nodes.filter(n=>n.operationId!==null).map(n=>n.operationId),[0x8201]);
});

test('every byte kernel has a strict inverse across changing lengths',()=>{
 for(const count of [0,1,2,3,7,8,9,15,16,17,48,256]){
  const input=randomBytes(count);
  for(const op of [0x0101,0x0102,0x0103,0x0104,0x0105]){
   const encoded=runMathByteOperation(input,op);
   const decoded=runMathByteOperation(encoded,resolveOperation(op).inverseId);
   assert.deepEqual(decoded,input,'forward/inverse mismatch '+op+' size '+count);
   assert.notEqual(encoded,input);
  }
 }
 assert.throws(()=>runMathByteOperation(Buffer.from([1]),0xffff),/unknown/);
 assert.throws(()=>runMathByteOperation(Buffer.from([1]),0x0201),/Not a reversible/);
});

test('MLG3 roundtrip of multiple reversible operations stores registry revision, length and checksum',()=>{
 const source=Buffer.concat([Buffer.alloc(17),Buffer.from('hello graph world'.repeat(18))]);
 const result=encodeOperationGraphFrame(source,plan([0x0101,0x0103,0x0104],0x0201));
 assert.equal(result.frame.subarray(0,4).toString(),MATH_GRAPH_FRAME_MAGIC);
 assert.equal(result.frame[4],1);
 assert.equal(result.frame.subarray(5,13).toString('hex'),REGISTRY_FINGERPRINT_HEX);
 const restored=decodeOperationGraphFrame(result.frame);
 assert.deepEqual(restored.data,source);
 assert.deepEqual(restored.plan.operationIds,[0x0101,0x0103,0x0104]);
 assert.equal(restored.plan.codecId,0x0201);
 assert.equal(restored.checksumVerified,true);
 assert.equal(restored.authenticated,false);
 assert.equal(restored.executionAuthorized,false);
 assert.equal(result.bytes,result.frame.length);
 assert.match(result.sha256,/^[a-f0-9]{64}$/);
});

