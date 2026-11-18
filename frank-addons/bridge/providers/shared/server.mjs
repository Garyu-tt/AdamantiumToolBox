import http from 'node:http';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorizedAddon} from './authorize.mjs';
const rootDefault=resolve(fileURLToPath(new URL('../../../..',import.meta.url)));
export function createAdapterServer({capability,language,ready,execute,
 root=rootDefault,secret=process.env.ADA_INTERNAL_KEY,port=Number(process.env.FRANK_ADAPTER_PORT)}){
 if(typeof secret!=='string'||secret.length<24||
  !Number.isInteger(port)||port<0||port>65535)throw Error('adapter_configuration');
 let active=0;
 const send=(res,status,data)=>{
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
 };
 return http.createServer((req,res)=>{
  if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
  if(req.method==='GET'&&req.url==='/health'){
   ready().then(ok=>send(res,ok?200:503,ok?
    {protocol:'frank-adapter-1',adapter:capability}:{error:'sandbox_unavailable'}))
    .catch(()=>send(res,503,{error:'sandbox_unavailable'}));
   return;
  }
  if(req.method!=='POST'||req.url!=='/invoke')return send(res,404,{error:'not_found'});
  if(active>=2)return send(res,429,{error:'busy'});
  let raw='',large=false;
  req.on('data',data=>{raw+=data;if(raw.length>65536){large=true;req.destroy();}});
  req.on('end',async()=>{
   if(large)return;
   active++;
   try{
    if(!await ready())return send(res,503,{error:'sandbox_unavailable'});
    const data=JSON.parse(raw);
    if(data.protocol!=='frank-adapter-1'||!data.package)throw Error('invalid_protocol');
    const {pkg,digest}=await authorizedAddon(root,data.package.key,
     data.action,port||req.socket.localPort,capability,language);
    const result=await execute(pkg,digest,data.action,data.params||{});
    send(res,200,{result});
   }catch(e){send(res,400,{error:String(e.message).slice(0,100)});}
   finally{active--;}
  });
 });
}
