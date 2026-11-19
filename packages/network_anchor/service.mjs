import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {openAnchor} from './lib/store.mjs';
const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';if(secret.length<24)throw Error('missing_internal_key');
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const actions={'network_anchor.status':'network_anchor.read','network_anchor.latest':'network_anchor.read',
 'network_anchor.inspect':'network_anchor.read','network_anchor.commit':'network_anchor.write'};
const equal=x=>typeof x==='string'&&Buffer.byteLength(x)===Buffer.byteLength(secret)&&
 timingSafeEqual(Buffer.from(x),Buffer.from(secret));
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
function body(req){return new Promise((ok,no)=>{let size=0;const bytes=[];req.on('data',x=>{
 size+=x.length;if(size>262144){no(Error('body_too_large'));req.destroy();}else bytes.push(x);});
 req.on('end',()=>{try{ok(JSON.parse(Buffer.concat(bytes).toString('utf8')));}catch{no(Error('invalid_json'));}});req.on('error',no);});}
let anchor=null,bootError='not_configured';
if(process.env.NETWORK_ANCHOR_LOG&&process.env.NETWORK_ANCHOR_TRUST&&process.env.NETWORK_ANCHOR_KEY){
 try{anchor=await openAnchor({logPath:process.env.NETWORK_ANCHOR_LOG,trustPath:process.env.NETWORK_ANCHOR_TRUST,
  keyPath:process.env.NETWORK_ANCHOR_KEY});bootError=null;}catch(e){bootError=String(e.message).slice(0,100);}
}
async function active(){if(!anchor)return false;try{await anchor.reload();bootError=null;return true;}
 catch(e){bootError=String(e.message).slice(0,100);return false;}}
function graph(ready){const nodes=[{id:'network_anchor.view',type:'view',title:'Independent Audit Anchor',icon:manifest.icon,
 requires:['network_anchor.read']}];for(const [id,cap] of Object.entries(actions)){
 if(!ready&&id!=='network_anchor.status')continue;nodes.push({id,type:'action',title:id.split('.')[1],requires:[cap]});}
 return {app:manifest.id,version:1,nodes,edges:nodes.filter(n=>n.type==='action').map(n=>({from:'network_anchor.view',to:n.id,type:'uses'}))};}
async function invoke(action,params,ready){if(action==='network_anchor.status')return ready?anchor.status():{configured:false,error:bootError,enforcement:false};
 if(!ready)throw Error('not_configured');if(action==='network_anchor.latest')return anchor.latest();
 if(action==='network_anchor.inspect')return anchor.inspect(params.entry);
 if(action==='network_anchor.commit')return anchor.commit(params);throw Error('unsupported_action');}
const server=http.createServer(async(req,res)=>{
 const path=(req.url||'').split('?')[0];if(req.method==='GET'&&path==='/health')return send(res,200,{app:manifest.id,mode:'anchor_only',enforcement:false});
 if(!equal(req.headers['x-internal-key']))return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&path==='/graph')return send(res,200,graph(await active()));
 if(req.method==='POST'&&path==='/invoke'){try{const data=await body(req),ready=await active();
  if(!Object.hasOwn(actions,data?.action)||!caps.has(actions[data.action])||(!ready&&data.action!=='network_anchor.status'))
   return send(res,403,{error:'capability_unavailable'});
  return send(res,200,{result:await invoke(data.action,data.params||{},ready)});
 }catch(e){const reason=String(e.message).slice(0,100);return send(res,reason==='revision_conflict'?409:400,{error:reason});}}
 return send(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||manifest.service.port);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_port');
server.listen(port,'127.0.0.1');
async function close(){server.close();if(anchor){await anchor.queue;await anchor.close();}}
process.once('SIGTERM',()=>close().then(()=>process.exit(0)));
process.once('SIGINT',()=>close().then(()=>process.exit(0)));
