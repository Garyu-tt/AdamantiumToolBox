/** MAS Math Lab optional loopback transport; only Core-approved capabilities. */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {MATH_LAB_DOMAINS,MATH_LAB_DISCIPLINES,MATH_LAB_RESEARCH_ROLES} from './experiment.mjs';
import {createResearchPlan} from './research_plan.mjs';
import {getOperationCatalog} from './operation_registry.mjs';
import {experimentRequest,searchRequest,reproduceRequest} from './service_handlers_core.mjs';
import {compilePlan,operationEncodeRequest,operationDecodeRequest,operationMigrateRequest} from './service_handlers_r03.mjs';
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
