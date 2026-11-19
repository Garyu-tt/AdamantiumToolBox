import {createHash} from 'node:crypto';
export const EVENT_SCHEMA='genesis.sensory.normalized.v1';
export const CONTEXT_SCHEMA='genesis.sensory.context.v1';
const name=s=>typeof s==='string'&&/^[a-z][a-z0-9_.-]{0,95}$/.test(s);
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(x));
export const cursorKey=(source,kind)=>JSON.stringify([source,kind]);
export const eventId=e=>createHash('sha256').update(cursorKey(e.source,e.kind)+'\0'+e.sequence).digest('hex');
export function validateNormalized(e){
 if(!plain(e)||Object.keys(e).some(k=>!['schema','source','kind','sequence','observedAtMs','traceId','signals','unit','payloadSha256'].includes(k))||
    e.schema!==EVENT_SCHEMA||!name(e.source)||!name(e.kind)||
    !Number.isSafeInteger(e.sequence)||e.sequence<0||
    !Number.isFinite(e.observedAtMs)||e.observedAtMs<0||!digest(e.payloadSha256)||
    !(e.traceId===null||e.traceId===undefined||name(e.traceId))||
    e.unit!=='raw'||!plain(e.signals))throw Error('invalid_normalized_event');
 const keys=Object.keys(e.signals);
 if(keys.length>16||keys.some(k=>k.length>96||['__proto__','prototype','constructor'].includes(k)||
    !Number.isFinite(e.signals[k])))throw Error('invalid_signal_values');
 if(Buffer.byteLength(JSON.stringify(e))>4096)throw Error('event_too_large');
}
export function validateContext(s,{maxSources=32,maxRecent=32}={}){
 if(!plain(s)||Object.keys(s).some(k=>!['schema','count','cursors','recent'].includes(k))||
    s.schema!==CONTEXT_SCHEMA||!Number.isSafeInteger(s.count)||s.count<0||
    !Array.isArray(s.cursors)||s.cursors.length>maxSources||
    !Array.isArray(s.recent)||s.recent.length>maxRecent||s.recent.length>s.count)
  throw Error('invalid_context');
 const keys=new Set();
 for(const c of s.cursors){
  if(!plain(c)||Object.keys(c).some(k=>!['source','kind','sequence','eventId','payloadSha256'].includes(k))||
     !name(c.source)||!name(c.kind)||!Number.isSafeInteger(c.sequence)||
     c.sequence<0||!digest(c.payloadSha256)||c.eventId!==eventId(c))throw Error('invalid_cursor');
  const key=cursorKey(c.source,c.kind);if(keys.has(key))throw Error('duplicate_cursor');keys.add(key);
 }
 const seen=new Set(),lastSequence=new Map();
 for(const e of s.recent){
  validateNormalized(e);
  const key=cursorKey(e.source,e.kind),prev=lastSequence.get(key);
  if(prev!==undefined&&e.sequence<=prev)throw Error('recent_order');
  lastSequence.set(key,e.sequence);
  const c=s.cursors.find(c=>cursorKey(c.source,c.kind)===key);
  const id=eventId(e);if(seen.has(id))throw Error('duplicate_recent_event');seen.add(id);
  if(!c||e.sequence>c.sequence||(e.sequence===c.sequence&&e.payloadSha256!==c.payloadSha256))
   throw Error('context_cursor_mismatch');
 }
 if(Buffer.byteLength(JSON.stringify(s))>65536)throw Error('context_too_large');
}
export function emptyContext(){return {schema:CONTEXT_SCHEMA,count:0,cursors:[],recent:[]};}
