// Static versioned inter-plugin data contract. No MAS runtime dependencies.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export const PURPOSE='audiovisual-association-training';
const HASH=/^[0-9a-f]{64}$/;
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const audioHash=(samples,sampleRate)=>digest({samples,sampleRate});
export const visualHash=(visualVector,visualAtMs,soundAtMs)=>
 digest({visualVector,visualAtMs,soundAtMs});
export function bindingsOK(bindings,count){
 return Array.isArray(bindings)&&bindings.length===count&&count>=1&&count<=12&&
  bindings.every(p=>p&&HASH.test(p.audioHash)&&HASH.test(p.visualHash));
}
function mac(secret,body,domain=''){
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32)
  throw Error('source_signing_key_missing');
 return createHmac('sha256',secret).update(domain+body).digest('base64url');
}
function decode(secret,token,domain=''){
 if(typeof token!=='string'||token.length>4000)throw Error('invalid_source_permit');
 const parts=token.split('.');
 if(parts.length!==2||!parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x)))
  throw Error('invalid_source_permit');
 const expected=Buffer.from(mac(secret,parts[0],domain),'base64url');
 const supplied=Buffer.from(parts[1],'base64url');
 if(expected.length!==supplied.length||!timingSafeEqual(expected,supplied))
  throw Error('invalid_source_signature');
 try{return JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));}
 catch{throw Error('invalid_source_permit');}
}
export function decodePermit(secret,token,now){
 if(!Number.isSafeInteger(now)||now<0)throw Error('invalid_source_clock');
 const p=decode(secret,token);
 if((p.v!==1&&p.v!==2)||p.purpose!==PURPOSE||
  p.sourceKind!=='user-live-av'||!HASH.test(p.digest)||
  !Number.isInteger(p.pairs)||p.pairs<1||p.pairs>12||
  !Number.isSafeInteger(p.issuedAt)||!Number.isSafeInteger(p.expiresAt)||
  p.expiresAt-p.issuedAt!==60000||
  now<p.issuedAt||now>p.expiresAt||
  (p.v===2&&!bindingsOK(p.pairBindings,p.pairs)))
  throw Error('source_permit_expired_or_mismatched');
 return p;
}
export function checkTicket(secret,params,now){
 const p=decodePermit(secret,params?.sourcePermit,now);
 const index=params?.pairIndex;
 if(p.v!==2||p.digest!==params?.lessonDigest||
  !Number.isInteger(index)||index<0||index>=p.pairs)
  throw Error('source_pair_permit_required');
 return {permit:p,pair:p.pairBindings[index],index,
  key:digest({token:params.sourcePermit,index})};
}
export function checkPair(secret,params,kind,now){
 const proof=checkTicket(secret,params,now);
 const actual=kind==='audio'?audioHash(params.samples,params.sampleRate):
  kind==='visual'?visualHash(params.visualVector,
   params.visualAtMs,params.soundAtMs):null;
 if(!actual||actual!==proof.pair[kind+'Hash'])
  throw Error('source_pair_digest_mismatch');
 return proof;
}
export function signReceipt(secret,proof,soundId){
 const p={v:1,lessonDigest:proof.permit.digest,index:proof.index,
  audioHash:proof.pair.audioHash,soundId};
 const body=Buffer.from(JSON.stringify(p)).toString('base64url');
 return body+'.'+mac(secret,body,'motif-receipt:');
}
export function verifyReceipt(secret,receipt,proof,soundId){
 const r=decode(secret,receipt,'motif-receipt:');
 if(r.v!==1||r.lessonDigest!==proof.permit.digest||
  r.index!==proof.index||r.audioHash!==proof.pair.audioHash||
  r.soundId!==soundId)throw Error('source_receipt_mismatch');
 return true;
}
export function journal(state,proof,result){
 const now=Date.now(),entries=(state.sourceWrites||[]).filter(
  x=>x.expiresAt>=now);
 if(entries.length>=256)throw Error('source_journal_full');
 state.sourceWrites=[...entries,{key:proof.key,
  expiresAt:proof.permit.expiresAt,result}];
}
export function replay(state,proof){
 return (state.sourceWrites||[]).find(x=>x.key===proof.key)?.result??null;
}
