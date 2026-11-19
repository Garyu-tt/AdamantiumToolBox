import http from 'node:http';
import {assess} from './model.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const scope='reconciliation.inspect';
const can=()=>new Set((process.env.ADA_CAPS||'').split(',')).has(scope);
const ids={status:'mikoshi_reconciliation.status',
 assess:'mikoshi_reconciliation.assess'};
function graph(){
 const nodes=[{id:'mikoshi_reconciliation.view',type:'view',
  title:'Mikoshi Reconciliation',icon:'studio',requires:[scope]},
 {id:ids.status,type:'action',title:'Reconciliation status',requires:[scope]},
 {id:ids.assess,type:'action',title:'Assess signed write receipts',requires:[scope]},
 {id:'mikoshi_reconciliation.provider',type:'resource',requires:[scope],
  skill:{schema:'mikoshi.skill.v1',domain:'source-reconciliation',actions:ids}}];
 const edges=[{from:'mikoshi_reconciliation.view',
  to:'mikoshi_reconciliation.provider',type:'uses'},
  ...[ids.status,ids.assess].map(to=>({
   from:'mikoshi_reconciliation.provider',to,type:'provides'}))];
 return {app:'mikoshi_reconciliation',version:1,nodes,edges};
}
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')
  return send(res,200,{app:'mikoshi_reconciliation'});
 if(req.headers['x-internal-key']!==key)
  return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  if(!can())return send(res,403,{error:'capability_denied'});
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>9000)req.destroy();});
  req.on('end',()=>{try{
   const b=JSON.parse(raw);
   const result=b.action===ids.status?{
    schema:'mikoshi.reconciliation.status.v1',storage:'none',
    automaticWrites:false,distributedRollback:false}:
    b.action===ids.assess?assess(b.params?.rows,
     b.params?.expiresAt,Date.now()):null;
   if(!result)throw Error('action_unavailable');
   send(res,200,{result});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8988),'127.0.0.1');
