import {createHash} from 'node:crypto';
export const QUEUE_SCHEMA='dante.sensory.queue.v1';
export const hash=s=>createHash('sha256').update(s).digest('hex');
const validId=v=>typeof v==='string'&&/^[a-z][a-z0-9_.-]{0,95}$/.test(v);
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
function safe(v,seen=new Set(),depth=0){
 if(v===null||typeof v==='string'||typeof v==='boolean')return true;
 if(typeof v==='number')return Number.isFinite(v);
 if(typeof v!=='object'||depth>16||seen.has(v))return false;
 if(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)return false;
 const keys=Object.keys(v);
 if(keys.length>2048||(Array.isArray(v)&&keys.length!==v.length))return false;
 seen.add(v);
 const ok=keys.every(k=>safe(v[k],seen,depth+1));seen.delete(v);
 return ok;
}
export const keyOf=e=>JSON.stringify([e.source,e.kind]);
export function encoded(event,maxBytes){
 if(!obj(event)||event.schema!=='dante.sensory.event.v1'||!validId(event.source)||!validId(event.kind)||
    !Number.isSafeInteger(event.sequence)||event.sequence<0||
    !Number.isFinite(event.observedAtMs)||event.observedAtMs<0||
    !obj(event.payload)||(event.traceId!==undefined&&!validId(event.traceId))||!safe(event))
  throw Error('invalid_event');
 const payload=JSON.stringify(event),bytes=Buffer.byteLength(payload);
 if(bytes>maxBytes)throw Error('event_too_large');
 return {id:hash(keyOf(event)+'\0'+event.sequence),event:JSON.parse(payload),bytes};
}
export function validateState(s,{capacity,maxSources,maxEventBytes}){
 if(!obj(s)||s.schema!==QUEUE_SCHEMA||!Array.isArray(s.entries)||!Array.isArray(s.cursors)||
   !Array.isArray(s.acked)||s.entries.length>capacity||s.cursors.length>maxSources||s.acked.length>64)
  throw Error('invalid_queue_state');
 const cursor=new Map();
 for(const pair of s.cursors){
  if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||
     !Number.isSafeInteger(pair[1])||pair[1]<0||cursor.has(pair[0]))throw Error('invalid_cursors');
  let parsed;try{parsed=JSON.parse(pair[0]);}catch{throw Error('invalid_cursor_key');}
  if(!Array.isArray(parsed)||parsed.length!==2||!parsed.every(validId)||
     JSON.stringify(parsed)!==pair[0])throw Error('invalid_cursor_key');
  cursor.set(pair[0],pair[1]);
 }
 const ids=new Set();
 for(const item of s.entries){
  const data=encoded(item?.event,maxEventBytes),key=keyOf(data.event);
  if(item.id!==data.id||ids.has(item.id)||!cursor.has(key)||cursor.get(key)<data.event.sequence)
   throw Error('invalid_queued_event');
  ids.add(item.id);
 }
 if(s.acked.some(x=>typeof x!=='string'||!/^[0-9a-f]{64}$/.test(x)||ids.has(x))||
    new Set(s.acked).size!==s.acked.length)throw Error('invalid_ack_record');
 return s;
}
