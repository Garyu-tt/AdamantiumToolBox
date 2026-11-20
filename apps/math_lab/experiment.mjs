/**
 * Mechanicus Math Lab — reproducible CPU-first exact-compression experiment.
 * No persistence, untrusted code execution, external model access or network.
 * SPDX-License-Identifier: Apache-2.0
 */
import {createHash} from 'node:crypto';
import {deflateSync,inflateSync} from 'node:zlib';
import {tryRootTransform,decodeRootTransform,ROOT_TRANSFORM_ABI} from './root_transform.mjs';

export const EXPERIMENT_SCHEMA='mechanicus.math-experiment/1';
const IDENT=/^[a-z][a-z0-9._:-]{0,95}$/;
const TARGETS=Object.freeze(['compression','alt','genesis','noosphere','graph-brain','toolbox','general']);
const DISCIPLINES=Object.freeze([
 'information-theory','probability','linear-algebra','abstract-algebra',
 'number-theory','combinatorics','analysis','spectral-analysis',
 'graph-theory','algorithmic-information-theory'
]);
const sha=b=>createHash('sha256').update(b).digest('hex');
function fail(message){throw new TypeError('Math Lab: '+message);}
const id=(value,name)=>{if(typeof value!=='string'||!IDENT.test(value))fail('invalid '+name);return value;};
function bytesCost(value,name){
 if(!Number.isSafeInteger(value)||value<0||value>1000000)fail('invalid '+name);
 return value;
}
export function shannonBitsPerByte(data){
 if(!Buffer.isBuffer(data))fail('entropy source not Buffer');
 if(data.length===0)return 0;
 const bins=new Uint32Array(256);
 for(const value of data)bins[value]++;
 let h=0;
 for(const n of bins)if(n!==0){const p=n/data.length;h-=p*Math.log2(p);}
 return h;
}
/**
 * Hypothesis metadata is a proposed research protocol, not a claim that
 * researchers, independent auditors or benchmark corpora have run.
 */
export function validateHypothesis(spec){
 if(spec===null||typeof spec!=='object'||Array.isArray(spec))fail('invalid hypothesis');
 const allowed=['schema','id','title','target','discipline','method','datasetId','claim','sourceRefs'];
 for(const key of Object.keys(spec))if(!allowed.includes(key))fail('unexpected hypothesis field');
 if(spec.schema!=='mechanicus.math-hypothesis/1')fail('hypothesis schema');
 id(spec.id,'hypothesis ID');id(spec.datasetId,'dataset ID');
 for(const field of ['title','claim']){
  if(typeof spec[field]!=='string'||!spec[field].trim()||spec[field].length>320)fail('invalid '+field);
 }
 if(!TARGETS.includes(spec.target)||!DISCIPLINES.includes(spec.discipline))fail('unknown research domain');
 if(!['root-transform','entropy-bound','generic-analysis'].includes(spec.method))fail('unsupported method');
 if(!Array.isArray(spec.sourceRefs)||spec.sourceRefs.length>16||
   !spec.sourceRefs.every(x=>typeof x==='string'&&x.length<=256))fail('invalid literature refs');
 return Object.freeze({...spec,sourceRefs:Object.freeze([...spec.sourceRefs])});
}
/**
 * Compares complete standalone stream sizes, not the shortness of equations.
 * root includes magic+length+node tree; zlib includes its own zlib wrapper;
 * model charges are explicit additional per-experiment MDL assumptions.
 * No "independent QA passed" without a separate verifier/receipt.
 */
export function runCompressionExperiment(data,{
 datasetId='sample',degrees=[2,3,4,5,8,16,32,64,128,256,512,1000,1024,2048,4096],
 maxDepth=2,maxEvaluations=40,
 rootModelBytes=0,zlibModelBytes=0
}={}){
 if(!Buffer.isBuffer(data)||data.length>8192)fail('input must be bounded Buffer');
 id(datasetId,'dataset ID');
 const rootOverhead=bytesCost(rootModelBytes,'root model bytes');
 const zlibOverhead=bytesCost(zlibModelBytes,'zlib model bytes');
 const attempt=tryRootTransform(data,{degrees,maxDepth,maxEvaluations});
 const root=attempt.compressed;
 const reconstructed=root?decodeRootTransform(root):Buffer.from(data);
 if(!reconstructed.equals(data))throw new Error('RootTransform lossless verification failed');
 const zlib=deflateSync(data,{level:9});
 if(!inflateSync(zlib).equals(data))throw new Error('zlib baseline verification failed');
 const available=[
  {method:'raw',storedBytes:data.length,modelBytes:0,totalBytes:data.length},
  {method:'root-transform',storedBytes:root?.length??null,
   modelBytes:rootOverhead,totalBytes:root?root.length+rootOverhead:null},
  {method:'zlib',storedBytes:zlib.length,modelBytes:zlibOverhead,
   totalBytes:zlib.length+zlibOverhead}
 ];
 const ranked=available.filter(x=>x.totalBytes!==null)
  .sort((a,b)=>a.totalBytes-b.totalBytes||
    ['raw','zlib','root-transform'].indexOf(a.method)-
    ['raw','zlib','root-transform'].indexOf(b.method));
 const winner=ranked[0];
 const profile=Object.freeze({
  schema:EXPERIMENT_SCHEMA,revision:1,domain:'compression',
  datasetId,inputSha256:sha(data),originalBytes:data.length,
  entropyBitsPerByte:Number(shannonBitsPerByte(data).toFixed(6)),
  transform:ROOT_TRANSFORM_ABI,
  search:Object.freeze({maxDepth,maxEvaluations,evaluated:attempt.evaluated,
   degrees:Object.freeze([...new Set(degrees)])}),
  candidates:Object.freeze(available.map(x=>Object.freeze({...x}))),
  selected:winner.method,selectedTotalBytes:winner.totalBytes,
  savingsBytes:data.length-winner.totalBytes,
  selectedSmallerThanOriginal:winner.totalBytes<data.length,
  rootByteStreamSha256:root?sha(root):null,
  verification:Object.freeze({
   exactRootRoundtrip:true,exactZlibRoundtrip:true,
   originalDigestMatches:sha(reconstructed)===sha(data),
   independentAudit:'not-performed',
   approvedForProduction:false
  }),
  modelCostPolicy:'explicit per-block charged bytes; shared decoder implementation not automatically amortized',
  caveat:'single dataset is not representative; no universal compression guarantee'
 });
 return Object.freeze({...profile,
  experimentDigest:sha(Buffer.from(JSON.stringify(profile)))});
}
export const MATH_LAB_DOMAINS=TARGETS;
export const MATH_LAB_DISCIPLINES=DISCIPLINES;
export const MATH_LAB_RESEARCH_ROLES=Object.freeze([
 'literature-analyst','mathematical-theorist','experimentalist',
 'independent-reproducer','qa-auditor','noosphere-archivist'
]);
