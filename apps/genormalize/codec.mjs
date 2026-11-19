import {createHash} from 'node:crypto';
export const OUTPUT_SCHEMA='genesis.sensory.normalized.v1';
const name=s=>typeof s==='string'&&/^[a-z][a-z0-9_.-]{0,95}$/.test(s);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
function clean(v,depth=0){
 if(depth>8)throw Error('max_depth');
 if(v===null||typeof v==='boolean')return v;
 if(typeof v==='number'&&Number.isFinite(v))return v;
 if(typeof v==='string'&&v.length<=1024)return v;
 if(Array.isArray(v)){
  if(v.length>64)throw Error('array_too_large');
  return v.map(x=>clean(x,depth+1));
 }
 if(!plain(v))throw Error('invalid_value');
 const keys=Object.keys(v).sort();
 if(keys.length>64)throw Error('too_many_keys');
 const obj=Object.create(null);
 for(const k of keys){if(k.length>96||['__proto__','constructor','prototype'].includes(k))throw Error('unsafe_key');
  obj[k]=clean(v[k],depth+1);}
 return obj;
}
export function normalizeSensor(event){
 if(!plain(event)||event.schema!=='dante.sensory.event.v1'||!name(event.source)||!name(event.kind)||
    !Number.isSafeInteger(event.sequence)||event.sequence<0||
    !Number.isFinite(event.observedAtMs)||event.observedAtMs<0||
    !plain(event.payload)||(event.traceId!==undefined&&!name(event.traceId)))throw Error('invalid_event');
 const payload=clean(event.payload),canonical=JSON.stringify(payload);
 if(Buffer.byteLength(canonical)>8192)throw Error('payload_too_large');
 const scalars=Object.keys(payload).filter(k=>typeof payload[k]==='number').slice(0,16);
 const signals=Object.fromEntries(scalars.map(k=>[k,payload[k]]));
 return {schema:OUTPUT_SCHEMA,source:event.source,kind:event.kind,
  sequence:event.sequence,observedAtMs:event.observedAtMs,
  traceId:event.traceId??null,signals,unit:'raw',
  payloadSha256:createHash('sha256').update(canonical).digest('hex')};
}
