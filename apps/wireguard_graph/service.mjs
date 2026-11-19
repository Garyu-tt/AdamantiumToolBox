import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {captureWireguard} from './collect.mjs';
const manifest=JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)),
 'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const permission=manifest.permissions[0],action='wireguard_graph.snapshot';
const authorized=()=>new Set((process.env.ADA_CAPS||'').split(',')).has(permission);
const graph=()=>({app:manifest.id,version:1,nodes:authorized()?
 [{id:manifest.id+'.view',type:'view',title:manifest.name,icon:manifest.icon,requires:[permission]},
  {id:action,type:'action',title:action,requires:[permission]}]:[],
 edges:authorized()?[{from:manifest.id+'.view',to:action,type:'uses'}]:[]});
const respond=(res,status,data)=>{if(res.writableEnded)return;
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
http.createServer(async(req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return respond(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return respond(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return respond(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',bytes=0,overflow=false;
  req.on('data',part=>{bytes+=part.length;if(bytes>1024){overflow=true;
   return respond(res,413,{error:'too_large'});}if(!overflow)raw+=part;});
  req.on('end',async()=>{if(overflow)return;
   if(!authorized())return respond(res,403,{error:'capability_denied'});
   try{const request=JSON.parse(raw);
    if(request?.action!==action)return respond(res,404,{error:'unknown_action'});
    respond(res,200,{result:await captureWireguard()});
   }catch{return respond(res,400,{error:'invalid_request'});}
  });return;
 }
 respond(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
