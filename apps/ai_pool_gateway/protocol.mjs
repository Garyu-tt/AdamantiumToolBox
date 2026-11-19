import {createHash, createPublicKey, verify, timingSafeEqual} from 'node:crypto';

export const canonical = (path, timestamp, requestId, body) =>
  Buffer.from('POST\n' + path + '\n' + timestamp + '\n' + requestId + '\n' +
    createHash('sha256').update(body).digest('base64'), 'utf8');

export function verifyDevice(headers, path, body, allowed, now=Date.now()) {
  const node=String(headers['x-ai-core-node']||'');
  const key64=String(headers['x-ai-core-key']||'');
  const stamp=String(headers['x-ai-core-timestamp']||'');
  const requestId=String(headers['x-ai-core-request']||'');
  const sig64=String(headers['x-ai-core-signature']||'');
  if(!/^[a-f0-9]{64}$/.test(node)||!/^[A-Za-z0-9+/=]{80,400}$/.test(key64)||
     !/^\d{13}$/.test(stamp)||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestId)||
     !/^[A-Za-z0-9+/=]{60,400}$/.test(sig64)) throw Error('invalid_device_headers');
  const milliseconds=Number(stamp);
  if(!Number.isSafeInteger(milliseconds)||Math.abs(now-milliseconds)>90000)throw Error('expired_request');
  const pub=Buffer.from(key64,'base64');
  const actualId=createHash('sha256').update(pub).digest('hex');
  if(node!==actualId)throw Error('device_id_mismatch');
  const entry=allowed?.nodes?.[node];
  if(!entry||entry.enabled!==true||typeof entry.keyBase64!=='string')throw Error('device_not_enrolled');
  const enrolled=Buffer.from(entry.keyBase64,'base64');
  if(enrolled.length!==pub.length||!timingSafeEqual(enrolled,pub))throw Error('device_key_mismatch');
  if(!Array.isArray(entry.allowedOps)||!entry.allowedOps.includes('ml.dense.f32'))
    throw Error('device_operation_denied');
  const key=createPublicKey({key:pub,format:'der',type:'spki'});
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')
    throw Error('unsupported_device_key');
  if(!verify('sha256',canonical(path,stamp,requestId,body),key,Buffer.from(sig64,'base64')))
    throw Error('bad_device_signature');
  return {node,requestId,entry};
}

function vec(v) {
  return Array.isArray(v)&&v.length>=1&&v.length<=64&&
    v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1000000);
}
export function validateDenseJob(j) {
  if(!j||typeof j!=='object'||!/^[A-Za-z0-9_-]{1,128}$/.test(j.id||'')||
     j.op!=='ml.dense.f32'||!vec(j.input)||!vec(j.bias)||
     !Array.isArray(j.weights)||j.weights.length!==j.bias.length||
     !j.weights.every(row=>vec(row)&&row.length===j.input.length)||
     !['none','relu'].includes(j.activation??'none'))throw Error('invalid_dense_job');
  return true;
}
