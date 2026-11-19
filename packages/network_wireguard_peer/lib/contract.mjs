import {createHash,createPublicKey,verify,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';

const keyRE=/^[A-Za-z0-9+/]{43}=$/;
const nonceRE=/^[A-Za-z0-9_-]{16,64}$/;
const ifaceRE=/^[a-zA-Z0-9_.=-]{1,15}$/;
const digestRE=/^[0-9a-f]{64}$/;

export const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const numericIP=value=>{
 if(isIP(value)!==4)throw Error('invalid_ipv4');
 const pieces=value.split('.');
 if(pieces.some(x=>x.length>1&&x.startsWith('0')))throw Error('invalid_ipv4');
 return pieces.reduce((n,p)=>(n*256+Number(p))>>>0,0);
};
export function inPool(address,cidr){
 if(typeof cidr!=='string')throw Error('unconfigured_pool');
 const m=/^([^/]+)\/(\d{1,2})$/.exec(cidr);
 if(!m)throw Error('invalid_pool');
 const bits=Number(m[2]);
 if(!Number.isInteger(bits)||bits<16||bits>30)throw Error('invalid_pool');
 const n=numericIP(m[1]),ip=numericIP(address),mask=(0xffffffff<<(32-bits))>>>0;
 if((ip&mask)!==(n&mask))return false;
 const host=ip&(~mask>>>0);
 return host!==0&&host!==(~mask>>>0);
}
export function publicKey(value){
 if(typeof value!=='string'||!keyRE.test(value)||Buffer.from(value,'base64').length!==32)throw Error('invalid_public_key');
 return value;
}
export function validatePlan(plan,config,now=Date.now()){
 if(!plan||typeof plan!=='object'||Array.isArray(plan)||
  Object.keys(plan).sort().join(',')!=='allowedIP,expectedState,expiresAt,interface,nonce,operation,peerPublicKey,schema')throw Error('invalid_plan');
 if(plan.schema!=='network-wireguard-peer-plan-v1'||!['add','remove'].includes(plan.operation))throw Error('invalid_plan');
 if(typeof plan.interface!=='string'||!ifaceRE.test(plan.interface)||plan.interface!==config.interface)throw Error('unapproved_interface');
 publicKey(plan.peerPublicKey);
 if(typeof plan.allowedIP!=='string'||!plan.allowedIP.endsWith('/32')||
   !inPool(plan.allowedIP.slice(0,-3),config.pool))throw Error('unapproved_address');
 if(typeof plan.nonce!=='string'||!nonceRE.test(plan.nonce))throw Error('invalid_nonce');
 if(typeof plan.expectedState!=='string'||!digestRE.test(plan.expectedState))throw Error('invalid_revision');
 if(!Number.isSafeInteger(plan.expiresAt)||plan.expiresAt<=now||plan.expiresAt>now+600000)throw Error('expired_or_unbounded_plan');
 return plan;
}
export function validateSnapshot(peers){
 if(!Array.isArray(peers)||peers.length>2048)throw Error('invalid_snapshot');
 const found=new Set(),addresses=new Set();
 const result=[];
 for(const p of peers){
  publicKey(p.publicKey);
  if(found.has(p.publicKey)||!Array.isArray(p.allowedIPs)||p.allowedIPs.length>256)throw Error('invalid_snapshot');
  found.add(p.publicKey);
  for(const cidr of p.allowedIPs){
   if(typeof cidr!=='string'||cidr.length>64)throw Error('invalid_snapshot');
   if(addresses.has(cidr))throw Error('invalid_snapshot');
   addresses.add(cidr);
  }
  result.push({publicKey:p.publicKey,allowedIPs:[...p.allowedIPs].sort()});
 }
 return result.sort((a,b)=>a.publicKey.localeCompare(b.publicKey));
}
export const snapshotHash=peers=>digest(validateSnapshot(peers));
export function checkTransition(plan,peers){
 const snapshot=validateSnapshot(peers);
 if(snapshotHash(snapshot)!==plan.expectedState)throw Error('stale_state');
 const existing=snapshot.find(p=>p.publicKey===plan.peerPublicKey);
 if(plan.operation==='add'){
  if(existing||snapshot.some(p=>p.allowedIPs.includes(plan.allowedIP)))throw Error('peer_or_address_in_use');
 }else if(!existing||existing.allowedIPs.length!==1||existing.allowedIPs[0]!==plan.allowedIP){
  throw Error('peer_state_mismatch');
 }
}
export function authorizedSignatures(plan,proofs,trust){
 if(!proofs||typeof proofs!=='object'||!trust||
  typeof proofs.source!=='string'||typeof proofs.destination!=='string')throw Error('approval_required');
 try{
  const a=createPublicKey(trust.sourcePublicKeyPem),b=createPublicKey(trust.destinationPublicKeyPem);
  if(a.asymmetricKeyType!=='ed25519'||b.asymmetricKeyType!=='ed25519'||
    a.export({type:'spki',format:'der'}).equals(b.export({type:'spki',format:'der'})))throw Error('distinct_signers_required');
  const msg=Buffer.from(JSON.stringify(plan),'utf8');
  for(const [pub,sig] of [[a,proofs.source],[b,proofs.destination]]){
   if(!keyRE.test(sig)&&!/^[A-Za-z0-9+/]{86}==$/.test(sig))throw Error('invalid_signature');
   const bytes=Buffer.from(sig,'base64');
   if(bytes.length!==64||!verify(null,msg,pub,bytes))throw Error('signature_invalid');
  }
 }catch(err){
  if(['distinct_signers_required','invalid_signature','signature_invalid'].includes(err.message))throw err;
  throw Error('approval_invalid');
 }
 return true;
}
export function authorizedInternalKey(input,expected){
 if(typeof input!=='string'||typeof expected!=='string'||expected.length<24)return false;
 const a=Buffer.from(input),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
