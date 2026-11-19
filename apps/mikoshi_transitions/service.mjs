import http from 'node:http';
import {propose,feedback,catalog} from './model.mjs';
import {configured,load,save} from './store.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const r='transition.inspect',w='transition.learn';
const ids={status:'mikoshi_transitions.status',propose:'mikoshi_transitions.propose',
 feedback:'mikoshi_transitions.feedback'};
function graph(){
 const nodes=[{id:'mikoshi_transitions.view',type:'view',icon:'studio',
  title:'Mikoshi Transition Learner',requires:[r]},
 {id:ids.status,type:'action',title:'Learned timing status',requires:[r]},
 {id:ids.propose,type:'action',title:'Propose join duration',requires:[r]},
 {id:'mikoshi_transitions.provider',type:'resource',requires:[r],
  skill:{schema:'mikoshi.skill.v1',domain:'transition-learning',actions:{
   status:ids.status,propose:ids.propose,
   ...(configured()&&can(w)?{feedback:ids.feedback}:{})}}}];
 const edges=[{from:'mikoshi_transitions.view',to:'mikoshi_transitions.provider',type:'uses'},
  {from:'mikoshi_transitions.provider',to:ids.status,type:'provides'},
  {from:'mikoshi_transitions.provider',to:ids.propose,type:'provides'}];
 if(configured()&&can(w)){
  nodes.push({id:ids.feedback,type:'action',title:'Learn timing from feedback',requires:[w]});
  edges.push({from:'mikoshi_transitions.provider',to:ids.feedback,type:'provides'});
 }
 return {app:'mikoshi_transitions',version:1,nodes,edges};
}
const send=(r,s,b)=>{r.writeHead(s,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});r.end(JSON.stringify(b));};
let serial=Promise.resolve();
async function invoke(b){
 if(!can(r))throw Error('capability_denied');
 if(b.action===ids.status)return {...catalog(await load()),configured:configured()};
 if(b.action===ids.propose)return propose(await load(),b.params?.from,b.params?.to);
 if(b.action!==ids.feedback||!can(w)||!configured())throw Error('capability_denied');
 if(b.params?.sourceApproved!==true)throw Error('source_permission_required');
 const task=serial.then(async()=>{
  const {state,result}=feedback(await load(),b.params||{});
  await save(state);return result;
 });
 serial=task.catch(()=>{});return task;
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_transitions'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>5000)req.destroy();});
  req.on('end',async()=>{try{
   const b=JSON.parse(raw);send(res,200,{result:await invoke(b)});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8934),'127.0.0.1');
