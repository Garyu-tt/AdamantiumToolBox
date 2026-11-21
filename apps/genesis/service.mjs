import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {discoverModules} from './registry.mjs';
import {BrainStore} from './store.mjs';
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const store=new BrainStore();
const {graph,actions,starters}=await discoverModules(import.meta.dirname,manifest);
for(const hook of starters)if(caps.has(hook.permission))hook.start(store);
const send=(res,status,data)=>{
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));
};
async function invoke(action,params){
 const handler=actions.get(action);
 if(!handler)throw Error('action_not_found');
 if(!caps.has(handler.permission))throw Error('capability_denied');
 return handler.invoke(action,params,store);
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:manifest.id,version:manifest.version});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',large=false;
  req.on('data',chunk=>{raw+=chunk;if(raw.length>32768){large=true;req.destroy();}});
  req.on('end',async()=>{
   if(large)return;
   try{
    const body=JSON.parse(raw);
    if(typeof body.action!=='string'||!body.params||typeof body.params!=='object'||
       Array.isArray(body.params))throw Error('bad_request');
    send(res,200,{result:await invoke(body.action,body.params)});
   }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}
  });return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
