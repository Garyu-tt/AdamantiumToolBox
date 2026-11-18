import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {audit,plan} from './audit.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const permission=manifest.permissions[0];
const actions={'graph_dns.audit':audit,'graph_dns.plan':plan};
const caps=()=>new Set((process.env.ADA_CAPS||'').split(','));
const graph=()=>({app:manifest.id,version:1,nodes:[
 {id:'graph_dns.view',type:'view',title:manifest.name,icon:manifest.icon,requires:[permission]},
 ...Object.keys(actions).map(id=>({id,type:'action',title:id,requires:[permission]}))],
 edges:Object.keys(actions).map(id=>({from:'graph_dns.view',to:id,type:'uses'}))});
const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.url==='/health')return reply(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return reply(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return reply(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',overflow=false;req.on('data',part=>{
   raw+=part;if(raw.length>262144){overflow=true;req.destroy();}});
  req.on('end',()=>{if(overflow)return;
   try{const body=JSON.parse(raw),fn=actions[body.action];
    if(!caps().has(permission)||!fn)throw Error('capability_denied');
    reply(res,200,{result:fn(body.params||{})});
   }catch(e){reply(res,400,{error:String(e.message).slice(0,120)});}
  });return;
 }
 reply(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
