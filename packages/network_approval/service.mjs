import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {prepare,message,revokeMessage,verifyProof,validateTrust,canonicalRequest} from './lib/contract.mjs';
import {Journal} from './lib/journal.mjs';
const m=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('missing_internal_credential');
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const actions={
 'network_approval.status':'network_approval.read',
 'network_approval.list':'network_approval.read',
 'network_approval.prepare':'network_approval.read',
 'network_approval.challenge':'network_approval.read',
 'network_approval.propose':'network_approval.write',
 'network_approval.endorse':'network_approval.write',
 'network_approval.revoke':'network_approval.write'};
const same=val=>typeof val==='string'&&Buffer.byteLength(val)===Buffer.byteLength(key)&&timingSafeEqual(Buffer.from(val),Buffer.from(key));
const respond=(res,status,v)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(v));};
async function readBody(req){return new Promise((ok,no)=>{let size=0;const all=[];req.on('data',d=>{size+=d.length;if(size>16384){no(Error('body_too_large'));req.destroy();}else all.push(d);});req.on('end',()=>{try{ok(JSON.parse(Buffer.concat(all).toString('utf8')));}catch{no(Error('invalid_json'));}});req.on('error',no);});}
let journal=null,bootError=null;
if(process.env.NETWORK_APPROVAL_JOURNAL&&process.env.NETWORK_APPROVAL_TRUST){
 try{const trust=validateTrust(JSON.parse(await readFile(process.env.NETWORK_APPROVAL_TRUST,'utf8')));
  journal=await new Journal(process.env.NETWORK_APPROVAL_JOURNAL,trust).start();
 }catch(e){bootError=String(e.message).slice(0,80);}
}
async function visible(){
 if(!journal)return false;
 try{await journal.reload();bootError=null;return true;}
 catch(e){bootError=String(e.message).slice(0,80);return false;}
}
function graph(active){
 const nodes=[{id:m.id+'.view',type:'view',title:'Network Approval Ledger',icon:m.icon,requires:['network_approval.read']}];
 for(const [id,cap] of Object.entries(actions)){
  if(!active&&id!==m.id+'.status')continue;
  nodes.push({id,type:'action',title:id.split('.')[1],requires:[cap]});
 }
 return {app:m.id,version:1,nodes,edges:nodes.filter(x=>x.type==='action').map(n=>({from:m.id+'.view',to:n.id,type:'uses'}))};
}
async function invoke(action,p,active){
 if(action==='network_approval.status')return {configured:active,mode:'approval_ledger',enforcement:false,
  ...(active?{revision:journal.head,count:journal.count}:{error:bootError||'not_configured'})};
 if(!active)throw Error('not_configured');
 if(action==='network_approval.list')return journal.list();
 if(action==='network_approval.prepare')return prepare(p);
 if(action==='network_approval.challenge'){
  const rec=journal.entries.get(p.id);if(!rec)throw Error('request_not_found');
  if(p.type==='endorse')return {side:'destination',payload:message(rec.request,'destination').toString('base64'),revision:journal.head};
  if(p.type==='revoke'&&['source','destination'].includes(p.side))return {side:p.side,
   payload:revokeMessage(rec.request,p.side,p.reason).toString('base64'),revision:journal.head};
  throw Error('invalid_challenge');
 }
 if(action==='network_approval.propose'){
  const request=canonicalRequest(p.request);
  return journal.mutate({expectedRevision:p.expectedRevision,event:{type:'propose',at:new Date().toISOString(),request,proof:p.proof}});
 }
 if(action==='network_approval.endorse')return journal.mutate({expectedRevision:p.expectedRevision,
  event:{type:'endorse',at:new Date().toISOString(),id:p.id,proof:p.proof}});
 if(action==='network_approval.revoke')return journal.mutate({expectedRevision:p.expectedRevision,
  event:{type:'revoke',at:new Date().toISOString(),id:p.id,proof:p.proof,reason:p.reason}});
 throw Error('capability_unavailable');
}
const server=http.createServer(async(req,res)=>{
 const path=(req.url||'').split('?')[0];
 if(req.method==='GET'&&path==='/health')return respond(res,200,{app:m.id,configured:visible(),enforcement:false});
 if(!same(req.headers['x-internal-key']))return respond(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&path==='/graph')return respond(res,200,graph(await visible()));
 if(req.method==='POST'&&path==='/invoke'){
  try{const body=await readBody(req);
   const active=await visible();
   if(!Object.hasOwn(actions,body?.action)||!caps.has(actions[body.action])||(!active&&body.action!==m.id+'.status'))return respond(res,403,{error:'capability_unavailable'});
   const result=await invoke(body.action,body.params||{},active);return respond(res,200,{result});
  }catch(e){const reason=String(e.message).slice(0,80);return respond(res,reason==='revision_conflict'?409:400,{error:reason});}
 }
 return respond(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||m.service.port);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_port');
server.listen(port,'127.0.0.1');
async function close(){server.close();if(journal){await journal.queue;await journal.close();}}
process.once('SIGTERM',()=>{close().then(()=>process.exit(0));});
process.once('SIGINT',()=>{close().then(()=>process.exit(0));});
