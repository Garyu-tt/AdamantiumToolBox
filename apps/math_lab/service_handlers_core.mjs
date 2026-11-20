/** Pure bounded R01/R02 scientific experiment request handlers. */
import {runCompressionExperiment} from './experiment.mjs';
import {searchReversibleTransforms} from './transform_graph.mjs';
import {verifyGraphAgainstOriginal} from './reference_verify.mjs';
export function experimentRequest(params){
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

export function searchRequest(params){
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
export function reproduceRequest(params){
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

