import {createHash, createPublicKey, verify} from 'node:crypto';

export const SIDES=Object.freeze(['source','destination']);
const fieldKeys=['source','destination','principal','protocol','port'];
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9:._/-]{0,127}$/i.test(v);
const hash=content=>createHash('sha256').update(content).digest('hex');
export function validFlow(f){
 return f&&typeof f==='object'&&!Array.isArray(f)&&
  id(f.source)&&id(f.destination)&&f.source!==f.destination&&id(f.principal)&&
  ['tcp','udp','icmp'].includes(f.protocol)&&Number.isInteger(f.port)&&
  (f.protocol==='icmp'?f.port===0:f.port>=1&&f.port<=65535);
}
export function canonicalFlow(f){
 if(!validFlow(f))throw Error('invalid_flow');
 return Object.fromEntries(fieldKeys.map(k=>[k,f[k]]));
}
export function proposal(f,revision,expiresAt){
 const flow=canonicalFlow(f);
 if(typeof revision!=='string'||revision.length<1||revision.length>128)throw Error('invalid_revision');
 if(typeof expiresAt!=='string'||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now())throw Error('invalid_expiry');
 const content={schema:'network-policy-proposal-v1',flow,revision,expiresAt};
 return {...content,proposalHash:hash(JSON.stringify(content)),signingContract:'network-fabric-approval-v1',requires:[...SIDES],mode:'proposal_only'};
}
function sameFlow(x,f){return fieldKeys.every(k=>x?.[k]===f[k]);}
function active(x,now){return typeof x?.expiresAt==='string'&&Number.isFinite(Date.parse(x.expiresAt))&&Date.parse(x.expiresAt)>now;}
export function approvalPayload(a){
 return Buffer.from(JSON.stringify({schema:'network-fabric-approval-v1',side:a.side,
  source:a.source,destination:a.destination,principal:a.principal,protocol:a.protocol,
  port:a.port,revision:a.revision,keyId:a.keyId,expiresAt:a.expiresAt}),'utf8');
}
function checkApproval(a, pinned, now){
 if(!a||!pinned||!id(a.keyId)||a.keyId!==pinned.keyId||!active(a,now)||
    typeof a.signature!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(a.signature))return false;
 try{
  const key=createPublicKey(pinned.publicKey);
  const sig=Buffer.from(a.signature,'base64');
  if(key.asymmetricKeyType!=='ed25519'||sig.length!==64||sig.toString('base64')!==a.signature)return false;
  return verify(null,approvalPayload(a),key,sig);
 }catch{return false;}
}
function distinct(trust){
 try{
  const a=createPublicKey(trust.source.publicKey), b=createPublicKey(trust.destination.publicKey);
  return a.asymmetricKeyType==='ed25519'&&b.asymmetricKeyType==='ed25519'&&
   !a.export({type:'spki',format:'der'}).equals(b.export({type:'spki',format:'der'}));
 }catch{return false;}
}
export function inspect({flow,state,expectedRevision,now=Date.now()}){
 const denial=(reasons)=>({authorized:false,reasons,authoritative:false,needsEnforcement:true});
 if(!validFlow(flow))return denial(['invalid_flow']);
 if(!state||!Array.isArray(state.policies)||!Array.isArray(state.approvals)||!state.trust||!Number.isFinite(now))return denial(['invalid_state']);
 if(typeof expectedRevision!=='string'||expectedRevision!==state.revision)return denial(['revision_mismatch']);
 if(!distinct(state.trust))return denial(['untrusted_or_shared_signer']);
 const reasons=[];
 for(const side of SIDES){
  const entries=state.policies.filter(p=>p?.side===side&&sameFlow(p,flow)&&active(p,now));
  if(entries.some(p=>p.effect==='deny')){reasons.push(side+'_explicit_deny');continue;}
  const grants=entries.filter(p=>p.effect==='allow'&&p.revision===expectedRevision);
  if(grants.length!==1){reasons.push(side+'_grant_missing_or_ambiguous');continue;}
  const matching=state.approvals.filter(a=>a?.side===side&&a.revision===expectedRevision&&sameFlow(a,flow)&&checkApproval(a,state.trust[side],now));
  if(matching.length!==1)reasons.push(side+'_signature_missing_or_ambiguous');
 }
 return {authorized:reasons.length===0,reasons,authoritative:false,needsEnforcement:true,revision:state.revision};
}
