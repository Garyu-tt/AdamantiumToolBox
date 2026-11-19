import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {observeRuleset} from './observe.mjs';
const manifest=JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)),
 'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const permission=manifest.permissions[0],action='nftables_readback.observe';
const allowed=()=>new Set((process.env.ADA_CAPS||'').split(',')).has(permission);
const graph=()=>({app:manifest.id,version:1,
 nodes:allowed()?[{id:manifest.id+'.view',type:'view',title:manifest.name,
  icon:manifest.icon,requires:[permission]},
  {id:action,type:'action',title:action,requires:[permission]}]:[],
 edges:allowed()?[{from:manifest.id+'.view',to:action,type:'uses'}]:[]});
const reply=(res,status,data)=>{if(res.writableEnded)return;
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return reply(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return reply(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return reply(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',size=0,overflow=false;
  req.on('data',part=>{size+=part.length;if(size>1024){overflow=true;
   return reply(res,413,{error:'too_large'});}if(!overflow)raw+=part;});
  req.on('end',async()=>{if(overflow)return;
   if(!allowed())return reply(res,403,{error:'capability_denied'});
   try{const body=JSON.parse(raw);
    if(body?.action!==action)return reply(res,404,{error:'unknown_action'});
    return reply(res,200,{result:await observeRuleset()});
   }catch{return reply(res,400,{error:'invalid_request'});}
  });return;
 }
 reply(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
