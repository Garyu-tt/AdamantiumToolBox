import http from 'node:http';
import {analyze} from './encoder.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const scope='vision.inspect';
const can=()=>new Set((process.env.ADA_CAPS||'').split(',')).has(scope);
const ids={status:'mikoshi_vision.status',analyze:'mikoshi_vision.analyze'};
function graph(){
 const nodes=[{id:'mikoshi_vision.view',type:'view',icon:'studio',
  title:'Mikoshi Visual Events',requires:[scope]},
 {id:ids.status,type:'action',title:'Vision status',requires:[scope]},
 {id:ids.analyze,type:'action',title:'Encode RGB changes',requires:[scope]},
 {id:'mikoshi_vision.provider',type:'resource',requires:[scope],
  skill:{schema:'mikoshi.skill.v1',domain:'visual-events',actions:ids}}];
 const edges=[{from:'mikoshi_vision.view',to:'mikoshi_vision.provider',type:'uses'},
  {from:'mikoshi_vision.provider',to:ids.status,type:'provides'},
  {from:'mikoshi_vision.provider',to:ids.analyze,type:'provides'}];
 return {app:'mikoshi_vision',version:1,nodes,edges};
}
const send=(r,status,doc)=>{r.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});r.end(JSON.stringify(doc));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_vision'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  if(!can())return send(res,403,{error:'capability_denied'});
  let raw='';req.on('data',part=>{raw+=part;if(raw.length>40000)req.destroy();});
  req.on('end',()=>{try{
   const b=JSON.parse(raw);
   const result=b.action===ids.status?{
    schema:'mikoshi.vision.status.v1',width:8,height:8,
    model:'none',storage:'none',learning:false}:
    b.action===ids.analyze?analyze(b.params?.frames):null;
   if(!result)throw Error('action_unavailable');
   send(res,200,{result});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8998),'127.0.0.1');
