import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {validateFunction,prepareInvocation} from './contract.mjs';
import {composeFunction,planPublication,prepareReconciliation,validateIncident} from './pipeline.mjs';
import {negotiateProviders} from './negotiation.mjs';
import {projectEvents} from './events.mjs';
import {prepareIntegration,assessVisibility} from './integration.mjs';
const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const protocol=JSON.parse(await readFile(new URL('./protocol.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const grants=new Set((process.env.ADA_CAPS||'').split(','));
const actionNodes=[
 {id:'forge.describe',title:'Describe Forge adapter',permission:'forge.read'},
 {id:'forge.validate',title:'Validate atomic function',permission:'forge.validate'},
 {id:'forge.prepare',title:'Prepare capability request',permission:'forge.validate'},
 {id:'forge.compose',title:'Compose graph/UI intents',permission:'forge.validate'},
 {id:'forge.publication.plan',title:'Plan verified publication',permission:'forge.validate'},
 {id:'forge.reconcile.prepare',title:'Prepare invalidation/revisit',permission:'forge.validate'},
 {id:'forge.incident.validate',title:'Validate explained blocker',permission:'forge.validate'},
 {id:'forge.providers.negotiate',title:'Negotiate external capability offers',permission:'forge.validate'},
 {id:'forge.events.project',title:'Project external revision events',permission:'forge.validate'},
 {id:'forge.integration.prepare',title:'Prepare authorized host dispatch intents',permission:'forge.validate'},
 {id:'forge.visibility.assess',title:'Cross-check external publication/UI receipts',permission:'forge.validate'}
];
const graph={app:manifest.id,version:1,nodes:[
 {id:'forge.view',type:'view',title:'Forge Contracts',icon:manifest.icon,requires:['forge.read']},
 {id:'forge.protocol',type:'resource',requires:['forge.read'],schema:protocol.schema},
 ...actionNodes.map(n=>({id:n.id,type:'action',title:n.title,requires:[n.permission]}))
],edges:[...actionNodes.map(n=>({from:'forge.view',to:n.id,type:'uses'})),
 {from:'forge.view',to:'forge.protocol',type:'uses'}]};
const send=(res,status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));};
function invoke(body){
 const spec=actionNodes.find(a=>a.id===body?.action);
 if(!spec)return {status:404,payload:{error:'unknown_action'}};
 if(!grants.has(spec.permission))return {status:403,payload:{error:'capability_denied'}};
 const result=spec.id==='forge.describe'?protocol:
  spec.id==='forge.validate'?validateFunction(body.params?.function):
  spec.id==='forge.prepare'?prepareInvocation(body.params):
  spec.id==='forge.compose'?composeFunction(body.params):
  spec.id==='forge.publication.plan'?planPublication(body.params):
  spec.id==='forge.reconcile.prepare'?prepareReconciliation(body.params):
  spec.id==='forge.incident.validate'?validateIncident(body.params):
  spec.id==='forge.providers.negotiate'?negotiateProviders(body.params):
  spec.id==='forge.events.project'?projectEvents(body.params):
  spec.id==='forge.integration.prepare'?prepareIntegration(body.params):assessVisibility(body.params);
 return {status:200,payload:{result}};
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:manifest.id,role:'adapter'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',size=0,oversize=false;
  req.on('data',chunk=>{size+=chunk.length;
   if(size>65536){oversize=true;return;}
   raw+=chunk.toString('utf8');});
  req.on('end',()=>{
   if(oversize)return send(res,413,{error:'request_too_large'});
   try{const result=invoke(JSON.parse(raw));send(res,result.status,result.payload);}
   catch{return send(res,400,{error:'malformed_json'});}
  });return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
