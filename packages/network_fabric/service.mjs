import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {loadState} from './lib/state.mjs';
import {sanitizeTopology,planRoute} from './lib/topology.mjs';
import {evaluateAccess} from './lib/policy.mjs';
const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const credential=process.env.ADA_INTERNAL_KEY||'';
if(credential.length<24)throw Error('missing_internal_key');
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const same=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
const actions={
 'network_fabric.status':'network_fabric.read',
 'network_fabric.topology':'network_fabric.read',
 'network_fabric.plan':'network_fabric.read',
 'network_fabric.evaluate':'network_fabric.evaluate'};
const nodes=[{id:'network_fabric.view',type:'view',title:'Network Fabric',icon:'network_fabric',requires:['network_fabric.read']},
 ...Object.entries(actions).map(([id,cap])=>({id,type:'action',title:id.split('.')[1],requires:[cap]}))];
const graph={app:'network_fabric',version:1,nodes,edges:Object.keys(actions).map(id=>({from:'network_fabric.view',to:id,type:'uses'}))};
async function readBody(req){return new Promise((resolve,reject)=>{let total=0;const chunks=[];req.on('data',d=>{
 total+=d.length;if(total>16384){reject(Error('body_too_large'));req.destroy();}else chunks.push(d);});
 req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(Error('bad_json'));}});req.on('error',reject);});}
const statePath=process.env.NETWORK_FABRIC_STATE||null;
async function invoke(action,params){
 if(!Object.hasOwn(actions,action)||!caps.has(actions[action]))return {error:'capability_unavailable'};
 if(action==='network_fabric.status') {
  if(!statePath)return {configured:false,state:'missing',mode:'read_only',enforcement:false};
  try {const state=await loadState(statePath);return {configured:true,state:'valid',revision:typeof state.revision==='string'?state.revision.slice(0,100):null,mode:'read_only',enforcement:false};}
  catch{return {configured:false,state:'invalid',mode:'read_only',enforcement:false};}
 }
 const s=await loadState(statePath);
 if(action==='network_fabric.topology')return {topology:sanitizeTopology(s),enforcement:false};
 if(action==='network_fabric.plan')return {plan:planRoute({topology:s,source:params.source,destination:params.destination}),enforcement:false};
 if(action==='network_fabric.evaluate')return {decision:evaluateAccess({flow:params.flow,policies:s.policies,approvals:s.approvals,trust:s.trust}),enforcement:false};
 return {error:'unsupported_action'};
}
const server=http.createServer(async(req,res)=>{
 const path=(req.url||'').split('?')[0];
 if(req.method==='GET'&&path==='/health')return send(res,200,{service:manifest.id,mode:'read_only',enforcement:false});
 if(!same(req.headers['x-internal-key'],credential))return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&path==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&path==='/invoke'){
  try{const body=await readBody(req),action=body?.action;
   if(!Object.hasOwn(actions,action)||!caps.has(actions[action]))return send(res,403,{error:'capability_unavailable'});
   return send(res,200,{result:await invoke(action,body.params||{})});
  }catch(e){return send(res,400,{error:String(e.message).slice(0,100)});}
 }
 return send(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||manifest.service.port);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_port');
server.listen(port,'127.0.0.1');
