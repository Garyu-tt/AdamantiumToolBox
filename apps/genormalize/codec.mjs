import {createHash} from 'node:crypto';
export const OUTPUT_SCHEMA='genesis.sensory.normalized.v1';
const name=s=>typeof s==='string'&&/^[a-z][a-z0-9_.-]{0,95}$/.test(s);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
function clean(v,depth=0,seen=new WeakSet()){
 if(depth>8)throw Error('max_depth');
 if(v===null||typeof v==='boolean')return v;
 if(typeof v==='number'&&Number.isFinite(v))return v;
 if(typeof v==='string'&&v.length<=1024)return v;
 if(typeof v!=='object'||v===null)throw Error('invalid_value');
 if(seen.has(v))throw Error('cyclic_value');
 seen.add(v);
 try {
  if(Array.isArray(v)){
   if(v.length>64)throw Error('array_too_large');
   const desc=Object.getOwnPropertyDescriptors(v);
   if(Reflect.ownKeys(desc).some(k=>typeof k!=='string'))throw Error('invalid_value');
   if(Object.keys(desc).some(k=>k!=='length'&&
     (!/^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=v.length)))throw Error('invalid_value');
   const out=[];
   for(let i=0;i<v.length;i++){
    const d=desc[String(i)];
    if(!d||!('value' in d))throw Error('invalid_value');
    out.push(clean(d.value,depth+1,seen));
   }
   return out;
  }
  if(!plain(v))throw Error('invalid_value');
  const desc=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(desc);
  if(keys.length>64)throw Error('too_many_keys');
  if(keys.some(k=>typeof k!=='string'))throw Error('invalid_value');
  const obj=Object.create(null);
  for(const k of keys.sort()){
   if(k.length>96||['__proto__','constructor','prototype'].includes(k))throw Error('unsafe_key');
   const d=desc[k];
   if(!d.enumerable||!('value' in d))throw Error('invalid_value');
   obj[k]=clean(d.value,depth+1,seen);
  }
  return obj;
 } finally {seen.delete(v);}
}
export function normalizeSensor(input){
 if(!plain(input))throw Error('invalid_event');
 // Validate a descriptor-only snapshot, never execute caller getters.
 const event=clean(input);
 if(event.schema!=='dante.sensory.event.v1'||!name(event.source)||!name(event.kind)||
    !Number.isSafeInteger(event.sequence)||event.sequence<0||
    !Number.isFinite(event.observedAtMs)||event.observedAtMs<0||
    !plain(event.payload)||(event.traceId!==undefined&&!name(event.traceId)))throw Error('invalid_event');
 const payload=event.payload,canonical=JSON.stringify(payload);
 if(Buffer.byteLength(canonical)>8192)throw Error('payload_too_large');
 const allScalars=Object.keys(payload).filter(k=>typeof payload[k]==='number');
 if(allScalars.some(k=>!name(k)))throw Error('invalid_signal_name');
 const scalars=allScalars.slice(0,16);
 const signals=Object.fromEntries(scalars.map(k=>[k,payload[k]]));
 return {schema:OUTPUT_SCHEMA,source:event.source,kind:event.kind,
  sequence:event.sequence,observedAtMs:event.observedAtMs,
  traceId:event.traceId??null,signals,unit:'raw',
  payloadSha256:createHash('sha256').update(canonical).digest('hex')};
}
