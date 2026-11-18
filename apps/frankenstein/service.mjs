import http from 'node:http';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bridgeGraph,bridgeInvoke} from '../../frank-addons/bridge/runtime.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('Missing internal key');
const send=(res,status,data)=>{
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
};
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:'frankenstein'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph'){
  bridgeGraph(root,secret).then(v=>send(res,200,v))
   .catch(()=>send(res,503,{error:'bridge_unavailable'}));return;
 }
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';
  req.on('data',part=>{raw+=part;if(raw.length>262144)req.destroy();});
  req.on('end',async()=>{
   try{
    const b=JSON.parse(raw);
    send(res,200,{result:await bridgeInvoke(root,secret,b.action,b.params)});
   }catch(e){send(res,400,{error:String(e.message).slice(0,100)});}
  });return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8893),'127.0.0.1');
