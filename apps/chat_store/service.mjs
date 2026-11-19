import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {invoke} from './journal.mjs';
const m=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const actions=['list','read','create','append'].map(a=>'chat_store.'+a);
const requires=a=>['list','read'].includes(a)?['chat.read']:['chat.write'];
const nodes=[
 {id:'chat_store.view',type:'view',title:'Conversation Store',icon:m.icon,requires:['chat.read']},
 {id:'chat_store.provider',type:'resource',requires:['chat.read'],
  protocol:'conversation-store-1',actions:Object.fromEntries(actions.map(a=>[a.split('.')[1],a]))},
 ...actions.map(a=>({id:a,type:'action',title:a,requires:requires(a)}))];
const graph={app:m.id,version:1,nodes,edges:actions.map(a=>({from:'chat_store.provider',to:a,type:'provides'}))};
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const caps=new Set((process.env.ADA_CAPS||'').split(','));
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:m.id});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',size=0;
  req.on('data',c=>{size+=c.length;if(size>32768){res.writeHead(413);res.end();req.destroy();}else raw+=c;});
  req.on('end',async()=>{if(size>32768)return;
   try{
    const p=JSON.parse(raw),scope=requires(p.action);
    if(!actions.includes(p.action)||!scope.every(c=>caps.has(c)))return send(res,403,{error:'capability_denied'});
    send(res,200,{result:await invoke(p.action,p.params||{})});
   }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}
  });return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||m.service.port),'127.0.0.1');
