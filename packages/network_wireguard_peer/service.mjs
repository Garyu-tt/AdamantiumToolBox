import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {send,jsonBody} from './lib/http.mjs';
import {createBackend} from './lib/backend.mjs';
import {authorizedInternalKey,validatePlan,snapshotHash,checkTransition,authorizedSignatures,digest,publicKey,inPool} from './lib/contract.mjs';
const m=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const iface=process.env.NETWORK_WG_IFACE||'';
const pool=process.env.NETWORK_WG_POOL||'';
const journal=process.env.NETWORK_WG_JOURNAL||'';
const config={interface:iface,pool};
const backend=createBackend();
const enabled=process.env.NETWORK_WG_WRITE_ENABLED==='1';
let trust=null;
if(process.env.NETWORK_WG_SIGNERS_FILE){
 try{trust=JSON.parse(await readFile(process.env.NETWORK_WG_SIGNERS_FILE,'utf8'));}catch{}
}
const ready=()=>/^[A-Za-z0-9_.=-]{1,15}$/.test(iface)&&
  typeof pool==='string'&&/^([0-9.]+)\/\d{1,2}$/.test(pool);
const canRead=()=>caps.has('network_wireguard_peer.read')&&ready();
const canWrite=()=>canRead()&&caps.has('network_wireguard_peer.write')&&enabled&&
  trust&&typeof journal==='string'&&journal.startsWith('/');
const graph=async()=>{
 const nodes=[],edges=[];
 if(caps.has('network_wireguard_peer.read')){
  nodes.push({id:'network_wireguard_peer.status',type:'action',title:'WireGuard peer control status',requires:['network_wireguard_peer.read']});
  if(canRead()){
   nodes.push({id:'network_wireguard_peer.view',type:'view',title:'WireGuard peers',icon:m.icon,requires:['network_wireguard_peer.read']});
   nodes.push({id:'network_wireguard_peer.prepare',type:'action',title:'Prepare signed peer enrollment',requires:['network_wireguard_peer.read']});
   edges.push({from:'network_wireguard_peer.view',to:'network_wireguard_peer.prepare',type:'uses'});
   if(canWrite()){
    nodes.push({id:'network_wireguard_peer.apply',type:'action',title:'Apply approved peer change',requires:['network_wireguard_peer.write']});
    edges.push({from:'network_wireguard_peer.view',to:'network_wireguard_peer.apply',type:'uses'});
   }
  }
 }
 return {app:m.id,version:1,nodes,edges};
};
const actions=new Set(['network_wireguard_peer.status','network_wireguard_peer.prepare','network_wireguard_peer.apply']);
const handle=async(action,params)=>{
 if(action==='network_wireguard_peer.status'){
  const available=canRead();
  let peerCount=null,reason=available?null:'unconfigured';
  if(available)try{peerCount=(await backend.state(iface)).length;}catch{reason='wg_probe_failed';}
  return {configured:available,applyEnabled:!!canWrite(),peerCount,reason,
   mode:enabled?'gated_ephemeral':'read_only',persistent:false,enforcement:enabled?'wireguard_peers_only':false};
 }
 if(!canRead())throw Error('capability_unavailable');
 if(action==='network_wireguard_peer.prepare'){
  if(!params||!['add','remove'].includes(params.operation))throw Error('invalid_operation');
  publicKey(params.peerPublicKey);
  if(typeof params.allowedIP!=='string'||!params.allowedIP.endsWith('/32')||
   !inPool(params.allowedIP.slice(0,-3),pool))throw Error('unapproved_address');
  const peers=await backend.state(iface);
  const plan={schema:'network-wireguard-peer-plan-v1',operation:params.operation,interface:iface,
   peerPublicKey:params.peerPublicKey,allowedIP:params.allowedIP,expiresAt:Date.now()+120000,
   nonce:randomBytes(24).toString('base64url'),expectedState:snapshotHash(peers)};
  validatePlan(plan,config);
  checkTransition(plan,peers);
  return {plan,digest:digest(plan),mode:'approval_required',writeEnabled:!!canWrite(),
   ephemeral:true,requires:['source_ed25519','destination_ed25519']};
 }
 if(action==='network_wireguard_peer.apply'){
  if(!canWrite())throw Error('capability_unavailable');
  const plan=validatePlan(params?.plan,config);
  if(params?.digest!==digest(plan))throw Error('plan_digest_mismatch');
  authorizedSignatures(plan,params?.proofs,trust);
  const peers=await backend.state(iface);
  checkTransition(plan,peers);
  // No firewall, routes, interface creation or config-file mutation is possible.
  return await backend.commit(plan);
 }
 throw Error('unsupported_action');
};
const server=http.createServer(async(req,res)=>{
 const path=(req.url||'').split('?')[0];
 if(req.method==='GET'&&path==='/health')return send(res,200,{app:m.id,readiness:ready()?'configured':'unconfigured',applyEnabled:!!canWrite()});
 if(!authorizedInternalKey(req.headers['x-internal-key'],secret))return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&path==='/graph')return send(res,200,await graph());
 if(req.method==='POST'&&path==='/invoke'){
  try{
   const body=await jsonBody(req);
   if(!actions.has(body?.action)||(body.action==='network_wireguard_peer.apply'?!canWrite():!caps.has('network_wireguard_peer.read')))
    return send(res,403,{error:'capability_unavailable'});
   return send(res,200,{result:await handle(body.action,body.params||{})});
  }catch(e){
   const conflict=['stale_state','operation_replayed','peer_or_address_in_use','peer_state_mismatch'].includes(e.message);
   return send(res,conflict?409:400,{error:['invalid_plan','invalid_operation','invalid_public_key','invalid_ipv4','unapproved_address','unapproved_interface','invalid_nonce',
    'invalid_revision','expired_or_unbounded_plan','approval_required','distinct_signers_required','invalid_signature','signature_invalid','approval_invalid',
    'plan_digest_mismatch','stale_state','operation_replayed','peer_or_address_in_use','peer_state_mismatch','unconfigured_journal',
    'unsafe_journal_dir','unsafe_journal','journal_full','unconfigured_pool','invalid_pool'].includes(e.message)?e.message:'operation_failed'});
  }
 }
 return send(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||m.service.port);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_port');
server.listen(port,'127.0.0.1');
