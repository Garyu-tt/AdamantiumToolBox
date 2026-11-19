import http from 'node:http';
import {learn,predict,catalog} from './model.mjs';
import {configured,load,save} from './store.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const can=scope=>new Set((process.env.ADA_CAPS||'').split(',')).has(scope);
const r='sequence.inspect',w='sequence.learn';
const ids={status:'mikoshi_sequences.status',predict:'mikoshi_sequences.predict',
 teach:'mikoshi_sequences.teach'};
function graph(){
 const nodes=[{id:'mikoshi_sequences.view',type:'view',icon:'studio',
  title:'Mikoshi Temporal Hearing',requires:[r]},
 {id:ids.status,type:'action',title:'Temporal memory status',requires:[r]},
 {id:ids.predict,type:'action',title:'Predict the next acoustic motif',requires:[r]},
 {id:'mikoshi_sequences.provider',type:'resource',requires:[r],
  skill:{schema:'mikoshi.skill.v1',domain:'auditory-sequence',actions:{
   status:ids.status,predict:ids.predict,
   ...(can(w)&&configured()?{teach:ids.teach}:{})}}}];
 const edges=[{from:'mikoshi_sequences.view',to:'mikoshi_sequences.provider',type:'uses'},
  {from:'mikoshi_sequences.provider',to:ids.status,type:'provides'},
  {from:'mikoshi_sequences.provider',to:ids.predict,type:'provides'}];
 if(can(w)&&configured()){
  nodes.push({id:ids.teach,type:'action',title:'Learn timed motifs',requires:[w]});
  edges.push({from:'mikoshi_sequences.provider',to:ids.teach,type:'provides'});
 }
 return {app:'mikoshi_sequences',version:1,nodes,edges};
}
const send=(res,status,doc)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(doc));};
let serial=Promise.resolve();
async function invoke(body){
 if(!can(r))throw Error('capability_denied');
 if(body.action===ids.status)return {...catalog(await load()),configured:configured()};
 if(body.action===ids.predict)return predict(await load(),body.params?.context);
 if(body.action!==ids.teach||!can(w)||!configured())throw Error('capability_denied');
 if(body.params?.sourceApproved!==true)throw Error('source_permission_required');
 const task=serial.then(async()=>{
  const {state,result}=learn(await load(),body.params?.events);
  if(result.updated)await save(state);
  return result;
 });
 serial=task.catch(()=>{});return task;
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_sequences'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>10000)req.destroy();});
  req.on('end',async()=>{try{
   const body=JSON.parse(raw);send(res,200,{result:await invoke(body)});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8929),'127.0.0.1');
