// SPDX-License-Identifier: Apache-2.0
// Host-delegated MAS app. No standalone public API, no privileged apply.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {openFactoryAnchor} from './lib/store.mjs';

const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(Buffer.byteLength(secret)<24)throw Error('host_internal_key_required');
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const actions={
 'factory_anchor.status':'factory_anchor.read',
 'factory_anchor.latest':'factory_anchor.read',
 'factory_anchor.inspect':'factory_anchor.read',
 'factory_anchor.attest':'factory_anchor.attest'
};
const availableParams={
 root:process.env.FACTORY_ANCHOR_ROOT||'',
 anchorPin:process.env.FACTORY_ANCHOR_PUBLIC_PIN||'',
 sourcePin:process.env.FACTORY_ANCHOR_SOURCE_PIN||'',
 ledgerId:process.env.FACTORY_ANCHOR_LEDGER_ID||'',
 allowSigning:process.env.FACTORY_ANCHOR_ALLOW_SIGNING==='yes'
};
let anchor=null,bootError='not_configured';
try{anchor=openFactoryAnchor(availableParams);await anchor.status();bootError=null;}
catch(e){bootError=String(e.code||e.message).slice(0,70);}
const allowedKey=v=>typeof v==='string'&&
 Buffer.byteLength(v)===Buffer.byteLength(secret)&&
 timingSafeEqual(Buffer.from(v),Buffer.from(secret));
const respond=(res,status,data)=>{
 res.writeHead(status,{
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'",
  'X-Frame-Options':'DENY'
 });
 res.end(JSON.stringify(data));
};
const body=(req)=>new Promise((ok,bad)=>{
 let length=0,done=false;const chunks=[];
 req.on('data',chunk=>{
  if(done)return;
  length+=chunk.length;
  if(length>262144){
   done=true;bad(Error('body_too_large'));req.destroy();
  }else chunks.push(chunk);
 });
 req.on('end',()=>{
  if(done)return;
  try{ok(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
  catch{bad(Error('invalid_json'));}
 });
 req.on('error',bad);
});
async function ready(){
 if(!anchor)return false;
 try{await anchor.status();bootError=null;return true;}
 catch(e){bootError=String(e.code||e.message).slice(0,70);return false;}
}
const graph=(valid)=>({
 app:manifest.id,version:1,
 nodes:[
  {id:'factory_anchor.view',type:'view',
   title:'Factory Independent Audit Anchor',
   icon:manifest.icon,requires:['factory_anchor.read']},
  {id:'factory_anchor.status',type:'action',title:'Status',
   requires:['factory_anchor.read']},
  ...(valid?[
   {id:'factory_anchor.latest',type:'action',title:'Latest signed checkpoint',
    requires:['factory_anchor.read']},
   {id:'factory_anchor.inspect',type:'action',title:'Verify public evidence',
    requires:['factory_anchor.read']},
   ...(anchor?.allowSigning?[
    {id:'factory_anchor.attest',type:'action',title:'Sign next evidence',
     requires:['factory_anchor.attest']}
   ]:[])
  ]:[])
 ],
 edges:(valid?
  ['factory_anchor.status','factory_anchor.latest','factory_anchor.inspect',
   ...(anchor?.allowSigning?['factory_anchor.attest']:[])]:
  ['factory_anchor.status']).map(to=>({
   from:'factory_anchor.view',to,type:'uses'
  }))
});
const invoke=async(action,params,valid)=>{
 if(action==='factory_anchor.status')
  return valid?await anchor.status():{
   schema:'adamantium.factory_anchor.status/1',
   configured:false,reason:bootError,
   masApprovalGranted:false,productionPublished:false,enforcement:false
  };
 if(!valid)throw Error('factory_anchor_unavailable');
 if(action==='factory_anchor.latest')return anchor.latest();
 if(action==='factory_anchor.inspect')return anchor.inspect(params);
 if(action==='factory_anchor.attest')return anchor.attest(params);
 throw Error('unsupported_action');
};
const server=http.createServer(async(req,res)=>{
 const path=(req.url||'').split('?')[0];
 if(req.method==='GET'&&path==='/health')return respond(res,200,{
  app:manifest.id,version:manifest.version,mode:'audit_only',
  permissionToPublish:false
 });
 if(!allowedKey(req.headers['x-internal-key']))
  return respond(res,401,{error:'unauthorized'});
 // The host token is not a CORS capability, and a browser origin must not
 // smuggle write requests via an authenticated ambient session.
 if(req.headers.origin)return respond(res,403,{error:'browser_origin_not_authorized'});
 if(req.method==='GET'&&path==='/graph'){
  return respond(res,200,graph(await ready()));
 }
 if(req.method==='POST'&&path==='/invoke'){
  try{
   const data=await body(req);
   const valid=await ready();
   if(!data||typeof data!=='object'||Array.isArray(data)||
      typeof data.action!=='string'||!Object.hasOwn(actions,data.action)||
      !caps.has(actions[data.action])||
      (!valid&&data.action!=='factory_anchor.status')||
      (data.action==='factory_anchor.attest'&&!anchor?.allowSigning))
    return respond(res,403,{error:'capability_unavailable'});
   const params=data.params||{};
   if(!params||typeof params!=='object'||Array.isArray(params))
    return respond(res,422,{error:'invalid_params'});
   const result=await invoke(data.action,params,valid);
   return respond(res,200,{result});
  }catch(e){
   const reason=String(e?.code||e?.message||'operation_failed').slice(0,90);
   const status=reason==='revision_conflict'?409:
    reason==='factory_anchor_lease_busy'?429:422;
   return respond(res,status,{error:reason});
  }
 }
 return respond(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||manifest.service.port);
if(!Number.isInteger(port)||port<1024||port>65535)
 throw Error('invalid_factory_anchor_listen_port');
server.listen(port,'127.0.0.1');
function shutdown(){
 server.close(()=>process.exit(0));
}
process.once('SIGINT',shutdown);
process.once('SIGTERM',shutdown);
