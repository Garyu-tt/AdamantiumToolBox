import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {invoke} from './ledger.mjs';
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const actions=["chat_turns.status","chat_turns.register","chat_turns.claim","chat_turns.interrupt","chat_turns.close"];
const readActions=new Set(["chat_turns.status"]);
const needs=id=>readActions.has(id)?['chat.turns.read']:['chat.turns.write'];
const graph={app:manifest.id,version:1,nodes:[
 {id:manifest.id+'.view',type:'view',title:manifest.name,icon:manifest.icon,requires:['chat.turns.read'],
  composition:{schema:'mas-composite-view-1',surface:'conversation',slot:'context',order:30}},
 {id:manifest.id+'.provider',type:'resource',protocol:'conversation-turns-1',requires:['chat.turns.read'],
  actions:Object.fromEntries(actions.map(x=>[x.split('.')[1],x]))},
 ...actions.map(id=>({id,type:'action',title:id,requires:needs(id)}))],
 edges:actions.map(id=>({from:manifest.id+'.provider',to:id,type:'provides'}))};
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const send=(res,code,body)=>{if(res.writableEnded)return;res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',size=0;
  req.on('data',c=>{size+=c.length;if(size>32768){send(res,413,{error:'too_large'});req.destroy();}else raw+=c;});
  req.on('end',async()=>{if(size>32768)return;
   try{const p=JSON.parse(raw);
    if(!actions.includes(p.action)||!needs(p.action).every(x=>caps.has(x)))return send(res,403,{error:'capability_denied'});
    send(res,200,{result:await invoke(p.action,p.params||{})});
   }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}
  });return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
