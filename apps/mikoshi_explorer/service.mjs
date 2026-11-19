import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {begin,propose,observe,stop,status} from './model.mjs';
import {configured,load,save} from './store.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const read='exploration.inspect',write='exploration.learn';
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const ids={status:'mikoshi_explorer.status',choose:'mikoshi_explorer.choose',
 begin:'mikoshi_explorer.begin',feedback:'mikoshi_explorer.feedback',
 stop:'mikoshi_explorer.stop'};
function graph(){
 const nodes=[{id:'mikoshi_explorer.view',type:'view',
  icon:'studio',title:'Mikoshi Experiment Explorer',requires:[read]},
 {id:ids.status,type:'action',title:'Exploration status',requires:[read]},
 {id:ids.choose,type:'action',title:'Choose next experiment',requires:[read]},
 {id:'mikoshi_explorer.provider',type:'resource',requires:[read],
  skill:{schema:'mikoshi.skill.v1',domain:'exploration',actions:{
   status:ids.status,choose:ids.choose,
   ...(configured()&&can(write)?{begin:ids.begin,
    feedback:ids.feedback,stop:ids.stop}:{})}}}];
 const edges=[{from:'mikoshi_explorer.view',
  to:'mikoshi_explorer.provider',type:'uses'},
  {from:'mikoshi_explorer.provider',to:ids.choose,type:'provides'},
  {from:'mikoshi_explorer.provider',to:ids.status,type:'provides'}];
 if(configured()&&can(write))for(const [name,title] of [
  ['begin','Start bounded experiment'],['feedback','Observe result'],
  ['stop','Stop exploration']]){
  nodes.push({id:ids[name],type:'action',title,requires:[write]});
  edges.push({from:'mikoshi_explorer.provider',
   to:ids[name],type:'provides'});
 }
 return {app:'mikoshi_explorer',version:1,nodes,edges};
}
const send=(res,code,doc)=>{res.writeHead(code,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(doc));};
let serial=Promise.resolve();
async function invoke(b){
 if(!can(read))throw Error('capability_denied');
 if(b.action===ids.status)return status(await load());
 if(b.action===ids.choose)return propose(await load());
 if(!configured()||!can(write))throw Error('capability_denied');
 if(b.params?.sourceApproved!==true)throw Error('source_permission_required');
 const task=serial.then(async()=>{
  const state=await load();let next,result;
  if(b.action===ids.begin){
   next=begin(state,b.params?.ids,b.params?.budget,randomUUID());
   result=status(next);
  }else if(b.action===ids.feedback){
   const observed=observe(state,b.params);next=observed.state;result=observed.result;
  }else if(b.action===ids.stop){
   next=stop(state,b.params?.sessionId);result=status(next);
  }else throw Error('action_unavailable');
  await save(next);return result;
 });
 serial=task.catch(()=>{});return task;
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_explorer'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>6000)req.destroy();});
  req.on('end',async()=>{try{
   const b=JSON.parse(raw);send(res,200,{result:await invoke(b)});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8936),'127.0.0.1');
