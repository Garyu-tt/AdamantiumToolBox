import http from 'node:http';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorized,CAPABILITY} from './authorize.mjs';
import {sandboxReady,runPython} from './sandbox.mjs';
const root=resolve(fileURLToPath(new URL('../../../..',import.meta.url)));
const secret=process.env.ADA_INTERNAL_KEY||'';
const port=Number(process.env.FRANK_ADAPTER_PORT);
if(secret.length<24||!Number.isInteger(port)||port<1024||port>65535)
 throw Error('adapter_requires_secret_and_port');
const send=(res,code,body)=>{
 res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify(body));
};
let active=0;
http.createServer((req,res)=>{
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/health'){
  sandboxReady().then(ready=>send(res,ready?200:503,ready?
   {protocol:'frank-adapter-1',adapter:CAPABILITY}:{error:'sandbox_unavailable'}));
  return;
 }
 if(req.method!=='POST'||req.url!=='/invoke')return send(res,404,{error:'not_found'});
 if(active>=2)return send(res,429,{error:'busy'});
 let raw='';
 req.on('data',b=>{raw+=b;if(raw.length>65536)req.destroy();});
 req.on('end',async()=>{
  active++;
  try{
   if(!await sandboxReady())return send(res,503,{error:'sandbox_unavailable'});
   const body=JSON.parse(raw);
   if(body.protocol!=='frank-adapter-1'||!body.package)throw Error('invalid_protocol');
   const {pkg,digest}=await authorized(root,body.package.key,body.action,port);
   const result=await runPython(pkg,digest,body.action,body.params||{});
   send(res,200,{result});
  }catch(e){send(res,400,{error:String(e.message).slice(0,100)});}
  finally{active--;}
 });
}).listen(port,'127.0.0.1');
