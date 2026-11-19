// Signed short-lived claims, NOT independent proof of legal recording consent.
import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
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
 return {sourceKind:claim.sourceKind,purpose:claim.purpose,
  pairs:claim.pairs,digest:claim.digest};
}
export function issue(secret,claim,now){
 const fields=validateClaim(claim);
 if(!Number.isSafeInteger(now)||now<0)throw Error('invalid_source_clock');
 const payload=encode({...fields,issuedAt:now,expiresAt:now+TTL,
  nonce:randomBytes(12).toString('hex'),v:1});
 return {schema:'mikoshi.source.permit.v1',token:payload+'.'+signature(secret,payload),
  expiresAt:now+TTL,verifiedConsent:false,operatorAttested:true};
}
export function verify(secret,token,digest,purpose,now){
 if(typeof token!=='string'||token.length>2400||typeof digest!=='string'||
  !DIGEST.test(digest)||purpose!==PURPOSE||
  !Number.isSafeInteger(now)||now<0)throw Error('invalid_source_permit');
 const parts=token.split('.');
 if(parts.length!==2||!parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x)))
  throw Error('invalid_source_permit');
 const expected=Buffer.from(signature(secret,parts[0]),'base64url');
 const supplied=Buffer.from(parts[1],'base64url');
 if(expected.length!==supplied.length||!timingSafeEqual(expected,supplied))
  throw Error('invalid_source_signature');
 let payload;
 try{payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));}
 catch{throw Error('invalid_source_permit');}
 if(payload.v!==1||payload.purpose!==purpose||payload.digest!==digest||
  payload.sourceKind!=='user-live-av'||!Number.isInteger(payload.pairs)||
  payload.pairs<1||payload.pairs>12||
  !Number.isSafeInteger(payload.issuedAt)||
  !Number.isSafeInteger(payload.expiresAt)||
  payload.expiresAt-payload.issuedAt!==TTL||
  now<payload.issuedAt||now>payload.expiresAt)
  throw Error('source_permit_expired_or_mismatched');
 return {schema:'mikoshi.source.verification.v1',allowed:true,
  pairs:payload.pairs,expiresAt:payload.expiresAt,
  verifiedConsent:false,operatorAttested:true,oneTime:false};
}
