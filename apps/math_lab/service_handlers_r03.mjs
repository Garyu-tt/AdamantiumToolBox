/** Pure bounded R03 ID-graph request handlers. */
import {GRAPH_PLAN_ABI,buildEncodeDecodeGraphs} from './operation_registry.mjs';
import {encodeOperationGraphFrame,decodeOperationGraphFrame,migrateLegacyMLG2} from './operation_graph_codec.mjs';
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
export function compilePlan(params){
 strictParams(params,['operationIds','codecId'],'operation_graph');
 return buildEncodeDecodeGraphs({
  schema:GRAPH_PLAN_ABI,operationIds:params.operationIds,codecId:params.codecId
 });
}
export function operationEncodeRequest(params){
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
export function operationDecodeRequest(params){
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
export function operationMigrateRequest(params){
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
