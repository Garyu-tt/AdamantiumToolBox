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
