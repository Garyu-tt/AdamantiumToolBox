import http from 'node:http';
import {issue,verify} from './policy.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const secret=process.env.MIKOSHI_SOURCE_SIGNING_KEY||'';
const enabled=Buffer.byteLength(secret)>=32;
const read='source.inspect',write='source.authorize';
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const ids={status:'mikoshi_sourcepolicy.status',
 authorize:'mikoshi_sourcepolicy.authorize',
 verify:'mikoshi_sourcepolicy.verify'};
function graph(){
 const nodes=[{id:'mikoshi_sourcepolicy.view',type:'view',icon:'studio',
  title:'Mikoshi Sensor Source Gate',requires:[read]},
 {id:ids.status,type:'action',title:'Source gate status',requires:[read]},
 {id:'mikoshi_sourcepolicy.provider',type:'resource',requires:[read],
  skill:{schema:'mikoshi.skill.v1',domain:'source-policy',actions:{
   status:ids.status,...(enabled?{verify:ids.verify}:{}),
   ...(enabled&&can(write)?{authorize:ids.authorize}:{})}}}];
 const edges=[{from:'mikoshi_sourcepolicy.view',
  to:'mikoshi_sourcepolicy.provider',type:'uses'},
  {from:'mikoshi_sourcepolicy.provider',to:ids.status,type:'provides'}];
 if(enabled){
  nodes.push({id:ids.verify,type:'action',title:'Verify lesson-bound permit',
   requires:[read]});
  edges.push({from:'mikoshi_sourcepolicy.provider',
   to:ids.verify,type:'provides'});
 }
 if(enabled&&can(write)){
  nodes.push({id:ids.authorize,type:'action',title:'Authorize asserted source',
   requires:[write]});
  edges.push({from:'mikoshi_sourcepolicy.provider',
   to:ids.authorize,type:'provides'});
 }
 return {app:'mikoshi_sourcepolicy',version:1,nodes,edges};
}
const send=(r,s,doc)=>{r.writeHead(s,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});r.end(JSON.stringify(doc));};
function invoke(b){
 if(!can(read))throw Error('capability_denied');
 if(b.action===ids.status)return {schema:'mikoshi.source.status.v1',
  enabled,ttlMs:60000,proofOfLegalConsent:false,oneTime:false};
 if(!enabled)throw Error('source_signing_key_missing');
 if(b.action===ids.authorize){
  if(!can(write))throw Error('capability_denied');
  return issue(secret,b.params?.claim,Date.now());
 }
 if(b.action===ids.verify)return verify(secret,
  b.params?.token,b.params?.digest,b.params?.purpose,Date.now());
 throw Error('action_unavailable');
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')
  return send(res,200,{app:'mikoshi_sourcepolicy'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>6500)req.destroy();});
  req.on('end',()=>{try{
   send(res,200,{result:invoke(JSON.parse(raw))});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8993),'127.0.0.1');
