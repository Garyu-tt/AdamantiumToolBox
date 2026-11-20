import {applyStep,envelope,validOpts} from './transform_graph_utils.mjs';
/**
 * Mechanicus Math Lab R02: bounded best-first-ish BFS over reversible byte
 * transforms, with full wire-byte accounting and exact fallback baselines.
 *
 * No Node-RED runtime, AI execution, agent authority or archive integration.
 */
import {createHash} from 'node:crypto'; import {deflateSync} from 'node:zlib';
import {tryRootTransform} from './root_transform.mjs';

export const TRANSFORM_GRAPH_SCHEMA='mechanicus.math-transform-search/1';
export const TRANSFORM_GRAPH_MAGIC='MLG2';
export const TRANSFORM_STEPS=Object.freeze({
  1:'xor-previous',
  2:'subtract-previous',
  3:'even-odd',
  4:'transpose-bitplanes-8x8',
  5:'reverse-bytes'
});
const LIMIT_BYTES=8192,OPS=Object.freeze([1,2,3,4,5]);
const sha=b=>createHash('sha256').update(b).digest('hex');
/**
 * This enumerates breadth-first transform states, then compares graph-leaf
 * codecs to raw, standalone zlib and standalone R01 RootTransform.
 *
 * A nil .encoded means NO graph route strictly beats the best baseline.
 * Outputs are fully self-contained graph wire streams, not bare transformed
 * payloads. "Selected method" is a size comparison, not a quality claim.
 */
export function searchReversibleTransforms(input,options={}){
 if(!Buffer.isBuffer(input)||input.length>LIMIT_BYTES)throw new TypeError('Expected bounded binary block');
 const {maxDepth,maxStates,maxRootCalls,maxRootEvaluations,degrees,modelBytes}=validOpts(options);
 const zlib=deflateSync(input,{level:9});
 const candidates=[
  {method:'raw',bytes:input.length,modelBytes:0,totalBytes:input.length},
  {method:'zlib',bytes:zlib.length,modelBytes:modelBytes.zlib,
   totalBytes:zlib.length+modelBytes.zlib}
 ];
 let rootCalls=0,rootEvaluations=0;
 const rootCandidate=data=>{
  if(rootCalls>=maxRootCalls)return null;
  rootCalls++;
  const x=tryRootTransform(data,{degrees,maxDepth:1,maxEvaluations:maxRootEvaluations});
  rootEvaluations+=x.evaluated;
  return x.compressed;
 };
 const initialRoot=rootCandidate(input);
 if(initialRoot)candidates.push({
  method:'root-r01',bytes:initialRoot.length,modelBytes:modelBytes.root,
  totalBytes:initialRoot.length+modelBytes.root
 });
 const visited=new Set([sha(input)]),states=[{data:input,steps:[]}];
 let bestGraph=null,edges=0;
 const consider=(state,codec,payload)=>{
  const output=envelope(input.length,state.steps,codec,payload);
  const candidate={
   method:'transform-graph',bytes:output.length,modelBytes:modelBytes.graph,
   totalBytes:output.length+modelBytes.graph,
   steps:[...state.steps],leafCodec:codec===1?'zlib':'root-r01',
   encoded:output
  };
  if(!bestGraph||candidate.totalBytes<bestGraph.totalBytes||
     (candidate.totalBytes===bestGraph.totalBytes&&candidate.bytes<bestGraph.bytes)){
   bestGraph=candidate;
  }
 };
 for(let i=0;i<states.length;i++){
  const current=states[i];
  if(current.steps.length>0){
   consider(current,1,deflateSync(current.data,{level:9}));
   const result=rootCandidate(current.data);
   if(result)consider(current,2,result);
  }
  if(current.steps.length>=maxDepth)continue;
  for(const op of OPS){
   if(states.length>=maxStates)break;
   const data=applyStep(current.data,op),key=sha(data);
   edges++;
   if(visited.has(key))continue;
   visited.add(key);
   states.push({data,steps:[...current.steps,op]});
  }
 }
 if(bestGraph)candidates.push({
  method:bestGraph.method,bytes:bestGraph.bytes,
  modelBytes:bestGraph.modelBytes,totalBytes:bestGraph.totalBytes,
  steps:Object.freeze([...bestGraph.steps]),leafCodec:bestGraph.leafCodec
 });
 const priority=['raw','zlib','root-r01','transform-graph'];
 candidates.sort((a,b)=>a.totalBytes-b.totalBytes||
   priority.indexOf(a.method)-priority.indexOf(b.method));
 const winning=candidates[0];
 const chosen=winning.method==='transform-graph'?Buffer.from(bestGraph.encoded):null;
 const scored=Object.freeze(candidates.map(c=>Object.freeze({...c})));
 const summary=Object.freeze({
  schema:TRANSFORM_GRAPH_SCHEMA,revision:1,
  originalBytes:input.length,originalSha256:sha(input),
  visitedStates:states.length,attemptedEdges:edges,rootCalls,rootEvaluations,
  maxStates,maxDepth,maxRootCalls,
  candidates:scored,
  selectedMethod:winning.method,
  selectedTotalBytes:winning.totalBytes,
  savingsBytes:input.length-winning.totalBytes,
  chosenSteps:Object.freeze(chosen?[...bestGraph.steps]:[]),
  encodedSha256:chosen?sha(chosen):null,
  independentQA:'not-performed',
  archiveApproved:false,
  modelCostPolicy:'explicit charged per codec; decoder-distribution amortization not assumed'
 });
 return Object.freeze({
  report:summary,encoded:chosen,
  graphWouldWin:chosen!==null,
  executionAuthorized:false
 });
}
export const TRANSFORM_GRAPH_LIMITS=Object.freeze({
  maxBytes:LIMIT_BYTES,maxStates:64,maxDepth:3,maxRootCalls:32,
  maxRootEvaluations:40
});
