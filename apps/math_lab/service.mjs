/**
 * Mechanicus Math Lab 0.1: opt-in MAS app, loopback-only.
 * The only executable action is a bounded CPU-first mathematical experiment.
 * No dynamic code, no filesystem access, no model downloads or remote providers.
 */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {
 runCompressionExperiment,MATH_LAB_DOMAINS,
 MATH_LAB_DISCIPLINES,MATH_LAB_RESEARCH_ROLES
} from './experiment.mjs';
import {createResearchPlan} from './research_plan.mjs';
import {searchReversibleTransforms} from './transform_graph.mjs';
import {verifyGraphAgainstOriginal} from './reference_verify.mjs';
import {GRAPH_PLAN_ABI,getOperationCatalog,buildEncodeDecodeGraphs} from './operation_registry.mjs';
import {encodeOperationGraphFrame,decodeOperationGraphFrame,migrateLegacyMLG2} from './operation_graph_codec.mjs';

const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const available={
 'math_lab.catalog':'math_lab.read',
 'math_lab.plan':'math_lab.read',
 'math_lab.experiment':'math_lab.experiment',
 'math_lab.search':'math_lab.experiment',
 'math_lab.reproduce':'math_lab.verify',
 'math_lab.operations':'math_lab.read',
 'math_lab.graph':'math_lab.read',
 'math_lab.encode':'math_lab.experiment',
 'math_lab.decode':'math_lab.verify',
 'math_lab.migrate':'math_lab.verify'
};
const nodes=[
 ...(caps.has('math_lab.read')?[{
  id:'math_lab.view',type:'view',title:manifest.name,
  icon:manifest.icon,requires:['math_lab.read']
 }]:[]),
 ...Object.entries(available).filter(([,permission])=>caps.has(permission))
  .map(([id,permission])=>({id,type:'action',title:id,requires:[permission]}))
];
const graph={app:manifest.id,version:1,nodes,
 edges:nodes.filter(n=>n.type==='action'&&nodes.some(x=>x.id==='math_lab.view'))
  .map(n=>({from:'math_lab.view',to:n.id,type:'uses'}))};
function response(res,code,body){
 res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify(body));
}
function experimentRequest(params){
 if(!params||typeof params!=='object'||Array.isArray(params))throw Error('invalid_experiment');
 const fields=new Set([
  'datasetId','inputHex','degrees','maxDepth','maxEvaluations',
  'rootModelBytes','zlibModelBytes'
 ]);
 for(const key of Object.keys(params))if(!fields.has(key))throw Error('unexpected_experiment_field');
 if(typeof params.inputHex!=='string'||params.inputHex.length>4096||
  params.inputHex.length%2!==0||!/^[0-9a-f]*$/.test(params.inputHex)){
  throw Error('invalid_input_hex');
 }
 if(params.maxDepth!==undefined&&(!Number.isInteger(params.maxDepth)||
   params.maxDepth<0||params.maxDepth>2))throw Error('depth_budget');
 if(params.maxEvaluations!==undefined&&(!Number.isInteger(params.maxEvaluations)||
   params.maxEvaluations<1||params.maxEvaluations>40))throw Error('evaluation_budget');
 if(params.degrees!==undefined&&(!Array.isArray(params.degrees)||
   params.degrees.length>16))throw Error('degree_budget');
 return runCompressionExperiment(Buffer.from(params.inputHex,'hex'),{
  datasetId:params.datasetId,
  degrees:params.degrees,
  maxDepth:params.maxDepth,
  maxEvaluations:params.maxEvaluations,
  rootModelBytes:params.rootModelBytes,
  zlibModelBytes:params.zlibModelBytes
 });
}

