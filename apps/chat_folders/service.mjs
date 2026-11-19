import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {invoke} from './store.mjs';
const m=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const ids=['list','create','link'].map(a=>'chat_folders.'+a);
const graph={app:m.id,version:1,nodes:[
 {id:'chat_folders.view',type:'view',title:'Chat Folders',icon:m.icon,requires:['chat.folders'],
  composition:{schema:'mas-composite-view-1',surface:'conversation',slot:'navigation',order:10}},
 {id:'chat_folders.provider',type:'resource',requires:['chat.folders'],protocol:'chat-folders-1',
  actions:{list:ids[0],create:ids[1],link:ids[2]}},
 ...ids.map(id=>({id,type:'action',title:id,requires:['chat.folders']}))],
 edges:ids.map(id=>({from:'chat_folders.provider',to:id,type:'provides'}))};
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const allowed=()=>new Set((process.env.ADA_CAPS||'').split(',')).has('chat.folders');
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:m.id});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',size=0;
  req.on('data',b=>{size+=b.length;if(size>8192){res.writeHead(413);res.end();req.destroy();}else raw+=b;});
  req.on('end',async()=>{if(size>8192)return;
   try{const p=JSON.parse(raw);
    if(!allowed()||!ids.includes(p.action))return send(res,403,{error:'capability_denied'});
    send(res,200,{result:await invoke(p.action,p.params||{})});
   }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}
  });return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||m.service.port),'127.0.0.1');
