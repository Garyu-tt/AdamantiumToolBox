import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {loadSnapshot} from './lib/state.mjs';
import {preview,reverse} from './lib/plan.mjs';
const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const actions={
 'network_reconciler.status':'network_reconciler.read',
 'network_reconciler.preview':'network_reconciler.preview',
 'network_reconciler.rollbackPreview':'network_reconciler.preview'};
const nodes=[{id:'network_reconciler.view',type:'view',title:'Network Reconciler',icon:manifest.icon,requires:['network_reconciler.read']},
 ...Object.entries(actions).map(([id,permission])=>({id,type:'action',title:id.split('.')[1],requires:[permission]}))];
const graph={app:manifest.id,version:1,nodes,edges:Object.keys(actions).map(id=>({from:'network_reconciler.view',to:id,type:'uses'}))};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
const authenticated=raw=>{if(typeof raw!=='string')return false;const a=Buffer.from(raw),b=Buffer.from(secret);return a.length===b.length&&timingSafeEqual(a,b)};
function readJSON(req){return new Promise((done,fail)=>{let n=0;const chunks=[];
 req.on('data',b=>{n+=b.length;if(n>65536){fail(Error('body_too_large'));req.destroy()}else chunks.push(b)});
 req.on('end',()=>{try{done(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{fail(Error('invalid_json'))}});req.on('error',fail);
});}
async function perform(action,params){
 if(action==='network_reconciler.status'){
  try{const s=await loadSnapshot(process.env.NETWORK_RECONCILER_STATE);return {configured:true,node:s.node,revision:s.revision,mode:'preview_only',enforcement:false};}
  catch{return {configured:false,mode:'preview_only',enforcement:false};}
 }
 const state=await loadSnapshot(process.env.NETWORK_RECONCILER_STATE);
 if(action==='network_reconciler.preview')return preview({schema:'network-reconciler-state-v1',...state},params.desired,params.expectedRevision);
 if(action==='network_reconciler.rollbackPreview')return reverse({schema:'network-reconciler-state-v1',...state},params.plan);
 throw Error('unsupported_action');
}
const server=http.createServer(async(req,res)=>{
 const path=(req.url||'').split('?')[0];
 if(req.method==='GET'&&path==='/health')return send(res,200,{app:manifest.id,mode:'preview_only'});
 if(!authenticated(req.headers['x-internal-key']))return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&path==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&path==='/invoke'){
  try{const body=await readJSON(req);if(!Object.hasOwn(actions,body?.action)||!caps.has(actions[body.action]))return send(res,403,{error:'capability_unavailable'});
   return send(res,200,{result:await perform(body.action,body.params||{})});}
  catch(e){return send(res,400,{error:String(e.message).slice(0,100)});}
 }
 return send(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||manifest.service.port);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_port');
server.listen(port,'127.0.0.1');
