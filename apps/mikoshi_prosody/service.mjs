import http from 'node:http';
import {configured,load,save} from './store.mjs';
import {suggest,feedback} from './network.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const inspect='prosody.inspect',learn='prosody.learn';
const graph=()=>{
 const nodes=[{id:'mikoshi_prosody.view',type:'view',title:'Prosody Coach',
  icon:'studio',requires:[inspect]},
 {id:'mikoshi_prosody.status',type:'action',title:'Coach status',requires:[inspect]}];
 const edges=[{from:'mikoshi_prosody.view',to:'mikoshi_prosody.status',type:'uses'}];
 if(configured()){
  nodes.push({id:'mikoshi_prosody.provider',type:'resource',requires:[inspect],
   skill:{schema:'mikoshi.skill.v1',domain:'prosody',actions:{
    suggest:'mikoshi_prosody.suggest',...(can(learn)?{feedback:'mikoshi_prosody.feedback'}:{})}}},
   {id:'mikoshi_prosody.suggest',type:'action',title:'Suggest prosody',requires:[inspect]});
  edges.push({from:'mikoshi_prosody.view',to:'mikoshi_prosody.provider',type:'uses'},
   {from:'mikoshi_prosody.provider',to:'mikoshi_prosody.suggest',type:'provides'});
  if(can(learn)){
   nodes.push({id:'mikoshi_prosody.feedback',type:'action',
    title:'Learn vocal feedback',requires:[learn]});
   edges.push({from:'mikoshi_prosody.provider',to:'mikoshi_prosody.feedback',type:'provides'});
  }
 }
 return {app:'mikoshi_prosody',version:1,nodes,edges};
};
const send=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json',
 'Cache-Control':'no-store'});res.end(JSON.stringify(body));};
let serial=Promise.resolve();
async function invoke(b){
 if(b.action==='mikoshi_prosody.status'){
  if(!can(inspect))throw Error('capability_denied');
  const state=configured()?await load():null;
  return {configured:configured(),model:'small-online-mlp',observations:state?.steps||0,
   rewarded:state?.positive||0,languageModel:false};
 }
 if(!configured())throw Error('prosody_storage_not_configured');
 if(b.action==='mikoshi_prosody.suggest'){
  if(!can(inspect))throw Error('capability_denied');
  return suggest(await load(),b.params?.text);
 }
 if(b.action!=='mikoshi_prosody.feedback'||!can(learn))throw Error('capability_denied');
 const task=serial.then(async()=>{
  const {state,updated}=feedback(await load(),b.params?.text,b.params?.feedback);
  await save(state);
  return {updated,prediction:suggest(state,b.params?.text)};
 });
 serial=task.catch(()=>{});return task;
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_prosody'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>5000)req.destroy();});
  req.on('end',async()=>{try{
   const b=JSON.parse(raw);
   send(res,200,{result:await invoke(b)});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8951),'127.0.0.1');
