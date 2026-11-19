import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {loadConfig} from './lib/config.mjs';
import {preview,deliver} from './lib/source.mjs';
import {startReceiver,stateFor} from './lib/receiver.mjs';
const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';if(secret.length<24)throw Error('missing_internal_key');
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const same=x=>typeof x==='string'&&Buffer.byteLength(x)===Buffer.byteLength(secret)&&
 timingSafeEqual(Buffer.from(x),Buffer.from(secret));
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
let cfg=null,reason='not_configured',receiver=null;
async function configure(){if(!process.env.NETWORK_CHECKPOINT_CONFIG)return;
 try{cfg=await loadConfig(process.env.NETWORK_CHECKPOINT_CONFIG);
  if(cfg.mode==='receiver')receiver=await startReceiver(cfg,secret,caps);
  reason=null;
 }catch(e){cfg=null;reason=String(e.message).slice(0,100);}}
await configure();
const all={'network_checkpoint.status':'network_checkpoint.read','network_checkpoint.preview':'network_checkpoint.read',
 'network_checkpoint.deliver':'network_checkpoint.deliver'};
const graph=()=>{const nodes=[{id:'network_checkpoint.view',type:'view',title:'Checkpoint Transport',icon:manifest.icon,requires:['network_checkpoint.read']}];
 for(const [id,cap] of Object.entries(all)){if(id.endsWith('.status')||(cfg?.mode==='source'))nodes.push({id,type:'action',title:id.split('.')[1],requires:[cap]});}
 return {app:manifest.id,version:1,nodes,edges:nodes.filter(n=>n.type==='action').map(n=>({from:'network_checkpoint.view',to:n.id,type:'uses'}))};};
const service=http.createServer(async(req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:manifest.id,configured:!!cfg,mode:cfg?.mode||'offline',enforcement:false});
 if(!same(req.headers['x-internal-key']))return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',c=>{raw+=c;if(raw.length>2048)req.destroy()});req.on('end',async()=>{
   try{const p=JSON.parse(raw),action=p.action;
    if(!Object.hasOwn(all,action)||!caps.has(all[action])||(!cfg&&!action.endsWith('.status'))||
     (cfg?.mode!=='source'&&!action.endsWith('.status')))return send(res,403,{error:'capability_unavailable'});
    if(action==='network_checkpoint.status')return send(res,200,{result:{configured:!!cfg,mode:cfg?.mode||'offline',reason,receiverActive:!!receiver,enforcement:false}});
    return send(res,200,{result:action.endsWith('.preview')?await preview(cfg):await deliver(cfg)});
   }catch(e){return send(res,400,{error:String(e.message).slice(0,100)});}
  });return;
 }send(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||manifest.service.port);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_port');
service.listen(port,'127.0.0.1');
const close=()=>Promise.all([new Promise(ok=>service.close(ok)),new Promise(ok=>receiver?receiver.close(ok):ok())]);
process.once('SIGTERM',()=>close().then(()=>process.exit(0)));
process.once('SIGINT',()=>close().then(()=>process.exit(0)));
