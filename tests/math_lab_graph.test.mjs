import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {tryRootTransform} from '../apps/math_lab/root_transform.mjs';
import {
 searchReversibleTransforms,TRANSFORM_GRAPH_SCHEMA
} from '../apps/math_lab/transform_graph.mjs';
import {
 referenceDecodeGraph,verifyGraphAgainstOriginal,decodeRootReference
} from '../apps/math_lab/reference_verify.mjs';

const magic=Buffer.from('MLG2','ascii');
const envelope=(source,ops,payload,codec=1)=>
 Buffer.concat([magic,Buffer.from([source.length,ops.length,...ops,codec]),payload]);
const digest=x=>createHash('sha256').update(x).digest('hex');
const toBytes=n=>{
 let hex=n.toString(16);
 if(hex.length&1)hex='0'+hex;
 return Buffer.from(hex,'hex');
};

test('R02 graph search always compares complete wire cost against raw/zlib/root',()=>{
 const data=Buffer.alloc(160,0x17);
 const candidate=searchReversibleTransforms(data,{maxDepth:2,maxStates:14,maxRootCalls:3});
 const r=candidate.report;
 assert.equal(r.schema,TRANSFORM_GRAPH_SCHEMA);
 assert.equal(r.originalBytes,160);
 assert.equal(r.originalSha256,digest(data));
 assert.equal(r.selectedTotalBytes,Math.min(...r.candidates.map(c=>c.totalBytes)));
 assert.ok(r.visitedStates<=14);
 assert.ok(r.rootCalls<=3);
 assert.ok(r.maxDepth===2);
 assert.equal(r.archiveApproved,false);
 assert.equal(r.independentQA,'not-performed');
 assert.equal(r.savingsBytes,160-r.selectedTotalBytes);
 if(candidate.encoded){
  assert.equal(candidate.encoded.length+r.candidates.find(c=>c.method==='transform-graph').modelBytes,r.selectedTotalBytes);
  assert.deepEqual(referenceDecodeGraph(candidate.encoded),data);
 }
});

test('separate oracle reverses all five transforms including partial 8-byte groups',()=>{
 const src=Buffer.from([1,2,3,4,5,6,7,8,9,10,11]);
 const outputs=[
  [1,Buffer.from([1,3,1,7,1,3,1,15,1,3,1])],
  [2,Buffer.from([1,1,1,1,1,1,1,1,1,1,1])],
  [3,Buffer.from([1,3,5,7,9,11,2,4,6,8,10])],
  [4,Buffer.from([85,102,120,128,0,0,0,0,9,10,11])],
  [5,Buffer.from([...src].reverse())]
 ];
 for(const [op,forward] of outputs){
  const packed=envelope(src,[op],deflateSync(forward));
  const restored=referenceDecodeGraph(packed);
  assert.deepEqual(restored,src,'opcode '+op+' must reconstruct original');
  assert.equal(verifyGraphAgainstOriginal(packed,src).exactByteEquality,true);
 }
});

test('reference oracle parses original R01 integer roots independently and inside a graph',()=>{
 const data=toBytes(10n**1000n);
 const compressed=tryRootTransform(data,{degrees:[1000],maxDepth:1}).compressed;
 assert.ok(compressed);
 assert.deepEqual(decodeRootReference(compressed),data);
 const wrapped=envelope(data,[5],compressed,2);
 // A standalone R01 root stores original data; graph reverse-op would
 // reverse the result, so feed reverse(data) into nested root if profitable.
 assert.notDeepEqual(referenceDecodeGraph(wrapped),data);
 const palindrome=Buffer.concat([Buffer.alloc(64,17),Buffer.alloc(64,17)]);
 const root=tryRootTransform(palindrome,{degrees:[2,8],maxDepth:2,maxEvaluations:8}).compressed;
 if(root){
  const inside=envelope(palindrome,[5],root,2);
  assert.deepEqual(referenceDecodeGraph(inside),palindrome);
 }
});

