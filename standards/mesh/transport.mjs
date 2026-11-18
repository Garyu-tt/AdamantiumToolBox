import {sign,verify,createPrivateKey,createPublicKey,randomUUID} from 'node:crypto';
import {digest} from './bundle.mjs';
const nonces=new Map();
const MAX_AGE=60000;
function content(method,path,time,nonce,body){
 return [method.toUpperCase(),path,String(time),nonce,digest(body)].join('\n');
}
export function signedHeaders(owner,method,path,body=''){
 const time=Date.now(),nonce=randomUUID();
 const message=content(method,path,time,nonce,body);
 const signature=sign(null,Buffer.from(message),createPrivateKey(owner.privateKey)).toString('base64');
 return {'X-Mas-Node':owner.id,'X-Mas-Time':String(time),
  'X-Mas-Nonce':nonce,'X-Mas-Signature':signature};
}
export function authorize(req,body,trust){
 const id=req.headers['x-mas-node'],time=Number(req.headers['x-mas-time']);
 const nonce=req.headers['x-mas-nonce'],signature=req.headers['x-mas-signature'];
 const rule=trust[id];
 if(!rule?.receive||!rule.publicKey)throw Error('peer_not_trusted');
 if(!Number.isSafeInteger(time)||Math.abs(Date.now()-time)>MAX_AGE)throw Error('stale_request');
 if(typeof nonce!=='string'||!/^[0-9a-f-]{36}$/.test(nonce))throw Error('bad_nonce');
 if(typeof signature!=='string'||!(/^[A-Za-z0-9+/]*={0,2}$/).test(signature))throw Error('bad_signature');
 const bytes=Buffer.from(signature,'base64');
 if(bytes.length!==64)throw Error('bad_signature');
 const signed=content(req.method,req.url,time,nonce,body);
 if(!verify(null,Buffer.from(signed),createPublicKey(rule.publicKey),bytes))throw Error('bad_signature');
 const key=id+':'+nonce;
 if(nonces.has(key))throw Error('replayed_request');
 nonces.set(key,Date.now());
 if(nonces.size>2000)for(const [k,at] of nonces)if(Date.now()-at>MAX_AGE)nonces.delete(k);
 return id;
}
export function trustedUrl(input){
 const url=new URL(input);
 const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 if(url.username||url.password||url.hash)throw Error('unsafe_peer_url');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local))throw Error('tls_required');
 return url;
}
