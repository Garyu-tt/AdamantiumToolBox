import {createPublicKey,createPrivateKey,sign,verify} from 'node:crypto';
import {digest,validatePayload} from './bundle.mjs';
export {identity} from '../../core/node_identity.mjs';
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
