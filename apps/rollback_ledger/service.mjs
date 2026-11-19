import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {reserveLease,inspectLease} from './store.mjs';
import {auditReservations} from './audit.mjs';
import {checkpointReservations} from './checkpoint.mjs';
const manifest=JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)),
 'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const can=x=>new Set((process.env.ADA_CAPS||'').split(',')).has(x);
const inspect='rollback_ledger.inspect',audit='rollback_ledger.audit';
const checkpoint='rollback_ledger.checkpoint',reserve='rollback_ledger.reserve';
const read='rollback_ledger.read',write='rollback_ledger.reserve';
const caps={[inspect]:read,[audit]:read,[checkpoint]:read,[reserve]:write};
const visible=()=>Object.keys(caps).filter(x=>can(caps[x]));
const graph=()=>{
 const actions=visible(),view=can(read);
 const nodes=[...(view?[{id:manifest.id+'.view',type:'view',
  title:manifest.name,icon:manifest.icon,requires:[read]}]:[]),
  ...actions.map(id=>({id,type:'action',title:id,requires:[caps[id]]}))];
 return {app:manifest.id,version:1,nodes,
  edges:view?actions.map(id=>({from:manifest.id+'.view',to:id,type:'uses'})):[]};
};
const reply=(res,status,value)=>{if(res.writableEnded)return;
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return reply(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return reply(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return reply(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',size=0,overflow=false;
  req.on('data',chunk=>{size+=chunk.length;
   if(size>8192){overflow=true;return reply(res,413,{error:'too_large'});}
   if(!overflow)raw+=chunk;});
  req.on('end',async()=>{if(overflow)return;
   try{
    const body=JSON.parse(raw),action=body?.action,params=body?.params||{};
    if(!Object.hasOwn(caps,action))return reply(res,404,{error:'unknown_action'});
    if(!can(caps[action]))return reply(res,403,{error:'capability_denied'});
    const options={root:process.env.ADA_ROLLBACK_LEDGER_DIR,
     trustedPublicKey:process.env.ADA_ROLLBACK_TRUST_SPKI||''};
    const result=action===inspect?await inspectLease(params.leaseId,options):
     action===audit?await auditReservations(options):
     action===checkpoint?await checkpointReservations({...options,
      expectedDigest:params.expectedDigest}):
     await reserveLease(params,options);
    return reply(res,200,{result});
   }catch(e){return reply(res,400,{error:String(e.message).slice(0,96)});}
  });return;
 }
 reply(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
