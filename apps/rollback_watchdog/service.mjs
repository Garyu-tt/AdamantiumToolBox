import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {inspectApproval} from './receipt.mjs';
import {inspectJournal} from './journal.mjs';
const manifest=JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)),
 'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const permission=manifest.permissions[0],actions=[
 'rollback_watchdog.receipt','rollback_watchdog.journal'];
const permitted=()=>new Set((process.env.ADA_CAPS||'').split(',')).has(permission);
const graph=()=>({app:manifest.id,version:1,nodes:permitted()?
 [{id:manifest.id+'.view',type:'view',title:manifest.name,
  icon:manifest.icon,requires:[permission]},
  ...actions.map(id=>({id,type:'action',title:id,requires:[permission]}))]:[],
 edges:permitted()?actions.map(id=>({from:manifest.id+'.view',to:id,type:'uses'})):[]});
const reply=(res,status,data)=>{if(res.writableEnded)return;
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return reply(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return reply(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return reply(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',bytes=0,overflow=false;
  req.on('data',part=>{bytes+=part.length;if(bytes>131072){overflow=true;
   return reply(res,413,{error:'too_large'});}if(!overflow)raw+=part;});
  req.on('end',()=>{if(overflow)return;
   if(!permitted())return reply(res,403,{error:'capability_denied'});
   try{const body=JSON.parse(raw),params=body.params||{};
    if(body.action===actions[0])return reply(res,200,{result:inspectApproval(
     params.receipt,{expectedLeaseId:params.expectedLeaseId,
      expectedTargetNode:params.expectedTargetNode,
      expectedPlanDigest:params.expectedPlanDigest,
      expectedBaseRevision:params.expectedBaseRevision,
      trustedPublicKey:process.env.ADA_ROLLBACK_TRUST_SPKI||''})});
    if(body.action===actions[1])return reply(res,200,
     {result:inspectJournal(params)});
    return reply(res,404,{error:'unknown_action'});
   }catch(e){return reply(res,400,{error:String(e.message).slice(0,96)});}
  });return;
 }
 reply(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
