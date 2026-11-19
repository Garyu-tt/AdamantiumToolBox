// Signed short-lived claims, NOT independent proof of legal recording consent.
import {createHmac,randomBytes} from 'node:crypto';
import {bindingsOK,decodePermit} from '../../contracts/mikoshi-av-permit.mjs';
const PURPOSE='audiovisual-association-training',TTL=60000;
const DIGEST=/^[0-9a-f]{64}$/;
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function signature(secret,payload){
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32)
  throw Error('source_signing_key_missing');
 return createHmac('sha256',secret).update(payload).digest('base64url');
}
export function validateClaim(claim){
 if(!claim||claim.sourceKind!=='user-live-av'||
  claim.captureMethod!=='explicit-gesture'||
  claim.purpose!==PURPOSE||
  claim.captureConsent!==true||claim.subjectsConsentConfirmed!==true||
  claim.noThirdPartyMedia!==true||claim.rawRetention!==false||
  !Number.isInteger(claim.sessionDurationMs)||claim.sessionDurationMs<400||
  claim.sessionDurationMs>2500||
  !Number.isInteger(claim.pairs)||claim.pairs<1||claim.pairs>12||
  typeof claim.digest!=='string'||!DIGEST.test(claim.digest))
  throw Error('source_policy_denied');
 if(claim.pairBindings!==undefined&&
  !bindingsOK(claim.pairBindings,claim.pairs))
  throw Error('invalid_source_pair_bindings');
 return {sourceKind:claim.sourceKind,purpose:claim.purpose,
  pairs:claim.pairs,digest:claim.digest,
  ...(claim.pairBindings?{pairBindings:claim.pairBindings}:{})};
}
export function issue(secret,claim,now){
 const fields=validateClaim(claim);
 if(!Number.isSafeInteger(now)||now<0)throw Error('invalid_source_clock');
 const payload=encode({...fields,issuedAt:now,expiresAt:now+TTL,
  nonce:randomBytes(12).toString('hex'),v:fields.pairBindings?2:1});
 return {schema:'mikoshi.source.permit.v1',token:payload+'.'+signature(secret,payload),
  expiresAt:now+TTL,verifiedConsent:false,operatorAttested:true};
}
export function verify(secret,token,digest,purpose,now){
 const p=decodePermit(secret,token,now);
 if(p.digest!==digest||p.purpose!==purpose)
  throw Error('source_permit_expired_or_mismatched');
 return {schema:'mikoshi.source.verification.v1',allowed:true,
  pairs:p.pairs,expiresAt:p.expiresAt,
  permitVersion:p.v,verifiedConsent:false,
  operatorAttested:true,oneTime:false};
}