test('lossless graph search reproduces byte-for-byte when it wins',()=>{
 const corpus=[
  Buffer.from('a'.repeat(500)+'b'.repeat(120)),
  Buffer.concat([Buffer.alloc(400,0),randomBytes(160)]),
  toBytes(10n**1000n),
  Buffer.from('1'+'0'.repeat(600)),
  Buffer.alloc(900).map((_,i)=>i%2?0:((i*29+i*17)>>2)&255)
 ];
 for(const bytes of corpus){
  const r=searchReversibleTransforms(bytes,{
   maxDepth:2,maxStates:18,maxRootCalls:4,maxRootEvaluations:8,
   degrees:[2,3,8,16,256,1000]
  });
  assert.ok(r.report.visitedStates<=18);
  assert.ok(r.report.rootCalls<=4);
  assert.ok(r.report.savingsBytes>=0);
  if(r.encoded){
   const restored=referenceDecodeGraph(r.encoded);
   assert.deepEqual(restored,bytes);
   const receipt=verifyGraphAgainstOriginal(r.encoded,bytes,{datasetId:'example'});
   assert.equal(receipt.originalSha256,receipt.restoredSha256);
   assert.equal(receipt.independentImplementation,true);
   assert.equal(receipt.independentAgentReviewed,false);
   assert.equal(receipt.productionApproved,false);
  }
 }
});

test('independently verified graph can compress a byte stream with predictive structure',()=>{
 // Deterministic pseudorandom +/-1 walk. Raw walk tends to distribute
 // across many bytes, while delta representation exposes only 1 and 255.
 let seed=0x23456789,v=31;
 const source=Buffer.alloc(1536);
 for(let i=0;i<source.length;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  v=(v+((seed>>>15)&1?1:255))&255;
  source[i]=v;
 }
 const r=searchReversibleTransforms(source,{
  maxDepth:2,maxStates:20,maxRootCalls:2,maxRootEvaluations:8
 });
 assert.equal(r.report.selectedTotalBytes,Math.min(...r.report.candidates.map(c=>c.totalBytes)));
 if(r.graphWouldWin){
  assert.ok(r.report.chosenSteps.length>=1);
  assert.deepEqual(referenceDecodeGraph(r.encoded),source);
 }
});

test('corrupt, truncated or malformed transform graphs fail closed',()=>{
 const source=Buffer.from([1,2,3,4,5]);
 const graph=envelope(source,[3],deflateSync(Buffer.from([1,3,5,2,4])));
 assert.deepEqual(referenceDecodeGraph(graph),source);
 assert.throws(()=>referenceDecodeGraph(Buffer.from('garbage')),/invalid/);
 assert.throws(()=>referenceDecodeGraph(graph.subarray(0,graph.length-2)));
 assert.throws(()=>referenceDecodeGraph(envelope(source,[255],deflateSync(source))),/opcode/);
 assert.throws(()=>referenceDecodeGraph(envelope(source,[],deflateSync(source))),/depth/);
 assert.throws(()=>referenceDecodeGraph(envelope(source,[3],Buffer.from('fake'))),/invalid/);
 assert.throws(()=>verifyGraphAgainstOriginal(graph,Buffer.from([8,9,10])),/differ/);
});

test('search budgets reject invalid parameters and non-binary input',()=>{
 assert.throws(()=>searchReversibleTransforms(Buffer.alloc(8193)),/bounded/);
 assert.throws(()=>searchReversibleTransforms('not bytes'),/bounded/);
 assert.throws(()=>searchReversibleTransforms(Buffer.alloc(0),{maxStates:0}),/states/);
 assert.throws(()=>searchReversibleTransforms(Buffer.alloc(0),{maxDepth:4}),/depth/);
 assert.throws(()=>searchReversibleTransforms(Buffer.alloc(0),{degrees:[1]}),/degree/);
 assert.throws(()=>searchReversibleTransforms(Buffer.alloc(0),{modelBytes:{graph:-1}}),/cost/);
 assert.throws(()=>searchReversibleTransforms(Buffer.alloc(0),{injectCode:'eval'}),/Unknown/);
});

test('model-cost accounting can veto an otherwise smaller graph stream',()=>{
 const source=Buffer.alloc(1300).map((_,i)=>i%3===0?0x55:0xaa);
 const cheap=searchReversibleTransforms(source,{maxStates:10,maxRootCalls:1});
 const dear=searchReversibleTransforms(source,{maxStates:10,maxRootCalls:1,
  modelBytes:{graph:1000000}});
 assert.ok(dear.report.selectedMethod!=='transform-graph');
 assert.equal(dear.encoded,null);
 assert.ok(cheap.report.selectedTotalBytes<=source.length);
});
