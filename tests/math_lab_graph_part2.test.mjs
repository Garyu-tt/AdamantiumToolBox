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
const lengthVarint=n=>{const values=[];do{const d=n%128;n=Math.floor(n/128);values.push(d+(n?128:0));}while(n);return Buffer.from(values);};
const envelope=(source,ops,payload,codec=1)=>
 Buffer.concat([magic,lengthVarint(source.length),Buffer.from([ops.length,...ops,codec]),payload]);
const digest=x=>createHash('sha256').update(x).digest('hex');
const toBytes=n=>{
 let hex=n.toString(16);
 if(hex.length&1)hex='0'+hex;
 return Buffer.from(hex,'hex');
};

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
 assert.throws(()=>referenceDecodeGraph(envelope(source,[255],deflateSync(source))),/code/);
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


