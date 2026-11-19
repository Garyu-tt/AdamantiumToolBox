import http from 'node:http';
import {configured,load,save} from './store.mjs';
import {teach,infer,progress} from './learner.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const scope='learning.inspect',train='learning.train';
const graph=()=>{
 const nodes=[{id:'mikoshi_learning.view',type:'view',title:'Mikoshi Learning',
  icon:'studio',requires:[scope]},
 {id:'mikoshi_learning.status',type:'action',title:'Learning status',requires:[scope]}];
 const edges=[{from:'mikoshi_learning.view',to:'mikoshi_learning.status',type:'uses'}];
 if(configured()){
  nodes.push({id:'mikoshi_learning.provider',type:'resource',requires:[scope],
   skill:{schema:'mikoshi.skill.v1',domain:'general',actions:{
    recognize:'mikoshi_learning.recognize',
    ...(can(train)?{teach:'mikoshi_learning.teach'}:{})}}},
   {id:'mikoshi_learning.recognize',type:'action',title:'Nearest prototype',requires:[scope]});
  if(can(train))nodes.push({id:'mikoshi_learning.teach',type:'action',
   title:'Learn with feedback',requires:[train]});
  edges.push({from:'mikoshi_learning.view',to:'mikoshi_learning.provider',type:'uses'},
   {from:'mikoshi_learning.provider',to:'mikoshi_learning.recognize',type:'provides'});
  if(can(train))edges.push({from:'mikoshi_learning.provider',to:'mikoshi_learning.teach',
   type:'provides'});
 }
 return {app:'mikoshi_learning',version:1,nodes,edges};
};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
let serial=Promise.resolve();
async function invoke(b){
 const scope=b.action==='mikoshi_learning.teach'?train:'learning.inspect';
 if(!can(scope))throw Error('capability_denied');
 if(b.action==='mikoshi_learning.status')
  return {configured:configured(),...(configured()?progress(await load()):{})};
 if(!configured())throw Error('learning_storage_not_configured');
 if(b.action==='mikoshi_learning.recognize')return infer(await load(),b.params||{});
 if(b.action!=='mikoshi_learning.teach')throw Error('action_unavailable');
 const task=serial.then(async()=>{
  const {state,updated,reason}=teach(await load(),b.params||{});
  if(updated)await save(state);
  return {updated,reason:reason||null,...progress(state)};
 });
 serial=task.catch(()=>{});return task;
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_learning'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>6000)req.destroy();});
  req.on('end',async()=>{try{
   const b=JSON.parse(raw);send(res,200,{result:await invoke(b)});
  }catch(e){send(res,400,{error:String(e.message).slice(0,100)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8923),'127.0.0.1');
