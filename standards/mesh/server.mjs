import http from 'node:http';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {authorize} from './transport.mjs';
import {identity} from './identity.mjs';
import {inventory,readEnvelope,receive} from './store.mjs';
const home=process.env.LOCALAPPDATA;
if(!home)throw Error('Mesh requires local state directory');
const root=join(home,'Adamantium Toolbox');
await identity(join(root,'mesh'));
const MAX_BODY=13*1024*1024;
async function trust(){
 try{return JSON.parse((await readFile(join(root,'mesh','trust.json'),'utf8')).replace(/^\uFEFF/,''));}
 catch(e){if(e.code==='ENOENT')return {};throw e;}
}
const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));};
async function readBody(req){
 return new Promise((resolve,reject)=>{
  const chunks=[];let bytes=0;
  req.on('data',chunk=>{
   bytes+=chunk.length;
   if(bytes>MAX_BODY){reject(Error('payload_too_large'));req.destroy();}
   else chunks.push(chunk);
  });
  req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error',reject);
 });
}
http.createServer(async(req,res)=>{
 if(req.url==='/health')return reply(res,200,{service:'MAS Mesh',version:1,transport:'loopback-only'});
 try{
  const body=req.method==='POST'?await readBody(req):'';
  authorize(req,body,await trust());
  if(req.method==='GET'&&req.url==='/v1/index'){
   return reply(res,200,{schema:'mas-mesh-index-1',hashes:await inventory(root)});
  }
  if(req.method==='GET'&&/^\/v1\/package\/[0-9a-f]{64}$/.test(req.url)){
   return reply(res,200,await readEnvelope(root,req.url.slice(-64)));
  }
  if(req.method==='POST'&&req.url==='/v1/package'){
   return reply(res,202,await receive(root,JSON.parse(body),await trust()));
  }
  reply(res,404,{error:'not_found'});
 }catch(e){reply(res,400,{error:String(e.message).slice(0,120)});}
}).listen(Number(process.env.ADA_MESH_PORT||8884),'127.0.0.1');
