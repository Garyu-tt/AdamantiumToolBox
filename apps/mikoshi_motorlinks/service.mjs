import http from 'node:http';
import {propose,feedback,catalog} from './model.mjs';
import {configured,load,save} from './store.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const read='motor.inspect',write='motor.learn';
const ids={status:'mikoshi_motorlinks.status',propose:'mikoshi_motorlinks.propose',
 feedback:'mikoshi_motorlinks.feedback'};
function graph(){
 const nodes=[{id:'mikoshi_motorlinks.view',type:'view',icon:'studio',
  title:'Mikoshi Vocal Motor Links',requires:[read]},
 {id:ids.status,type:'action',title:'Motor memory status',requires:[read]},
 {id:ids.propose,type:'action',title:'Propose articulation',requires:[read]},
 {id:'mikoshi_motorlinks.provider',type:'resource',requires:[read],
  skill:{schema:'mikoshi.skill.v1',domain:'motor-learning',actions:{
   status:ids.status,propose:ids.propose,
   ...(can(write)&&configured()?{feedback:ids.feedback}:{})}}}];
 const edges=[{from:'mikoshi_motorlinks.view',
  to:'mikoshi_motorlinks.provider',type:'uses'},
  {from:'mikoshi_motorlinks.provider',to:ids.propose,type:'provides'},
  {from:'mikoshi_motorlinks.provider',to:ids.status,type:'provides'}];
 if(can(write)&&configured()){
  nodes.push({id:ids.feedback,type:'action',
   title:'Update motor with sensory reward',requires:[write]});
  edges.push({from:'mikoshi_motorlinks.provider',to:ids.feedback,type:'provides'});
 }
 return {app:'mikoshi_motorlinks',version:1,nodes,edges};
}
const send=(res,status,doc)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(doc));};
let serial=Promise.resolve();
async function invoke(b){
 if(!can(read))throw Error('capability_denied');
 if(b.action===ids.status)return {...catalog(await load()),configured:configured()};
 if(b.action===ids.propose)return propose(await load(),b.params?.id);
 if(b.action!==ids.feedback||!can(write)||!configured())throw Error('capability_denied');
 if(b.params?.sourceApproved!==true)throw Error('source_permission_required');
 const task=serial.then(async()=>{
  const {state,result}=feedback(await load(),b.params||{});
  await save(state);return result;
 });
 serial=task.catch(()=>{});return task;
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_motorlinks'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>5000)req.destroy();});
  req.on('end',async()=>{try{
   const body=JSON.parse(raw);send(res,200,{result:await invoke(body)});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8952),'127.0.0.1');