function searchRequest(params){
 if(!params||typeof params!=='object'||Array.isArray(params))throw Error('invalid_search');
 const fields=new Set([
  'datasetId','inputHex','maxDepth','maxStates','maxRootCalls',
  'maxRootEvaluations','degrees','modelBytes','includeEncoded'
 ]);
 for(const k of Object.keys(params))if(!fields.has(k))throw Error('unexpected_search_field');
 const inputHex=params.inputHex;
 if(typeof inputHex!=='string'||inputHex.length>4096||
    inputHex.length%2!==0||!/^[0-9a-f]*$/.test(inputHex))throw Error('invalid_input_hex');
 const data=Buffer.from(inputHex,'hex');
 if(params.maxDepth!==undefined&&(!Number.isInteger(params.maxDepth)||
    params.maxDepth<0||params.maxDepth>2))throw Error('invalid_depth_budget');
 if(params.maxStates!==undefined&&(!Number.isInteger(params.maxStates)||
    params.maxStates<1||params.maxStates>24))throw Error('invalid_state_budget');
 if(params.maxRootCalls!==undefined&&(!Number.isInteger(params.maxRootCalls)||
    params.maxRootCalls<0||params.maxRootCalls>8))throw Error('invalid_root_budget');
 if(params.maxRootEvaluations!==undefined&&(!Number.isInteger(params.maxRootEvaluations)||
    params.maxRootEvaluations<1||params.maxRootEvaluations>16))throw Error('invalid_eval_budget');
 if(params.degrees!==undefined&&(!Array.isArray(params.degrees)||
    params.degrees.length>12))throw Error('invalid_degree_budget');
 if(params.includeEncoded!==undefined&&typeof params.includeEncoded!=='boolean')throw Error('invalid_encoding_export');
 const result=searchReversibleTransforms(data,{
  maxDepth:params.maxDepth,maxStates:params.maxStates,
  maxRootCalls:params.maxRootCalls,maxRootEvaluations:params.maxRootEvaluations,
  degrees:params.degrees,modelBytes:params.modelBytes
 });
 const receipt=result.encoded
  ?verifyGraphAgainstOriginal(result.encoded,data,{datasetId:params.datasetId??'sample'})
  :null;
 return Object.freeze({
  report:result.report,
  referenceReproduction:receipt,
  // Encoded data is reversible and potentially sensitive; explicit opt-in only.
  encodedHex:params.includeEncoded===true&&result.encoded?result.encoded.toString('hex'):null,
  independentAgentReviewed:false,independentQACompleted:false,
  authorizedExecution:false
 });
}
function reproduceRequest(params){
 if(!params||typeof params!=='object'||Array.isArray(params))throw Error('invalid_reproduction');
 const fields=new Set(['datasetId','originalHex','encodedHex']);
 for(const k of Object.keys(params))if(!fields.has(k))throw Error('unexpected_reproduction_field');
 for(const field of ['originalHex','encodedHex']){
  if(typeof params[field]!=='string'||params[field].length>16384||
     params[field].length%2!==0||!/^[0-9a-f]*$/.test(params[field]))throw Error('invalid_'+field);
 }
 return verifyGraphAgainstOriginal(
  Buffer.from(params.encodedHex,'hex'),
  Buffer.from(params.originalHex,'hex'),
  {datasetId:params.datasetId??'sample'}
 );
}

