import http from 'node:http';
import {available,status,speak} from './engine.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const graph=()=>{
 const nodes=[{id:'mikoshi_piper.view',type:'view',title:'Piper Voice Provider',
  icon:'studio',requires:['voice.inspect']},
 {id:'mikoshi_piper.status',type:'action',title:'Neural TTS status',
  requires:['voice.inspect']}];
 const edges=[{from:'mikoshi_piper.view',to:'mikoshi_piper.status',type:'uses'}];
 if(available()){
  nodes.push({id:'mikoshi_piper.provider',type:'resource',requires:['voice.render'],
   skill:{schema:'mikoshi.skill.v1',domain:'speech',priority:70,
    prosody:['speedDelta'],actions:{speak:'mikoshi_piper.speak'}}},
   {id:'mikoshi_piper.speak',type:'action',title:'Render neural TTS',requires:['voice.render']});
  edges.push({from:'mikoshi_piper.view',to:'mikoshi_piper.provider',type:'uses'},
   {from:'mikoshi_piper.provider',to:'mikoshi_piper.speak',type:'provides'});
 }
 return {app:'mikoshi_piper',version:1,nodes,edges};
};
const send=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json',
 'Cache-Control':'no-store'});res.end(JSON.stringify(body));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_piper'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>3000)req.destroy();});
  req.on('end',()=>{try{
   const b=JSON.parse(raw),scope=b.action==='mikoshi_piper.status'?
    'voice.inspect':'voice.render';
   if(!can(scope))throw Error('capability_denied');
   const result=b.action==='mikoshi_piper.status'?status():
    b.action==='mikoshi_piper.speak'?speak(b.params?.text,b.params?.prosody):null;
   if(!result)throw Error('action_unavailable');
   send(res,200,{result});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8926),'127.0.0.1');
