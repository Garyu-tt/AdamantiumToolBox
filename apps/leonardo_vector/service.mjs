import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {vectorArtifact} from './scene.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const permitted=()=>new Set((process.env.ADA_CAPS||'').split(',')).has('graphics.provider');
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const id=manifest.id,action=id+'.generate';
const spec={app:id,version:1,nodes:[
 {id:id+'.view',type:'view',title:'Leonardo Vector CPU',icon:manifest.icon,requires:['graphics.provider']},
 {id:id+'.provider',type:'resource',requires:['graphics.provider'],
  provider:{schema:'mas-graphics-provider-1',locality:'local',operations:[
   {kind:'image',action,formats:['image/svg+xml'],priority:4},
   {kind:'render',action,formats:['image/svg+xml'],priority:10}]}},
 {id:action,type:'action',title:'Generate safe vector art',requires:['graphics.provider']}
],edges:[{from:id+'.view',to:id+'.provider',type:'uses'},
 {from:id+'.provider',to:action,type:'provides'}]};
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store'});res.end(JSON.stringify(body));};
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:id});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';
  req.on('data',chunk=>{raw+=chunk;if(raw.length>32000)req.destroy();});
  req.on('end',()=>{try{
   const body=JSON.parse(raw),p=body.params||{};
   if(body.action!==action||!permitted())throw Error('capability_denied');
   if(!['image','render'].includes(p.kind)||p.format!=='image/svg+xml')
    throw Error('unsupported_vector_format');
   send(res,200,{result:{status:'completed',artifact:vectorArtifact(p.prompt,p.options)}});
  }catch(e){send(res,400,{error:String(e.message).slice(0,110)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
