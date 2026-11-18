import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {configuration,request} from './mcp.mjs';
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';if(secret.length<24)throw Error('internal_key_missing');
const permitted=new Set((process.env.ADA_CAPS||'').split(',')).has('memory.read');
let tools=[],error=null;
async function probe(){
 try{const status=await request(null);tools=status.tools;error=null;}
 catch(e){tools=[];error=String(e.message).slice(0,100);}
}
if(configuration())await probe();
const actions={'noosphere_lite.search':'memory_search','noosphere_lite.read':'memory_read'};
const exposed=()=>Object.entries(actions).filter(([_,tool])=>permitted&&tools.includes(tool));
const graph=()=>{
 const nodes=[{id:'noosphere_lite.view',type:'view',title:manifest.name,
  icon:manifest.icon,requires:['memory.read']},
 ...exposed().map(([id])=>({id,type:'action',title:id,requires:['memory.read']}))];
 if(exposed().length)nodes.push({id:'noosphere_lite.provider',type:'resource',
  requires:['memory.read'],provider:{schema:'mas-memory-provider-1',
  searchAction:tools.includes('memory_search')?'noosphere_lite.search':null,
  readAction:tools.includes('memory_read')?'noosphere_lite.read':null,mode:'read_only'}});
 return {app:manifest.id,version:1,nodes,edges:nodes.slice(1).map(n=>({
  from:'noosphere_lite.view',to:n.id,type:'uses'}))};
};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function invoke(action,p){
 if(!permitted||!exposed().some(([id])=>id===action))throw Error('capability_unavailable');
 if(action==='noosphere_lite.search'){
  if(typeof p.query!=='string'||!p.query.trim()||p.query.length>500||
   p.limit!==undefined&&(!Number.isInteger(p.limit)||p.limit<1||p.limit>20))
   throw Error('invalid_search');
  return {results:await request('memory_search',{query:p.query,limit:p.limit||10}),verified:false};
 }
 if(action==='noosphere_lite.read'){
  if(typeof p.memory_id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(p.memory_id))
   throw Error('invalid_memory_id');
  return {record:await request('memory_read',{memory_id:p.memory_id}),verified:false};
 }
 throw Error('action_not_found');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:manifest.id,mode:tools.length?'read_only':'unavailable'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',overflow=false;
  req.on('data',chunk=>{raw+=chunk;if(raw.length>4096){overflow=true;req.destroy();}});
  req.on('end',async()=>{if(overflow)return;
   try{const b=JSON.parse(raw);send(res,200,{result:await invoke(b.action,b.params||{})});}
   catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
