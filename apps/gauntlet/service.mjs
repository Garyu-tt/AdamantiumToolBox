import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {catalog} from '../../core/catalog.mjs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {submit,accept} from './pipeline.mjs';
import {list,detail} from './state.mjs';
import {stateRoot,hash} from './shared.mjs';
const source=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('Missing internal key');
const reply=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));};
async function graph(){
 const cases=await list(stateRoot());
 const nodes=[
  {id:'gauntlet.view',type:'view',title:'Gauntlet QA',icon:'graph',requires:['gauntlet.read']},
  ...['list','detail','submit','attest'].map(id=>({id:'gauntlet.'+id,type:'action',
   title:id,requires:[['list','detail'].includes(id)?'gauntlet.read':
    id==='submit'?'gauntlet.submit':'gauntlet.verify']})),
  ...cases.filter(c=>['BLOCKED','FAILED'].includes(c.status)).map(c=>({
   id:'gauntlet.blocker_'+hash(c.task_id).slice(0,16),type:'resource',
   title:c.task_id+' '+c.issues.join(','),status:c.status,
   diagnostic:c.diagnostic,affected_components:c.affected_components,
   requires:['gauntlet.read']}))
 ];
 return {app:'gauntlet',version:1,nodes,
  edges:nodes.slice(1).map(n=>({from:'gauntlet.view',to:n.id,type:'related'}))};
}
async function invoke(action,params){
 if(action==='gauntlet.list')return await list(stateRoot());
 if(action==='gauntlet.detail')return await detail(stateRoot(),params?.task_id);
 if(action==='gauntlet.submit')return await submit(stateRoot(),params,await catalog(source));
 if(action==='gauntlet.attest'){
  if(!process.env.GAUNTLET_QA_PUBLIC_KEY_FILE)throw Error('qa_key_not_configured');
  const key=await readFile(process.env.GAUNTLET_QA_PUBLIC_KEY_FILE,'utf8');
  return await accept(stateRoot(),params,key);
 }
 throw Error('capability_unavailable');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return reply(res,200,{app:'gauntlet'});
 if(req.headers['x-internal-key']!==secret)return reply(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph'){
  graph().then(v=>reply(res,200,v)).catch(()=>reply(res,503,{error:'graph_unavailable'}));return;
 }
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>262144)req.destroy();});
  req.on('end',async()=>{try{const b=JSON.parse(raw);
   reply(res,200,{result:await invoke(b.action,b.params||{})});}
   catch(e){reply(res,400,{error:String(e.message).slice(0,100)});}});return;
 }
 reply(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8972),'127.0.0.1');
