import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {estimate,begin,observe,abort,status} from './model.mjs';
import {configured,load,save} from './store.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const read='prediction.inspect',write='prediction.learn';
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const ids={status:'mikoshi_worldmodel.status',estimate:'mikoshi_worldmodel.estimate',
 forecast:'mikoshi_worldmodel.forecast',observe:'mikoshi_worldmodel.observe',
 abort:'mikoshi_worldmodel.abort'};
function graph(){
 const nodes=[{id:'mikoshi_worldmodel.view',type:'view',
  title:'Mikoshi Auditory World Predictor',icon:'studio',requires:[read]},
 {id:ids.status,type:'action',title:'Prediction status',requires:[read]},
 {id:ids.estimate,type:'action',title:'Estimate acoustic outcome',requires:[read]},
 {id:'mikoshi_worldmodel.provider',type:'resource',requires:[read],
  skill:{schema:'mikoshi.skill.v1',domain:'world-prediction',actions:{
   status:ids.status,estimate:ids.estimate,
   ...(configured()&&can(write)?{forecast:ids.forecast,
    observe:ids.observe,abort:ids.abort}:{})}}}];
 const edges=[{from:'mikoshi_worldmodel.view',
  to:'mikoshi_worldmodel.provider',type:'uses'},
  {from:'mikoshi_worldmodel.provider',to:ids.status,type:'provides'},
  {from:'mikoshi_worldmodel.provider',to:ids.estimate,type:'provides'}];
 if(configured()&&can(write))for(const [name,title] of [
  ['forecast','Record forecast before acting'],
  ['observe','Compare forecast to observation'],
  ['abort','Discard uncompleted forecast']]){
  nodes.push({id:ids[name],type:'action',title,requires:[write]});
  edges.push({from:'mikoshi_worldmodel.provider',to:ids[name],type:'provides'});
 }
 return {app:'mikoshi_worldmodel',version:1,nodes,edges};
}
const send=(res,code,doc)=>{res.writeHead(code,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(doc));};
let serial=Promise.resolve();
async function invoke(b){
 if(!can(read))throw Error('capability_denied');
 if(b.action===ids.status)return {...status(await load()),configured:configured()};
 if(b.action===ids.estimate)return estimate(await load(),b.params?.motor);
 if(!configured()||!can(write)||b.params?.sourceApproved!==true)
  throw Error('capability_denied');
 const task=serial.then(async()=>{
  const state=await load();let next,result;
  if(b.action===ids.forecast){
   const x=begin(state,b.params?.motor,randomUUID());
   next=x.state;result=x.result;
  }else if(b.action===ids.observe){
   const x=observe(state,b.params?.ticket,b.params?.vector);
   next=x.state;result=x.result;
  }else if(b.action===ids.abort){
   next=abort(state,b.params?.ticket);result=status(next);
  }else throw Error('action_unavailable');
  await save(next);return result;
 });
 serial=task.catch(()=>{});return task;
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_worldmodel'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>8000)req.destroy();});
  req.on('end',async()=>{try{
   const b=JSON.parse(raw);send(res,200,{result:await invoke(b)});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8937),'127.0.0.1');
