import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {generateKeyPairSync,createPublicKey,createPrivateKey,sign,verify,randomUUID} from 'node:crypto';
import {digest,validatePayload} from './bundle.mjs';
export async function identity(root){
 await mkdir(root,{recursive:true});
 const path=join(root,'identity.json');
 try{return JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const keys=generateKeyPairSync('ed25519');
 const data={id:randomUUID(),publicKey:keys.publicKey.export({type:'spki',format:'pem'}),
 privateKey:keys.privateKey.export({type:'pkcs8',format:'pem'})};
 try{await writeFile(path,JSON.stringify(data),{flag:'wx',mode:0o600});}
 catch(e){if(e.code!=='EEXIST')throw e;
  return JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));}
 return data;
}
export function seal(payload,owner){
 validatePayload(payload);
 const hash=digest(JSON.stringify(payload));
 const signature=sign(null,Buffer.from(hash,'utf8'),createPrivateKey(owner.privateKey)).toString('base64');
 return {schema:'mas-envelope-1',hash,origin:owner.id,signature,payload};
}
export function trustEnvelope(envelope,trust){
 if(envelope?.schema!=='mas-envelope-1'||typeof envelope.origin!=='string')throw Error('bad_envelope');
 if(!/^[0-9a-f]{64}$/.test(envelope.hash||''))throw Error('bad_digest');
 const rule=trust[envelope.origin];
 if(!rule||!rule.publicKey||!rule.receive)throw Error('untrusted_origin');
 if(digest(JSON.stringify(envelope.payload))!==envelope.hash)throw Error('tampered_package');
 const signature=Buffer.from(envelope.signature||'','base64');
 if(signature.length!==64||!verify(null,Buffer.from(envelope.hash),createPublicKey(rule.publicKey),signature))throw Error('bad_signature');
 const {manifest,bytes}=validatePayload(envelope.payload);
 return {rule,manifest,bytes};
}
