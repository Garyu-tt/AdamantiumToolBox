"""Adamantium MAS host-delegated bridge. No direct neural write actions."""
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import * as native from './backend.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
const policy=JSON.parse(readFileSync(join(root,'routes.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
const scope=manifest.permissions[0];
const permitted=new Set((process.env.ADA_CAPS||'').split(','));
if(secret.length<24||policy.schema!=='mikoshi.mas.routes.v1')throw Error('Bridge contract unavailable');
const json=(res,status,value)=>{
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify(value));
};
async function actions(){
 const live=new Map();
 if(!permitted.has(scope))return live;
 const online=native.isReady();
 let registered=new Set();
 if(online){
  try{
   const doc=await native.request('GET','/api/v1/capabilities');
   registered=new Set((doc.capabilities||[]).filter(c=>c.available===true).map(c=>c.id));
  }catch{registered=new Set();}
 }
 for(const item of policy.static){
  if(item.mode==='local')live.set(item.id,item);
  else if(online&&item.mode==='get')live.set(item.id,item);
  else if(online&&item.mode==='native'&&registered.has(item.native))
   live.set(item.id,item);
 }
 if(online)for(const pattern of policy.dynamic){
  for(const id of registered){
   if(!id.startsWith(pattern.fromPrefix))continue;
   const suffix=id.slice(pattern.fromPrefix.length);
   if(!/^[a-z0-9][a-z0-9_.-]{0,100}$/i.test(suffix))continue;
   live.set(pattern.idPrefix+suffix,{
    id:pattern.idPrefix+suffix,title:pattern.titlePrefix+suffix,
    mode:'native',native:id
   });
  }
 }
 return live;
}
async function graph(){
 const routes=await actions();
 const view={id:manifest.id+'.view',type:'view',
  title:manifest.name,icon:manifest.icon,requires:[scope]};
 const nodes=[view,...[...routes.values()].map(x=>({
  id:x.id,type:'action',title:x.title,requires:[scope]
 }))];
 return {app:manifest.id,version:1,nodes,
  edges:[...routes.keys()].map(id=>({from:view.id,to:id,type:'uses'}))};
}
async function invoke(action,args){
 const known=await actions(),route=known.get(action);
 if(!route)throw Error('action_unavailable');
 if(route.mode==='local')return native.status();
 if(route.mode==='get')return native.request('GET',route.path);
 if(route.mode==='native'){
  return native.request('POST','/api/v1/action',{action:route.native,args:args||{}});
 }
 throw Error('invalid_action_mode');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return json(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return json(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph'){
  graph().then(x=>json(res,200,x))
    .catch(()=>json(res,503,{error:'graph_unavailable'}));return;
 }
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',bad=false;
  req.on('data',part=>{raw+=part;if(raw.length>65536){bad=true;req.destroy();}});
  req.on('end',async()=>{
   if(bad)return;
   try{const body=JSON.parse(raw);
    json(res,200,{result:await invoke(body.action,body.params)});
   }catch(e){json(res,400,{error:String(e.message).slice(0,120)});}
  });return;
 }
 json(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
process.on('SIGTERM',()=>{native.stop();process.exit(0);});
process.on('SIGINT',()=>{native.stop();process.exit(0);});
native.boot().catch(()=>{});
