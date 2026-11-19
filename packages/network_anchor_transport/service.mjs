import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {load} from './lib/config.mjs';
import {preview,deliver} from './lib/sender.mjs';
import {startReceiver} from './lib/receiver.mjs';
const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const credential=process.env.ADA_INTERNAL_KEY||'';
if(credential.length<24)throw Error('missing_internal_key');
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const actions={'network_anchor_transport.status':'network_anchor_transport.read',
 'network_anchor_transport.preview':'network_anchor_transport.read',
 'network_anchor_transport.deliver':'network_anchor_transport.send'};
const same=x=>typeof x==='string'&&Buffer.byteLength(x)===Buffer.byteLength(credential)&&
 timingSafeEqual(Buffer.from(x),Buffer.from(credential));
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
let cfg=null,listener=null,error='not_configured';
if(process.env.NETWORK_ANCHOR_TRANSPORT_CONFIG){
 try{cfg=await load(process.env.NETWORK_ANCHOR_TRANSPORT_CONFIG);
  if(cfg.mode==='receiver'){
   const needed=['network_anchor_transport.read','network_anchor_transport.receive','network_anchor.read','network_anchor.write'];
   if(needed.some(cap=>!caps.has(cap)))throw Error('receiver_permissions_missing');
   listener=await startReceiver(cfg,credential,caps);
  }
  error=null;
 }catch(e){cfg=null;error=String(e.message).slice(0,85);}
}
function graph(){const nodes=[{id:'network_anchor_transport.view',type:'view',title:'Audit Anchor Transport',
 icon:manifest.icon,requires:['network_anchor_transport.read']}];
 for(const [action,permission] of Object.entries(actions)){
  if(action!=='network_anchor_transport.status'&&(!cfg||cfg.mode!=='sender'))continue;
  nodes.push({id:action,type:'action',title:action.split('.')[1],requires:[permission]});
 }
 return {app:manifest.id,version:1,nodes,
 edges:nodes.filter(x=>x.type==='action').map(x=>({from:'network_anchor_transport.view',to:x.id,type:'uses'}))};
}
const body=req=>new Promise((ok,no)=>{let n=0,raw='';req.on('data',x=>{n+=x.length;
 if(n>16384){no(Error('body_too_large'));req.destroy();}else raw+=x;});
 req.on('end',()=>{try{ok(JSON.parse(raw));}catch{no(Error('invalid_body'));}});req.on('error',no);});
async function invoke(action){
 if(action==='network_anchor_transport.status')return {configured:!!cfg,mode:cfg?.mode||'unavailable',
  error:cfg?null:error,listener:!!listener,enforcement:false};
 if(!cfg||cfg.mode!=='sender')throw Error('not_configured');
 return action==='network_anchor_transport.preview'?preview(cfg):deliver(cfg);
}
const server=http.createServer(async(req,res)=>{
 const path=(req.url||'').split('?')[0];
 if(req.method==='GET'&&path==='/health')return send(res,200,{app:manifest.id,mode:'transport_only',enforcement:false});
 if(!same(req.headers['x-internal-key']))return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&path==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&path==='/invoke'){
  try{const data=await body(req),action=data?.action;
   if(!Object.hasOwn(actions,action)||!caps.has(actions[action])||
     (action!=='network_anchor_transport.status'&&(!cfg||cfg.mode!=='sender')))
    return send(res,403,{error:'capability_unavailable'});
   return send(res,200,{result:await invoke(action)});
  }catch(e){return send(res,400,{error:String(e.message).slice(0,90)});}
 }
 return send(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||manifest.service.port);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_port');
server.listen(port,'127.0.0.1');
const shutdown=()=>{server.close();listener?.close();};
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
