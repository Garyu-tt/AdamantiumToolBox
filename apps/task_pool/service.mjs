import http from 'node:http';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {TaskPool} from './store.mjs';
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';if(secret.length<24)throw Error('internal_key_missing');
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const root=join(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox','task_pool');
const pool=new TaskPool(root);await pool.startup();
const actions={
 'tasks.list':'tasks.read','tasks.get':'tasks.read',
 'tasks.submit':'tasks.create','tasks.claim':'tasks.claim',
 'tasks.heartbeat':'tasks.claim','tasks.complete':'tasks.finish',
 'tasks.fail':'tasks.finish','tasks.reconcile':'tasks.review'};
const nodes=[{id:'task_pool.view',type:'view',title:manifest.name,icon:manifest.icon,
 requires:['tasks.read']},...Object.entries(actions).filter(([_,permission])=>caps.has(permission))
 .map(([id,permission])=>({id,type:'action',title:id,requires:[permission]}))];
if(caps.has('tasks.claim'))nodes.push({id:'task_pool.provider',type:'resource',
 requires:['tasks.claim'],provider:{schema:'mas-task-provider-1',
 claimAction:'tasks.claim',heartbeatAction:'tasks.heartbeat',
 completeAction:caps.has('tasks.finish')?'tasks.complete':null}});
const graph={app:manifest.id,version:1,nodes,edges:nodes.slice(1).map(n=>({
 from:'task_pool.view',to:n.id,type:'uses'}))};
const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function invoke(action,p){
 if(!actions[action]||!caps.has(actions[action]))throw Error('capability_denied');
 if(action==='tasks.list')return pool.list(p);
 if(action==='tasks.get')return pool.get(p.taskId);
 if(action==='tasks.submit')return pool.submit(p);
 if(action==='tasks.claim')return pool.claim(p);
 if(action==='tasks.heartbeat')return pool.transition(p,'claimed');
 if(action==='tasks.complete')return pool.transition(p,'completed');
 if(action==='tasks.fail')return pool.transition(p,'failed');
 if(action==='tasks.reconcile')return pool.reconcile(p);
 throw Error('action_not_found');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return reply(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return reply(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return reply(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',overflow=false;
  req.on('data',d=>{raw+=d;if(raw.length>24000){overflow=true;req.destroy();}});
  req.on('end',async()=>{if(overflow)return;
   try{const b=JSON.parse(raw);reply(res,200,{result:await invoke(b.action,b.params||{})});}
   catch(e){reply(res,400,{error:String(e.message).slice(0,160)});}});return;
 }
 reply(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