function strictParams(params,fields,name){
 if(!params||typeof params!=='object'||Array.isArray(params))throw Error('invalid_'+name);
 for(const field of Object.keys(params))
  if(!fields.includes(field))throw Error('unexpected_'+name+'_field');
}
function strictHex(hex,max=4096){
 if(typeof hex!=='string'||hex.length>max||hex.length%2!==0||!/^[a-f0-9]*$/.test(hex))
  throw Error('invalid_bounded_hex');
 return Buffer.from(hex,'hex');
}
function compilePlan(params){
 strictParams(params,['operationIds','codecId'],'operation_graph');
 return buildEncodeDecodeGraphs({
  schema:GRAPH_PLAN_ABI,operationIds:params.operationIds,codecId:params.codecId
 });
}
function operationEncodeRequest(params){
 strictParams(params,[
  'inputHex','operationIds','codecId','includeEncoded',
  'rootDegrees','maxRootEvaluations'
 ],'operation_encode');
 if(params.includeEncoded!==undefined&&typeof params.includeEncoded!=='boolean')
  throw Error('invalid_include_encoded');
 if(params.rootDegrees!==undefined&&
   (!Array.isArray(params.rootDegrees)||params.rootDegrees.length>12))
  throw Error('root_degree_budget');
 if(params.maxRootEvaluations!==undefined&&
   (!Number.isInteger(params.maxRootEvaluations)||params.maxRootEvaluations<1||
    params.maxRootEvaluations>16))throw Error('root_eval_budget');
 const input=strictHex(params.inputHex);
 const plan={
  schema:GRAPH_PLAN_ABI,operationIds:params.operationIds,codecId:params.codecId
 };
 const result=encodeOperationGraphFrame(input,plan,{
  rootDegrees:params.rootDegrees,maxRootEvaluations:params.maxRootEvaluations
 });
 return {
  schema:'mechanicus.math-operation-encoded/1',
  inputBytes:input.length,encodedBytes:result.bytes,
  encodedSha256:result.sha256,
  operationRegistrySha256:result.graphs.registrySha256,
  graphs:result.graphs,
  // This is lossless/reversible and can disclose input data: default is no.
  encodedHex:params.includeEncoded===true?result.frame.toString('hex'):null,
  independentQACompleted:false,authorizedExecution:false
 };
}
function operationDecodeRequest(params){
 strictParams(params,['encodedHex','expectedSha256','includeDecoded'],'operation_decode');
 if(params.includeDecoded!==undefined&&typeof params.includeDecoded!=='boolean')
  throw Error('invalid_include_decoded');
 if(params.expectedSha256!==undefined&&
  (typeof params.expectedSha256!=='string'||!/^[0-9a-f]{64}$/.test(params.expectedSha256)))
  throw Error('invalid_expected_sha256');
 const encoded=strictHex(params.encodedHex,4600);
 const result=decodeOperationGraphFrame(encoded,{maxOutputBytes:2048});
 if(params.expectedSha256!==undefined&&params.expectedSha256!==result.sourceSha256)
  throw Error('source_digest_mismatch');
 return {
  schema:'mechanicus.math-operation-decoded/1',
  decodedBytes:result.data.length,
  sourceSha256:result.sourceSha256,encodedSha256:result.encodedSha256,
  operationRegistrySha256:result.graphs.registrySha256,
  graphs:result.graphs,checksumVerified:result.checksumVerified,
  // Separate permission, explicit opt-in for raw bytes.
  decodedHex:params.includeDecoded===true?result.data.toString('hex'):null,
  authenticated:false,independentQACompleted:false,
  authorizedExecution:false
 };
}
function operationMigrateRequest(params){
 strictParams(params,['encodedHex','includeEncoded'],'operation_migrate');
 if(params.includeEncoded!==undefined&&typeof params.includeEncoded!=='boolean')
  throw Error('invalid_include_encoded');
 const old=strictHex(params.encodedHex,4600);
 const result=migrateLegacyMLG2(old,{maxOutputBytes:2048});
 return {
  schema:'mechanicus.math-operation-migration/1',
  preservedExactly:result.preservedExactly,
  originalSha256:result.originalSha256,
  legacySha256:result.legacySha256,
  migratedSha256:result.migratedSha256,
  operationRegistrySha256:result.plan.registrySha256,
  graphPair:buildEncodeDecodeGraphs({schema:result.plan.schema,operationIds:result.plan.operationIds,codecId:result.plan.codecId}),
  frameBytes:result.frame.length,
  frameHex:params.includeEncoded===true?result.frame.toString('hex'):null,
  independentQACompleted:false,authorizedExecution:false
 };
}
async function invoke(action,params){
 if(!Object.hasOwn(available,action)||!caps.has(available[action]))throw Error('capability_denied');
 if(action==='math_lab.catalog')return {
  schema:'mechanicus.math-lab-catalog/1',
  disciplines:MATH_LAB_DISCIPLINES,
  researchTargets:MATH_LAB_DOMAINS,
  researchRoles:MATH_LAB_RESEARCH_ROLES,
  experiments:[{id:'root-transform',type:'bounded-lossless',status:'experimental'},
   {id:'transform-graph',type:'bounded-lossless-search',status:'experimental'}],
  reproduction:'separately-coded-reference-verifier; independent agent QA not performed',
  planSchema:'mechanicus.math-research-plan/1',
  operationRegistry:'mechanicus.math-operation-registry/1',
  graphFrame:'mechanicus.math-graph-frame/3',
  agentsRunning:0,
  researchOutcomes:'not-an-independent-audit',
  persistence:'none',
  noosphereSync:'not-enabled',
  productionEnabled:false
 };
 if(action==='math_lab.plan')return createResearchPlan(params);
 if(action==='math_lab.experiment')return experimentRequest(params);
 if(action==='math_lab.search')return searchRequest(params);
 if(action==='math_lab.reproduce')return reproduceRequest(params);
 if(action==='math_lab.operations')return getOperationCatalog();
 if(action==='math_lab.graph')return compilePlan(params);
 if(action==='math_lab.encode')return operationEncodeRequest(params);
 if(action==='math_lab.decode')return operationDecodeRequest(params);
 if(action==='math_lab.migrate')return operationMigrateRequest(params);
 throw Error('action_not_found');
}
http.createServer(async(req,res)=>{
 if(req.method==='GET'&&req.url==='/health'){
  return response(res,200,{app:manifest.id,version:manifest.version});
 }
 if(req.headers['x-internal-key']!==secret){
  return response(res,401,{error:'unauthorized'});
 }
 if(req.method==='GET'&&req.url==='/graph'){
  return response(res,200,graph);
 }
 if(req.method==='POST'&&req.url==='/invoke'){
  let chunks=[],size=0,overflow=false;
  req.on('data',chunk=>{
   size+=chunk.length;
   if(size>12000){overflow=true;req.destroy();return;}
   chunks.push(chunk);
  });
  req.on('end',async()=>{
   if(overflow)return;
   try{
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    response(res,200,{result:await invoke(body.action,body.params||{})});
   }catch(err){
    response(res,400,{error:String(err.message).slice(0,160)});
   }
  });
  return;
 }
 response(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT??manifest.service.port),'127.0.0.1');
