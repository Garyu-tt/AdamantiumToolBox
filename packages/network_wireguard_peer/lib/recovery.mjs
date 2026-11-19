import {isIP} from 'node:net';
import {validateSnapshot,publicKey,digest} from './contract.mjs';
const ipv4=value=>value.split('.').reduce((n,x)=>((n<<8)>>>0)+Number(x),0)>>>0;
const cidr=value=>{
 if(typeof value!=='string')throw Error('invalid_cidr');
 const m=/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/.exec(value);
 if(!m||isIP(m[1])!==4)throw Error('invalid_cidr');
 const bits=Number(m[2]),mask=bits===0?0:(0xffffffff<<(32-bits))>>>0;
 return {network:ipv4(m[1])&mask,mask};
};
const covers=(address,range)=>{
 const ip=ipv4(address.split('/')[0]),r=cidr(range);
 return (ip&r.mask)===r.network;
};
export function planRestore(managed,live,{interfaceName,serverIP,maxChanges=32}={}){
 if(!Array.isArray(managed)||managed.length>512||!Array.isArray(live)||!interfaceName)throw Error('invalid_recovery_state');
 if(isIP(serverIP)!==4)throw Error('server_address_required');
 const peers=validateSnapshot(live),missing=[],seen=new Set(),addresses=new Set();
 for(const p of managed){
  publicKey(p.publicKey);
  if(typeof p.allowedIP!=='string'||!p.allowedIP.endsWith('/32'))throw Error('invalid_managed_peer');
  cidr(p.allowedIP);
  if(seen.has(p.publicKey)||addresses.has(p.allowedIP))throw Error('duplicate_managed_peer');
  if(covers(p.allowedIP,serverIP+'/32'))throw Error('server_address_conflict');
  seen.add(p.publicKey);addresses.add(p.allowedIP);
  const found=peers.find(x=>x.publicKey===p.publicKey);
  if(found){
   if(found.allowedIPs.length!==1||found.allowedIPs[0]!==p.allowedIP)throw Error('managed_peer_drift');
   continue;
  }
  for(const other of peers){
   if(other.allowedIPs.some(route=>{
    try{return covers(p.allowedIP,route)}catch{return true}
   }))throw Error('address_conflict');
  }
  missing.push({publicKey:p.publicKey,allowedIP:p.allowedIP});
 }
 if(missing.length>maxChanges)throw Error('too_many_changes');
 return {schema:'network-wireguard-restore-plan-v1',interface:interfaceName,
  missing,alreadyPresent:managed.length-missing.length,
  liveState:digest(peers),desiredState:digest(managed)};
}
export async function applyRestore({backend,plan,recheck,runner}){
 if(!plan||plan.schema!=='network-wireguard-restore-plan-v1'||typeof recheck!=='function'||typeof runner!=='function')throw Error('invalid_restore');
 const current=await backend.state(plan.interface);
 const verified=planRestore(recheck.managed,current,recheck.options);
 if(verified.liveState!==plan.liveState||verified.desiredState!==plan.desiredState)throw Error('recovery_state_changed');
 for(const peer of verified.missing){
  await runner(['set',plan.interface,'peer',peer.publicKey,'allowed-ips',peer.allowedIP]);
  const current=await backend.state(plan.interface);
  const found=current.find(p=>p.publicKey===peer.publicKey);
  if(!found||found.allowedIPs.length!==1||found.allowedIPs[0]!==peer.allowedIP)throw Error('recovery_readback_failed');
 }
 return {verified:true,restored:verified.missing.length,alreadyPresent:verified.alreadyPresent};
}
