import {emptyModel,validateModel,validateObservation,entityId,eventId,UPDATE_SCHEMA} from './schema.mjs';
const clone=v=>JSON.parse(JSON.stringify(v));
const finiteOrNull=n=>Number.isFinite(n)?n:null;
export function updateWorldModel({model=null,observation,maxEntities=32}={}){
 if(!Number.isSafeInteger(maxEntities)||maxEntities<1||maxEntities>64)throw Error('invalid_limits');
 validateObservation(observation);
 const current=model===null?emptyModel():model;
 validateModel(current,{maxEntities});
 const id=entityId(observation),eid=eventId(observation);
 const previous=current.entities.find(e=>e.id===id);
 if(previous){
  if(observation.sequence<previous.sequence)throw Error('sequence_regression');
  if(observation.sequence===previous.sequence){
   if(previous.payloadSha256!==observation.payloadSha256)throw Error('sequence_conflict');
   return {schema:UPDATE_SCHEMA,status:'duplicate',eventId:eid,
    model:clone(current),changes:[]};
  }
  if(observation.sequence!==previous.sequence+1)throw Error('sequence_gap');
  if(observation.observedAtMs<previous.observedAtMs)throw Error('time_regression');
 }else if(current.entities.length>=maxEntities)throw Error('entity_limit');
 if(current.revision===Number.MAX_SAFE_INTEGER)throw Error('revision_overflow');
 const dt=previous?observation.observedAtMs-previous.observedAtMs:null;
 const changes=Object.entries(observation.signals).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>{
  const old=previous&&Object.hasOwn(previous.features,key)?previous.features[key]:null;
  const delta=old===null?null:finiteOrNull(value-old);
  const rate=delta===null||!dt?null:finiteOrNull(delta/dt);
  return {feature:key,previous:old,value,delta,ratePerMs:rate};
 });
 const next={id,source:observation.source,kind:observation.kind,
  sequence:observation.sequence,observedAtMs:observation.observedAtMs,
  payloadSha256:observation.payloadSha256,eventId:eid,
  samples:(previous?.samples??0)+1,features:Object.fromEntries(changes.map(c=>[c.feature,c.value]))};
 const entities=[...current.entities.filter(e=>e.id!==id),next].sort((a,b)=>a.id.localeCompare(b.id));
 const candidate={schema:current.schema,revision:current.revision+1,lastEventId:eid,entities};
 validateModel(candidate,{maxEntities});
 return {schema:UPDATE_SCHEMA,status:'updated',eventId:eid,model:candidate,changes,
  removed:previous?Object.keys(previous.features).filter(k=>!Object.hasOwn(next.features,k)).sort():[]};
}
