import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {checkLab} from './check.mjs';
const manifest=JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)),
 'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const capability='nftables_lab.read',action='nftables_lab.check';
const authorized=()=>new Set((process.env.ADA_CAPS||'').split(',')).has(capability);
const graph=()=>({app:manifest.id,version:1,
 nodes:authorized()?[{id:'nftables_lab.view',type:'view',title:manifest.name,
  icon:manifest.icon,requires:[capability]},
  {id:action,type:'action',title:action,requires:[capability]}]:[],
 edges:authorized()?[{from:'nftables_lab.view',to:action,type:'uses'}]:[]});
const reply=(res,status,data)=>{if(res.writableEnded)return;
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.url==='/health'&&req.method==='GET')return reply(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return reply(res,401,{error:'unauthorized'});
 if(req.url==='/graph'&&req.method==='GET')return reply(res,200,graph());
 if(req.url==='/invoke'&&req.method==='POST'){
  let raw='',bytes=0,overflow=false;
  req.on('data',chunk=>{bytes+=chunk.length;
   if(bytes>262144){overflow=true;return reply(res,413,{error:'too_large'});}
   if(!overflow)raw+=chunk;});
  req.on('end',async()=>{if(overflow)return;
   if(!authorized())return reply(res,403,{error:'capability_denied'});
   try{const body=JSON.parse(raw);
    if(body?.action!==action)return reply(res,404,{error:'unknown_action'});
    return reply(res,200,{result:await checkLab(body.params?.preview)});
   }catch(e){return reply(res,400,{error:String(e.message).slice(0,96)});}
  });return;
 }
 reply(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
