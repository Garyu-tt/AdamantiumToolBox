#!/usr/bin/env node
/**
 * Math Lab R02 deterministic micro-corpus. Source data is synthesized locally,
 * never downloaded or uploaded. No training, no claims of representative files.
 */
import {createHash} from 'node:crypto';
import {brotliCompressSync,constants as zc} from 'node:zlib';
import {searchReversibleTransforms} from '../apps/math_lab/transform_graph.mjs';
import {verifyGraphAgainstOriginal} from '../apps/math_lab/reference_verify.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const intBytes=n=>{
 let x=n.toString(16);
 if(x.length%2)x='0'+x;
 return Buffer.from(x,'hex');
};
function rng(seed){
 let x=seed>>>0;
 return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0;};
}
function makeFixtures(){
 const random=rng(0xdecafbad);
 const uniform=Buffer.alloc(1024);
 for(let i=0;i<uniform.length;i++)uniform[i]=random()&255;
 const walk=Buffer.alloc(1536);
 let v=37;
 for(let i=0;i<walk.length;i++){
  v=(v+((random()&1)?1:255))&255;
  walk[i]=v;
 }
 const bitplane=Buffer.alloc(1024);
 for(let i=0;i<bitplane.length;i++)bitplane[i]=((random()&1)<<7)|0x2a;
 const alternated=Buffer.alloc(1200);
 for(let i=0;i<alternated.length;i++)alternated[i]=i%2?0:(random()&255);
 const rows=Array.from({length:32},(_,i)=>({
  id:i,kind:i%3?'worker':'build',status:['queued','running','complete'][i%3],
  retry:i%5===0,resource: ['cpu','ram','io'][i%3]
 }));
 return Object.freeze([
  {id:'integer.decimal_power',data:intBytes(10n**1000n)},
  {id:'integer.binary_power',data:intBytes(2n**4096n)},
  {id:'text.decimal_power',data:Buffer.from('1'+'0'.repeat(1000))},
  {id:'bytes.uniform_prng',data:uniform},
  {id:'bytes.random_walk',data:walk},
  {id:'bytes.bitplane',data:bitplane},
  {id:'bytes.interleaved',data:alternated},
  {id:'json.task_records',data:Buffer.from(JSON.stringify(rows),'utf8')}
 ]);
}
export function benchmarkDeterministicCorpus(){
 const fixtures=makeFixtures();
 const rows=[];
 for(const f of fixtures){
  if(f.data.length>8192)throw new RangeError('invalid fixture size');
  const start=process.hrtime.bigint();
  const search=searchReversibleTransforms(f.data,{
   maxDepth:2,maxStates:24,maxRootCalls:4,maxRootEvaluations:12,
   modelBytes:{zlib:0,root:0,graph:0}
  });
  const brotli=brotliCompressSync(f.data,{
   params:{[zc.BROTLI_PARAM_QUALITY]:9}
  });
  const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
  const comparison=[
   ...search.report.candidates.map(c=>({method:c.method,bytes:c.totalBytes})),
   {method:'brotli-q9',bytes:brotli.length}
  ].sort((a,b)=>a.bytes-b.bytes||a.method.localeCompare(b.method));
  const reproduction=search.encoded
   ?verifyGraphAgainstOriginal(search.encoded,f.data,{datasetId:f.id})
   :null;
  rows.push(Object.freeze({
   id:f.id,bytes:f.data.length,sha256:sha(f.data),
   methods:Object.freeze(comparison),
   best:comparison[0].method,bestBytes:comparison[0].bytes,
   bestRatio:Number((comparison[0].bytes/f.data.length).toFixed(4)),
   exploredStates:search.report.visitedStates,
   exploredEdges:search.report.attemptedEdges,
   rootCalls:search.report.rootCalls,
   graphChosenWithoutBrotli:search.graphWouldWin,
   graphReproduced:reproduction?.exactByteEquality??null,
   elapsedMs:Number(elapsedMs.toFixed(3)),
   independentAgentReviewed:false
  }));
 }
 return Object.freeze({
  schema:'mechanicus.math-benchmark/1',
  corpus:'synthetic-deterministic-r02',
  corpusCount:rows.length,
  metrics:'complete standalone stream bytes; common external model/deployment cost excluded',
  timeCaveat:'elapsedMs is a single noisy CPU observation, not comparative performance proof',
  independentQA:'not-performed',
  productionApproved:false,
  results:Object.freeze(rows)
 });
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 process.stdout.write(JSON.stringify(benchmarkDeterministicCorpus(),null,2)+'\n');
}
