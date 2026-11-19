import http from 'node:http';
import {available,profile,speak} from './engine.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const graph=()=>{
 const nodes=[{id:'mikoshi_voice.view',type:'view',title:'Mikoshi Voice',
  icon:'studio',requires:['voice.inspect']},
 {id:'mikoshi_voice.status',type:'action',title:'Voice provider status',
  requires:['voice.inspect']}];
 const edges=[{from:'mikoshi_voice.view',to:'mikoshi_voice.status',type:'uses'}];
 if(available()){
  nodes.push({id:'mikoshi_voice.provider',type:'resource',requires:['voice.render'],
   skill:{schema:'mikoshi.skill.v1',domain:'speech',priority:20,
    prosody:['pitchDelta','speedDelta'],actions:{speak:'mikoshi_voice.speak'}}},
   {id:'mikoshi_voice.speak',type:'action',title:'Render speech',requires:['voice.render']});
  edges.push({from:'mikoshi_voice.view',to:'mikoshi_voice.provider',type:'uses'},
   {from:'mikoshi_voice.provider',to:'mikoshi_voice.speak',type:'provides'});
 }
 return {app:'mikoshi_voice',version:1,nodes,edges};
};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_voice'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>2000)req.destroy();});
  req.on('end',()=>{try{
   const b=JSON.parse(raw);
   const scope=b.action==='mikoshi_voice.status'?'voice.inspect':'voice.render';
   if(!can(scope))throw Error('capability_denied');
   const result=b.action==='mikoshi_voice.status'?
    {engine:available()?'online':'offline',profile:profile(),model:'none'}:
    b.action==='mikoshi_voice.speak'?speak(b.params?.text,b.params?.prosody):null;
   if(!result)throw Error('action_unavailable');
   send(res,200,{result});
  }catch(e){send(res,400,{error:String(e.message).slice(0,100)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8922),'127.0.0.1');
