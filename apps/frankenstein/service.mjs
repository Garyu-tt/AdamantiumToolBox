import http from 'node:http';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('Missing internal key');
const send=(res,status,data)=>{
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
};
async function bridge(){
 const path=resolve(root,'frank-addons','bridge','runtime.mjs');
 return existsSync(path)?import(pathToFileURL(path).href):null;
}
async function graph(){
 const worker=await bridge();
 if(worker)return worker.bridgeGraph(root,secret);
 return {app:'frankenstein',version:1,nodes:[
  {id:'frankenstein.view',type:'view',title:'Frankenstein Bridge',
   icon:'studio',requires:['frankenstein.read']},
  {id:'frankenstein.list',type:'action',title:'Frank Addons',
   requires:['frankenstein.read']}],
  edges:[{from:'frankenstein.view',to:'frankenstein.list',type:'uses'}]};
}
async function invoke(action,params){
 const worker=await bridge();
 if(worker)return worker.bridgeInvoke(root,secret,action,params);
 if(action==='frankenstein.list')return {packages:[]};
 throw Error('capability_unavailable');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:'frankenstein'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph'){
  graph().then(v=>send(res,200,v))
   .catch(()=>send(res,503,{error:'bridge_unavailable'}));return;
 }
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';
  req.on('data',part=>{raw+=part;if(raw.length>262144)req.destroy();});
  req.on('end',async()=>{
   try{
    const b=JSON.parse(raw);
    send(res,200,{result:await invoke(b.action,b.params)});
   }catch(e){send(res,400,{error:String(e.message).slice(0,100)});}
  });return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8893),'127.0.0.1');
