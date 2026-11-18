import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {proposal,inspect} from './lib/contracts.mjs';
import {loadState} from './lib/state.mjs';
const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const actions={
 'network_policy.status':'network_policy.read',
 'network_policy.proposal':'network_policy.read',
 'network_policy.inspect':'network_policy.evaluate'};
const nodes=[{id:'network_policy.view',type:'view',title:'Network Policy Manager',icon:manifest.icon,requires:['network_policy.read']},
 ...Object.entries(actions).map(([id,permission])=>({id,type:'action',title:id.split('.')[1],requires:[permission]}))];
const graph={app:manifest.id,version:1,nodes,edges:Object.keys(actions).map(id=>({from:'network_policy.view',to:id,type:'uses'}))};
function allowed(got){if(typeof got!=='string')return false;const a=Buffer.from(got),b=Buffer.from(secret);return a.length===b.length&&timingSafeEqual(a,b);}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function readJSON(req){return new Promise((done,fail)=>{const parts=[];let n=0;req.on('data',b=>{n+=b.length;if(n>16384){fail(Error('body_too_large'));req.destroy();}else parts.push(b)});req.on('end',()=>{try{done(JSON.parse(Buffer.concat(parts).toString('utf8')))}catch{fail(Error('invalid_json'))}});req.on('error',fail)});}
async function call(action,params){
 if(action==='network_policy.status'){
  try{const s=await loadState(process.env.NETWORK_POLICY_STATE);return {configured:true,revision:s.revision,mode:'read_only',enforcement:false};}
  catch{return {configured:false,mode:'read_only',enforcement:false};}
 }
 if(action==='network_policy.proposal')return proposal(params.flow,params.revision,params.expiresAt);
 if(action==='network_policy.inspect'){
  const state=await loadState(process.env.NETWORK_POLICY_STATE);
  return inspect({flow:params.flow,state,expectedRevision:params.expectedRevision});
 }
 throw Error('unsupported_action');
}
const server=http.createServer(async(req,res)=>{
 const path=(req.url||'').split('?')[0];
 if(req.method==='GET'&&path==='/health')return send(res,200,{app:manifest.id,mode:'read_only'});
 if(!allowed(req.headers['x-internal-key']))return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&path==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&path==='/invoke'){
  try{const data=await readJSON(req);if(!Object.hasOwn(actions,data?.action)||!caps.has(actions[data.action]))return send(res,403,{error:'capability_unavailable'});
   return send(res,200,{result:await call(data.action,data.params||{})});}
  catch(e){return send(res,400,{error:String(e.message).slice(0,100)});}
 }
 return send(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||manifest.service.port);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_port');
server.listen(port,'127.0.0.1');
