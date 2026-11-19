import http from 'node:http';
import {align} from './align.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const scope='avsync.inspect';
const can=()=>new Set((process.env.ADA_CAPS||'').split(',')).has(scope);
const ids={status:'mikoshi_avsync.status',align:'mikoshi_avsync.align'};
function graph(){
 const nodes=[{id:'mikoshi_avsync.view',type:'view',icon:'studio',
  title:'Mikoshi A/V Alignment',requires:[scope]},
 {id:ids.status,type:'action',title:'Alignment status',requires:[scope]},
 {id:ids.align,type:'action',title:'Align event timestamps',requires:[scope]},
 {id:'mikoshi_avsync.provider',type:'resource',requires:[scope],
  skill:{schema:'mikoshi.skill.v1',domain:'av-alignment',actions:ids}}];
 const edges=[{from:'mikoshi_avsync.view',
  to:'mikoshi_avsync.provider',type:'uses'},
  ...[ids.status,ids.align].map(to=>({
   from:'mikoshi_avsync.provider',to,type:'provides'}))];
 return {app:'mikoshi_avsync',version:1,nodes,edges};
}
const send=(res,status,doc)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(doc));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')
  return send(res,200,{app:'mikoshi_avsync'});
 if(req.headers['x-internal-key']!==key)
  return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  if(!can())return send(res,403,{error:'capability_denied'});
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>8000)req.destroy();});
  req.on('end',()=>{try{
   const body=JSON.parse(raw);
   const result=body.action===ids.status?{
    schema:'mikoshi.avsync.status.v1',windowMs:250,
    maxEvents:12,learning:false,sourceTrust:'unverified'}:
    body.action===ids.align?align(body.params?.visualEvents,
     body.params?.audioEvents,body.params?.uncertaintyMs):null;
   if(!result)throw Error('action_unavailable');
   send(res,200,{result});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8995),'127.0.0.1');
