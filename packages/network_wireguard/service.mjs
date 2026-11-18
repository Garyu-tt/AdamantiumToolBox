import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {readWireGuard} from './lib/reader.mjs';
const m=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const authorized=v=>typeof v==='string'&&Buffer.byteLength(v)===Buffer.byteLength(secret)&&timingSafeEqual(Buffer.from(v),Buffer.from(secret));
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const permitted=()=>caps.has('network_wireguard.read');
const json=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
const actions=['network_wireguard.status','network_wireguard.interfaces','network_wireguard.peers'];
function graph(ready){
 const nodes=permitted()?[{id:'network_wireguard.status',type:'action',title:'WireGuard provider status',requires:['network_wireguard.read']}]:[];
 if(permitted()&&ready){
  nodes.push({id:'network_wireguard.view',type:'view',title:'WireGuard',icon:m.icon,requires:['network_wireguard.read']});
  for(const name of actions.slice(1))nodes.push({id:name,type:'action',title:name.split('.')[1],requires:['network_wireguard.read']});
 }
 return {app:m.id,version:1,nodes,edges:ready&&permitted()?actions.slice(1).map(id=>({from:'network_wireguard.view',to:id,type:'uses'})):[]};
}
async function body(req){return new Promise((resolve,reject)=>{const chunks=[];let size=0;req.on('data',x=>{size+=x.length;if(size>4096){reject(Error('body_too_large'));req.destroy();}else chunks.push(x);});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(Error('invalid_json'));}});req.on('error',reject);});}
const server=http.createServer(async(req,res)=>{
 const path=(req.url||'').split('?')[0];
 if(req.method==='GET'&&path==='/health')return json(res,200,{service:m.id,mode:'read_only',enforcement:false});
 if(!authorized(req.headers['x-internal-key']))return json(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&path==='/graph'){
  const snapshot=permitted()?await readWireGuard():{available:false};
  return json(res,200,graph(snapshot.available));
 }
 if(req.method==='POST'&&path==='/invoke'){
  try{
   const p=await body(req);
   if(!permitted()||!actions.includes(p?.action))return json(res,403,{error:'capability_unavailable'});
   const snapshot=await readWireGuard();
   if(p.action==='network_wireguard.status')return json(res,200,{result:{available:snapshot.available,reason:snapshot.reason||null,
    interfaceCount:snapshot.interfaceCount||0,peerCount:snapshot.peerCount||0,mode:'read_only',enforcement:false}});
   if(!snapshot.available)return json(res,403,{error:'capability_unavailable'});
   if(p.action==='network_wireguard.interfaces')return json(res,200,{result:{interfaces:snapshot.interfaces.map(({peers,...i})=>i),enforcement:false}});
   if(p.action==='network_wireguard.peers')return json(res,200,{result:{interfaces:snapshot.interfaces,enforcement:false}});
  }catch{return json(res,400,{error:'bad_request'});}
 }
 return json(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||m.service.port);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_port');
server.listen(port,'127.0.0.1');
