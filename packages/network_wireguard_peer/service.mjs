import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {send,jsonBody} from './lib/http.mjs';
import {createBackend} from './lib/backend.mjs';
import {authorizedInternalKey} from './lib/contract.mjs';
import {profileSettings} from './lib/profile.mjs';
import {createHandler} from './lib/actions.mjs';
const m=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const caps=new Set((process.env.ADA_CAPS||'').split(',').filter(Boolean));
const iface=process.env.NETWORK_WG_IFACE||'';
const pool=process.env.NETWORK_WG_POOL||'';
const journal=process.env.NETWORK_WG_JOURNAL||'';
const config={interface:iface,pool};
const backend=createBackend();
let profile=null;
try{profile=profileSettings();}catch{}
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
   if(profile){
    nodes.push({id:'network_wireguard_peer.clientProfile',type:'action',title:'Enrolled client profile template',requires:['network_wireguard_peer.read']});
    edges.push({from:'network_wireguard_peer.view',to:'network_wireguard_peer.clientProfile',type:'uses'});
   }
   if(canWrite()){
    nodes.push({id:'network_wireguard_peer.apply',type:'action',title:'Apply approved peer change',requires:['network_wireguard_peer.write']});
    edges.push({from:'network_wireguard_peer.view',to:'network_wireguard_peer.apply',type:'uses'});
   }
  }
 }
 return {app:m.id,version:1,nodes,edges};
};
const actions=new Set(['network_wireguard_peer.status','network_wireguard_peer.prepare','network_wireguard_peer.clientProfile','network_wireguard_peer.apply']);
const handle=createHandler({canRead,canWrite,backend,iface,pool,config,trust,enabled,profile});
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
    'unsafe_journal_dir','unsafe_journal','journal_full','unconfigured_pool','invalid_pool',
    'invalid_profile_route','invalid_profile_endpoint','invalid_profile_routes','invalid_profile_dns','invalid_profile_address','invalid_profile_state','profile_unconfigured','peer_not_enrolled'].includes(e.message)?e.message:'operation_failed'});
  }
 }
 return send(res,404,{error:'not_found'});
});
const port=Number(process.env.APP_PORT||m.service.port);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_port');
server.listen(port,'127.0.0.1');
