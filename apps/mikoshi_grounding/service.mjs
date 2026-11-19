import http from 'node:http';
import {learn,associate,recall,catalog} from './model.mjs';
import {configured,load,save} from './store.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const r='grounding.inspect',w='grounding.learn';
const ids={status:'mikoshi_grounding.status',associate:'mikoshi_grounding.associate',
 recall:'mikoshi_grounding.recall',teach:'mikoshi_grounding.teach'};
function graph(){
 const nodes=[{id:'mikoshi_grounding.view',type:'view',icon:'studio',
  title:'Mikoshi Audiovisual Associations',requires:[r]},
 {id:ids.status,type:'action',title:'Grounding status',requires:[r]},
 {id:ids.associate,type:'action',title:'Visual-to-audio association',requires:[r]},
 {id:ids.recall,type:'action',title:'Audio-to-visual recall',requires:[r]},
 {id:'mikoshi_grounding.provider',type:'resource',requires:[r],
  skill:{schema:'mikoshi.skill.v1',domain:'audiovisual-association',actions:{
   status:ids.status,associate:ids.associate,recall:ids.recall,
   ...(can(w)&&configured()?{teach:ids.teach}:{})}}}];
 const edges=[{from:'mikoshi_grounding.view',to:'mikoshi_grounding.provider',type:'uses'},
  ...[ids.status,ids.associate,ids.recall].map(id=>({
   from:'mikoshi_grounding.provider',to:id,type:'provides'}))];
 if(can(w)&&configured()){
  nodes.push({id:ids.teach,type:'action',title:'Remember paired events',requires:[w]});
  edges.push({from:'mikoshi_grounding.provider',to:ids.teach,type:'provides'});
 }
 return {app:'mikoshi_grounding',version:1,nodes,edges};
}
const send=(res,status,doc)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(doc));};
let serial=Promise.resolve();
async function invoke(body){
 if(!can(r))throw Error('capability_denied');
 if(body.action===ids.status)return {...catalog(await load()),configured:configured()};
 if(body.action===ids.associate)
  return associate(await load(),body.params?.visualVector);
 if(body.action===ids.recall)return recall(await load(),body.params?.soundId);
 if(body.action!==ids.teach||!can(w)||!configured())throw Error('capability_denied');
 const task=serial.then(async()=>{
  const {state,result}=learn(await load(),body.params||{});
  await save(state);return result;
 });
 serial=task.catch(()=>{});return task;
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_grounding'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>6000)req.destroy();});
  req.on('end',async()=>{try{
   send(res,200,{result:await invoke(JSON.parse(raw))});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8999),'127.0.0.1');
