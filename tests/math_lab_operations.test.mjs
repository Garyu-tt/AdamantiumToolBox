import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {randomBytes,createHash} from 'node:crypto';
import {
 OP_REGISTRY_ABI,GRAPH_PLAN_ABI,REGISTRY_SHA256,REGISTRY_FINGERPRINT,
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
 assert.equal(REGISTRY_FINGERPRINT.length,8);
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
 assert.equal(result.frame.subarray(5,13).equals(REGISTRY_FINGERPRINT),true);
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

test('unknown operation ID, registry mismatch, malformed frame, tamper, or oversized output reject closed',()=>{
 const source=Buffer.from('hello'.repeat(50));
 const good=encodeOperationGraphFrame(source,plan([0x0101,0x0102])).frame;
 assert.throws(()=>decodeOperationGraphFrame(good.subarray(0,good.length-1)),/payload length/);
 assert.throws(()=>decodeOperationGraphFrame(Buffer.from('MLG2')),/not an MLG3/);
 const wrongVersion=Buffer.from(good);wrongVersion[4]=2;
 assert.throws(()=>decodeOperationGraphFrame(wrongVersion),/major/);
 const wrongDigest=Buffer.from(good);wrongDigest[6]^=0xff;
 assert.throws(()=>decodeOperationGraphFrame(wrongDigest),/registry/);
 const badOp=Buffer.from(good);
 // fixed header (4 + 1 + 8), length <= 127 requires 2-byte varint;
 // step-count follows it, then the first two-byte operation ID.
 const stepOffset=13+v(source.length).length+1;
 badOp.writeUInt16BE(0xffff,stepOffset);
 assert.throws(()=>decodeOperationGraphFrame(badOp),/unknown/);
 const changedSourceHash=Buffer.from(good);
 const dataOffset=good.length-9;
 changedSourceHash[dataOffset]^=0x01;
 assert.throws(()=>decodeOperationGraphFrame(changedSourceHash),/failed leaf decode|checksum/);
 const decodedHashMismatch=Buffer.from(good);
 // payload length is known: write a byte into the checksum just before zlib.
 const payload=deflateSync(runMathByteOperation(runMathByteOperation(source,0x0101),0x0102));
 decodedHashMismatch[decodedHashMismatch.length-payload.length-1]^=1;
 assert.throws(()=>decodeOperationGraphFrame(decodedHashMismatch),/checksum/);
 assert.throws(()=>decodeOperationGraphFrame(good,{maxOutputBytes:12}),/budget/);
 assert.throws(()=>validateOperationPlan(plan([0x8201])),/direction/);
 assert.throws(()=>validateOperationPlan(plan([0x0101,0x0102,0x0103,0x0104])),/depth/);
 assert.throws(()=>validateOperationPlan({...plan([]),code:'eval()'}),/unknown plan field/);
});

test('MLG3 is self-described, never treats operation IDs as executable code or permissions',()=>{
 const p=plan([0x0105],0x0201);
 const g=buildEncodeDecodeGraphs(p);
 assert.equal(g.executionAuthorized,false);
 assert.equal(g.plan.executionAuthorized,false);
 assert.ok(g.encode.nodes.every(n=>!Object.hasOwn(n,'execute')));
 assert.ok(g.decode.nodes.every(n=>!Object.hasOwn(n,'code')));
 assert.ok(g.decode.nodes.every(n=>!Object.hasOwn(n,'url')));
 assert.throws(()=>runMathByteOperation(Buffer.alloc(2),0x4000),/unknown/);
});
