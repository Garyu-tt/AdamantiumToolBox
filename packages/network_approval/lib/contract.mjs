import {createHash,createPublicKey,verify,randomBytes} from 'node:crypto';

export const SCHEMA='network-approval-request-v1';
export const TRUST_SCHEMA='network-approval-trust-v1';
export const SIDES=Object.freeze(['source','destination']);
export const MAX_LIFETIME_MS=30*24*3600*1000;
const ident=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/.test(v);
const rev=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(v);
const hex=v=>typeof v==='string'&&/^[0-9a-f]{32}$/.test(v);
const expiry=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const hash=v=>createHash('sha256').update(v).digest('hex');
export const sha256=v=>hash(typeof v==='string'?v:JSON.stringify(v));
export function validFlow(f){
 return !!f&&typeof f==='object'&&!Array.isArray(f)&&ident(f.source)&&ident(f.destination)&&
 f.source!==f.destination&&ident(f.principal)&&['tcp','udp','icmp'].includes(f.protocol)&&
 Number.isInteger(f.port)&&(f.protocol==='icmp'?f.port===0:f.port>=1&&f.port<=65535);
}
export function canonicalRequest(r){
 if(!r||r.schema!==SCHEMA||!hex(r.id)||!validFlow(r.flow)||!rev(r.revision)||!expiry(r.expiresAt))throw Error('invalid_request');
 const {source,destination,principal,protocol,port}=r.flow;
 return {schema:SCHEMA,id:r.id,flow:{source,destination,principal,protocol,port},revision:r.revision,expiresAt:r.expiresAt};
}
export function prepare({flow,revision,expiresAt},now=Date.now()){
 const r=canonicalRequest({schema:SCHEMA,id:randomBytes(16).toString('hex'),flow,revision,expiresAt});
 if(Date.parse(r.expiresAt)<=now||Date.parse(r.expiresAt)>now+MAX_LIFETIME_MS)throw Error('invalid_expiry');
 return {request:r,requestHash:sha256(r),sourcePayload:message(r,'source').toString('base64'),
  mode:'proof_required',enforcement:false};
}
export function message(request,side){
 if(!SIDES.includes(side))throw Error('invalid_side');
 const r=canonicalRequest(request);
 return Buffer.from('network-approval-sign-v1\n'+JSON.stringify({request:r,side}),'utf8');
}
export function revokeMessage(request,side,reason){
 if(!SIDES.includes(side)||!['owner_withdrawal','suspected_compromise','policy_change'].includes(reason))throw Error('invalid_revocation');
 const r=canonicalRequest(request);
 return Buffer.from('network-approval-revoke-v1\n'+JSON.stringify({requestHash:sha256(r),requestId:r.id,side,reason}),'utf8');
}
export function validateTrust(t){
 if(!t||t.schema!==TRUST_SCHEMA||!t.nodes||typeof t.nodes!=='object'||Array.isArray(t.nodes)||Object.keys(t.nodes).length>200)throw Error('invalid_trust');
 for(const [node,p] of Object.entries(t.nodes)){
  if(!ident(node)||!p||!ident(p.keyId)||typeof p.publicKey!=='string'||p.publicKey.length>1500)throw Error('invalid_trust');
  let key;try{key=createPublicKey(p.publicKey);}catch{throw Error('invalid_trust');}
  if(key.asymmetricKeyType!=='ed25519')throw Error('invalid_trust');
 }
 return t;
}
function strictSignature(signature){
 if(typeof signature!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(signature))return null;
 const raw=Buffer.from(signature,'base64');
 return raw.length===64&&raw.toString('base64')===signature?raw:null;
}
export function verifyProof(request,proof,trust,{kind='sign',reason=null}={}){
 let r;
 try{r=canonicalRequest(request);validateTrust(trust);}catch{return false;}
 if(!proof||!SIDES.includes(proof.side)||!ident(proof.keyId))return false;
 const node=r.flow[proof.side],pin=trust.nodes[node];
 if(!pin||pin.keyId!==proof.keyId)return false;
 const sig=strictSignature(proof.signature);if(!sig)return false;
 try{const bytes=kind==='revoke'?revokeMessage(r,proof.side,reason):message(r,proof.side);
  return verify(null,bytes,createPublicKey(pin.publicKey),sig);
 }catch{return false;}
}
export function distinctPins(request,trust){
 try{const r=canonicalRequest(request);
  const a=createPublicKey(trust.nodes[r.flow.source].publicKey).export({type:'spki',format:'der'});
  const b=createPublicKey(trust.nodes[r.flow.destination].publicKey).export({type:'spki',format:'der'});
  return !a.equals(b);
 }catch{return false;}
}
export function publicRequest(item,now=Date.now()){
 if(!item)return null;
 return {request:item.request,requestHash:sha256(item.request),
  sourceSigned:!!item.source,destinationSigned:!!item.destination,
  revoked:!!item.revoke,expiresAt:item.request.expiresAt,
  state:item.revoke?'revoked':Date.parse(item.request.expiresAt)<=now?'expired':item.destination?'bilaterally_signed':'pending',
  advisoryOnly:true,enforcement:false};
}
