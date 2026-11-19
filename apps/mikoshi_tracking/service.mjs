import http from 'node:http';
import {track} from './tracker.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const scope='tracking.inspect';
const can=()=>new Set((process.env.ADA_CAPS||'').split(',')).has(scope);
const ids={status:'mikoshi_tracking.status',track:'mikoshi_tracking.track'};
function graph(){
 const nodes=[{id:'mikoshi_tracking.view',type:'view',icon:'studio',
  title:'Mikoshi Coarse Visual Tracks',requires:[scope]},
 {id:ids.status,type:'action',title:'Visual tracking status',requires:[scope]},
 {id:ids.track,type:'action',title:'Track anonymous foreground blobs',
  requires:[scope]},
 {id:'mikoshi_tracking.provider',type:'resource',requires:[scope],
  skill:{schema:'mikoshi.skill.v1',domain:'visual-tracking',actions:ids}}];
 const edges=[{from:'mikoshi_tracking.view',
  to:'mikoshi_tracking.provider',type:'uses'},
  ...[ids.status,ids.track].map(to=>({
   from:'mikoshi_tracking.provider',to,type:'provides'}))];
 return {app:'mikoshi_tracking',version:1,nodes,edges};
}
const send=(res,status,doc)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(doc));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_tracking'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  if(!can())return send(res,403,{error:'capability_denied'});
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>50000)req.destroy();});
  req.on('end',()=>{try{
   const b=JSON.parse(raw);
   const result=b.action===ids.status?{
    schema:'mikoshi.tracking.status.v1',pixels:64,
    maxFrames:12,maxTracks:8,rawStorage:false,identity:false}:
    b.action===ids.track?track(b.params?.frames):null;
   if(!result)throw Error('action_unavailable');
   send(res,200,{result});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8994),'127.0.0.1');
