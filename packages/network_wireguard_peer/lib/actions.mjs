import {randomBytes} from 'node:crypto';
import {validatePlan,snapshotHash,checkTransition,authorizedSignatures,digest,publicKey,inPool} from './contract.mjs';
import {createClientTemplate} from './profile.mjs';
export const createHandler=({canRead,canWrite,backend,iface,pool,config,trust,enabled,profile})=>{
return async(action,params)=>{
 if(action==='network_wireguard_peer.status'){
  const available=canRead();
  let peerCount=null,reason=available?null:'unconfigured';
  if(available)try{peerCount=(await backend.state(iface)).length;}catch{reason='wg_probe_failed';}
  return {configured:available,applyEnabled:!!canWrite(),peerCount,reason,
   mode:enabled?'gated_ephemeral':'read_only',persistent:false,profileReady:!!profile,
   enforcement:enabled?'wireguard_peers_only':false};
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
 if(action==='network_wireguard_peer.clientProfile'){
  if(!profile)throw Error('profile_unconfigured');
  publicKey(params?.peerPublicKey);
  return createClientTemplate({clientPublicKey:params.peerPublicKey,address:params.address,
   peers:await backend.state(iface),settings:profile});
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
};
