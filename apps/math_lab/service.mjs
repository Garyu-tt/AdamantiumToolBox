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

const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const available={
 'math_lab.catalog':'math_lab.read',
 'math_lab.experiment':'math_lab.experiment'
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
async function invoke(action,params){
 if(!Object.hasOwn(available,action)||!caps.has(available[action]))throw Error('capability_denied');
 if(action==='math_lab.catalog')return {
  schema:'mechanicus.math-lab-catalog/1',
  disciplines:MATH_LAB_DISCIPLINES,
  researchTargets:MATH_LAB_DOMAINS,
  researchRoles:MATH_LAB_RESEARCH_ROLES,
  experiments:[{id:'root-transform',type:'bounded-lossless',status:'experimental'}],
  agentsRunning:0,
  researchOutcomes:'not-an-independent-audit',
  persistence:'none',
  noosphereSync:'not-enabled',
  productionEnabled:false
 };
 if(action==='math_lab.experiment')return experimentRequest(params);
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
