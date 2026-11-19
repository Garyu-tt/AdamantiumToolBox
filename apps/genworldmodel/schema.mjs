import {createHash} from 'node:crypto';
export const MODEL_SCHEMA='genesis.worldmodel.state.v1';
export const UPDATE_SCHEMA='genesis.worldmodel.update.result.v1';
const name=s=>typeof s==='string'&&/^[a-z][a-z0-9_.-]{0,95}$/.test(s);
const hash=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 [Object.prototype,null].includes(Object.getPrototypeOf(x));
const safeSignal=s=>typeof s==='string'&&s.length>0&&s.length<=96&&
 !['__proto__','constructor','prototype'].includes(s);
// Digest of normalized feature values, independent of caller-supplied raw payload hash.
export const signalsDigest=signals=>createHash('sha256').update(JSON.stringify(
 Object.entries(signals).sort(([a],[b])=>a<b?-1:a>b?1:0))).digest('hex');
export const entityId=x=>JSON.stringify([x.source,x.kind]);
export const eventId=e=>createHash('sha256').update(entityId(e)+'\0'+e.sequence).digest('hex');
export const emptyModel=()=>({schema:MODEL_SCHEMA,revision:0,lastEventId:null,entities:[]});
export function validateObservation(o){
 if(!plain(o)||o.schema!=='genesis.sensory.normalized.v1'||!name(o.source)||!name(o.kind)||
    !Number.isSafeInteger(o.sequence)||o.sequence<0||!Number.isFinite(o.observedAtMs)||
    o.observedAtMs<0||!hash(o.payloadSha256)||o.unit!=='raw'||!plain(o.signals)||
    !(o.traceId==null||name(o.traceId)))throw Error('invalid_observation');
 const keys=Object.keys(o.signals);
 if(keys.length>16||keys.some(k=>!safeSignal(k)||!Number.isFinite(o.signals[k])))throw Error('invalid_signals');
 if(Buffer.byteLength(JSON.stringify(o))>4096)throw Error('observation_too_large');
}
export function validateModel(model,{maxEntities=32}={}){
 if(!plain(model)||model.schema!==MODEL_SCHEMA||!Number.isSafeInteger(model.revision)||
    model.revision<0||!(model.lastEventId===null||hash(model.lastEventId))||
    !Array.isArray(model.entities)||model.entities.length>maxEntities||
    model.entities.length>model.revision)throw Error('invalid_worldmodel_state');
 const seen=new Set();
 for(const e of model.entities){
  if(!plain(e)||!name(e.source)||!name(e.kind)||!Number.isSafeInteger(e.sequence)||e.sequence<0||
     !Number.isFinite(e.observedAtMs)||e.observedAtMs<0||!hash(e.payloadSha256)||
     !Number.isSafeInteger(e.samples)||e.samples<1||e.samples>model.revision||
     e.id!==entityId(e)||e.eventId!==eventId(e)||!plain(e.features)||!hash(e.signalsSha256)||
     e.signalsSha256!==signalsDigest(e.features))throw Error('invalid_entity');
  const keys=Object.keys(e.features);
  if(seen.has(e.id)||keys.length>16||keys.some(k=>!safeSignal(k)||!Number.isFinite(e.features[k])))
   throw Error('invalid_entity_features');
  seen.add(e.id);
 }
 if(Buffer.byteLength(JSON.stringify(model))>65536)throw Error('worldmodel_too_large');
}
