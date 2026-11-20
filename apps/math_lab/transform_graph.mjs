/**
 * Mechanicus Math Lab R02: bounded best-first-ish BFS over reversible byte
 * transforms, with full wire-byte accounting and exact fallback baselines.
 *
 * No Node-RED runtime, AI execution, agent authority or archive integration.
 */
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
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
const MAGIC=Buffer.from(TRANSFORM_GRAPH_MAGIC,'ascii');
const LIMIT_BYTES=8192,OPS=Object.freeze([1,2,3,4,5]);
const sha=b=>createHash('sha256').update(b).digest('hex');
function checkInt(x,min,max,label){
 if(!Number.isSafeInteger(x)||x<min||x>max)throw new TypeError('Transform search invalid '+label);
 return x;
}
function numberBytes(value){
 checkInt(value,0,Number.MAX_SAFE_INTEGER,'varint');
 const result=[];
 do{let b=value%128;value=Math.floor(value/128);result.push(b+(value>0?128:0));}while(value);
 return Buffer.from(result);
}
function applyStep(input,op){
 const out=Buffer.allocUnsafe(input.length);
 if(op===1||op===2){
  if(input.length)out[0]=input[0];
  for(let i=1;i<input.length;i++){
   if(op===1)out[i]=input[i]^input[i-1];
   else out[i]=(input[i]-input[i-1]+256)&255;
  }
 }else if(op===3){
  let j=0;
  for(let i=0;i<input.length;i+=2)out[j++]=input[i];
  for(let i=1;i<input.length;i+=2)out[j++]=input[i];
 }else if(op===4){
  let i=0;
  for(;i+8<=input.length;i+=8){
   for(let bit=0;bit<8;bit++){
    let v=0;
    for(let row=0;row<8;row++)v|=((input[i+row]>>bit)&1)<<row;
    out[i+bit]=v;
   }
  }
  for(;i<input.length;i++)out[i]=input[i];
 }else if(op===5){
  for(let i=0;i<input.length;i++)out[i]=input[input.length-1-i];
 }else throw new TypeError('Unsupported transform step');
 return out;
}
function envelope(inputBytes,steps,codec,payload){
 return Buffer.concat([MAGIC,numberBytes(inputBytes),Buffer.from([steps.length,...steps,codec]),payload]);
}
function validOpts(opts){
 if(opts===null||typeof opts!=='object'||Array.isArray(opts))throw new TypeError('Invalid search options');
 const allowed=new Set(['maxDepth','maxStates','maxRootCalls','maxRootEvaluations','degrees','modelBytes']);
 for(const name of Object.keys(opts))if(!allowed.has(name))throw new TypeError('Unknown transform search option '+name);
 const maxDepth=checkInt(opts.maxDepth??2,0,3,'depth');
 const maxStates=checkInt(opts.maxStates??24,1,64,'states');
 const maxRootCalls=checkInt(opts.maxRootCalls??5,0,32,'root calls');
 const maxRootEvaluations=checkInt(opts.maxRootEvaluations??12,1,40,'root evaluations');
 const degrees=opts.degrees??[2,3,4,8,16,32,64,256,1000,1024,4096];
 if(!Array.isArray(degrees)||degrees.length>16||
   !degrees.every(k=>Number.isSafeInteger(k)&&k>=2&&k<=32768))throw new TypeError('Invalid degree set');
 const model=opts.modelBytes??{};
 if(model===null||typeof model!=='object'||Array.isArray(model))throw new TypeError('Invalid model costs');
 for(const key of Object.keys(model))if(!['zlib','root','graph'].includes(key))throw new TypeError('Unknown model cost');
 const modelBytes={
  zlib:checkInt(model.zlib??0,0,1_000_000,'zlib model cost'),
  root:checkInt(model.root??0,0,1_000_000,'root model cost'),
  graph:checkInt(model.graph??0,0,1_000_000,'graph model cost')
 };
 return {maxDepth,maxStates,maxRootCalls,maxRootEvaluations,degrees,modelBytes};
}
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
 // Count all actual bytes, including graph header, original length, steps,
 // codec discriminant and compressed leaf. Node/edge budget is hard bounded.
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
