import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {inspectBatch} from './migration.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const permission=manifest.permissions[0],action='noosphere.inspect';
const graph={app:manifest.id,version:1,nodes:[
 {id:'noosphere.view',type:'view',title:manifest.name,icon:manifest.icon,requires:[permission]},
 {id:action,type:'action',title:'Inspect migration batch',requires:[permission]}],
 edges:[{from:'noosphere.view',to:action,type:'uses'}]};
const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.url==='/health')return reply(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return reply(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return reply(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',over=false;req.on('data',part=>{raw+=part;
   if(raw.length>524288){over=true;req.destroy();}});
  req.on('end',()=>{if(over)return;
   try{const request=JSON.parse(raw);
    if(request.action!==action||!new Set((process.env.ADA_CAPS||'').split(',')).has(permission))
     throw Error('capability_denied');
    reply(res,200,{result:inspectBatch(request.params||{})});
   }catch(e){reply(res,400,{error:String(e.message).slice(0,120)});}
  });return;
 }
 reply(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
