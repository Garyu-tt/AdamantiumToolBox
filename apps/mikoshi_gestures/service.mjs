import http from 'node:http';
import {plan} from './planner.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const ids={status:'mikoshi_gestures.status',plan:'mikoshi_gestures.plan'};
function graph(){
 const nodes=[{id:'mikoshi_gestures.view',type:'view',icon:'studio',
  title:'Mikoshi Vocal Gestures',requires:['gesture.inspect']},
 {id:ids.status,type:'action',title:'Gesture planner status',
  requires:['gesture.inspect']}];
 const edges=[{from:'mikoshi_gestures.view',to:ids.status,type:'uses'}];
 if(can('gesture.plan')){
  nodes.push({id:ids.plan,type:'action',title:'Plan coarticulation',
   requires:['gesture.plan']},
   {id:'mikoshi_gestures.provider',type:'resource',
    requires:['gesture.plan'],
    skill:{schema:'mikoshi.skill.v1',domain:'gesture-planner',
     actions:{plan:ids.plan}}});
  edges.push({from:'mikoshi_gestures.view',
   to:'mikoshi_gestures.provider',type:'uses'},
   {from:'mikoshi_gestures.provider',to:ids.plan,type:'provides'});
 }
 return {app:'mikoshi_gestures',version:1,nodes,edges};
}
const send=(res,status,payload)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));};
function invoke(req){
 if(req.action===ids.status){
  if(!can('gesture.inspect'))throw Error('capability_denied');
  return {schema:'mikoshi.gesture.status.v1',
   engine:'smoothstep-trajectory',frameMs:10,model:'none'};
 }
 if(req.action!==ids.plan||!can('gesture.plan'))throw Error('capability_denied');
 return plan(req.params?.steps,req.params?.transitionMs);
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_gestures'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>6000)req.destroy();});
  req.on('end',()=>{try{
   send(res,200,{result:invoke(JSON.parse(raw))});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8931),'127.0.0.1');
