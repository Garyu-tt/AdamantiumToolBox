import http from 'node:http';
import {currentStatus} from './status.mjs';
import {currentTransport} from './transport.mjs';
import {currentSession} from './session.mjs';
const id='client_watchdog';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('Missing internal key');
const graph={app:id,version:1,nodes:[{id:id+'.status',type:'action',
 title:'Client connection watchdog status',requires:['client_watchdog.read']},
 {id:id+'.transport',type:'action',title:'SSH transport health telemetry',
 requires:['client_watchdog.read']},
 {id:id+'.session',type:'action',title:'Windows user-session agent state',
 requires:['client_watchdog.read']}],edges:[]};
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
function authorized(req){return req.headers['x-internal-key']===key;}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:id});
 if(!authorized(req))return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method!=='POST'||req.url!=='/invoke')return send(res,404,{error:'not_found'});
 let length=0,raw='',failed=false;
 req.on('data',chunk=>{length+=chunk.length;if(length>16384){failed=true;req.destroy();return;}
  raw+=chunk.toString('utf8');});
 req.on('end',async()=>{
  if(failed)return;
  let body;try{body=JSON.parse(raw);}catch{return send(res,400,{error:'bad_json'});}
  if(body?.action===id+'.status')return send(res,200,{ok:true,result:await currentStatus()});
  if(body?.action===id+'.transport')return send(res,200,{ok:true,result:await currentTransport()});
  if(body?.action===id+'.session')return send(res,200,{ok:true,result:await currentSession()});
  return send(res,403,{error:'unknown_action'});
 });
}).listen(Number(process.env.APP_PORT),'127.0.0.1');
