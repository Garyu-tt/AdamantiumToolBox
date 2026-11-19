import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {openWitness} from './lib/store.mjs';
const m=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';if(secret.length<24)throw Error('missing_internal_key');
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const actions={'network_witness.status':'network_witness.read',
 'network_witness.receipts':'network_witness.read','network_witness.latest':'network_witness.read',
 'network_witness.inspect':'network_witness.read',
 'network_witness.anchor':'network_witness.write'};
const equal=x=>typeof x==='string'&&Buffer.byteLength(x)===Buffer.byteLength(secret)&&
 timingSafeEqual(Buffer.from(x),Buffer.from(secret));
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
function body(req){return new Promise((ok,no)=>{const parts=[];let size=0;req.on('data',x=>{
 size+=x.length;if(size>262144){no(Error('body_too_large'));req.destroy();}else parts.push(x);});
 req.on('end',()=>{try{ok(JSON.parse(Buffer.concat(parts).toString('utf8')));}catch{no(Error('invalid_json'));}});req.on('error',no);
});}
let witness=null,bootError='not_configured';
if(process.env.NETWORK_WITNESS_LOG&&process.env.NETWORK_WITNESS_TRUST&&process.env.NETWORK_WITNESS_KEY){
 try{witness=await openWitness({logPath:process.env.NETWORK_WITNESS_LOG,
  trustPath:process.env.NETWORK_WITNESS_TRUST,keyPath:process.env.NETWORK_WITNESS_KEY});bootError=null;}
 catch(e){bootError=String(e.message).slice(0,80);}
}
async function active(){if(!witness)return false;try{await witness.reload();bootError=null;return true;}
 catch(e){bootError=String(e.message).slice(0,80);return false;}}
const graph=ready=>{const nodes=[{id:'network_witness.view',type:'view',title:'Audit Witness',icon:m.icon,requires:['network_witness.read']}];
 for(const [id,cap] of Object.entries(actions)){if(!ready&&id!=='network_witness.status')continue;
  nodes.push({id,type:'action',title:id.split('.')[1],requires:[cap]});}
 return {app:m.id,version:1,nodes,edges:nodes.filter(n=>n.type==='action').map(n=>({from:'network_witness.view',to:n.id,type:'uses'}))};};
async function invoke(action,p,ready){
 if(action==='network_witness.status')return ready?witness.status():{configured:false,error:bootError,enforcement:false};
 if(!ready)throw Error('not_configured');
 if(action==='network_witness.receipts')return witness.list(p.limit);
 if(action==='network_witness.latest')return witness.headForJournal(p.journalId);
 if(action==='network_witness.inspect')return witness.inspect(p.checkpoint,p.signature);
 if(action==='network_witness.anchor')return witness.anchor(p);
 throw Error('capability_unavailable');
}
const server=http.createServer(async(req,res)=>{
 const path=(req.url||'').split('?')[0];
 if(req.method==='GET'&&path==='/health')return send(res,200,{app:m.id,mode:'witness_only',enforcement:false});
 if(!equal(req.headers['x-internal-key']))return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&path==='/graph')return send(res,200,graph(await active()));
 if(req.method==='POST'&&path==='/invoke'){
  try{const data=await body(req),ready=await active();
   if(!Object.hasOwn(actions,data?.action)||!caps.has(actions[data.action])||
     (!ready&&data.action!=='network_witness.status'))return send(res,403,{error:'capability_unavailable'});
   return send(res,200,{result:await invoke(data.action,data.params||{},ready)});
  }catch(e){const why=String(e.message).slice(0,80);
   return send(res,why==='revision_conflict'?409:400,{error:why});}
 }
 return send(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||m.service.port);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_port');
server.listen(port,'127.0.0.1');
async function stop(){server.close();if(witness){await witness.queue;await witness.close();}}
process.once('SIGTERM',()=>stop().then(()=>process.exit(0)));
process.once('SIGINT',()=>stop().then(()=>process.exit(0)));
