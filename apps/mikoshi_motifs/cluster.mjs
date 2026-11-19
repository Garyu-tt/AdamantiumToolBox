import {distance} from './encoder.mjs';
const MAX=256, THRESHOLD=.095;
export const threshold=THRESHOLD;
export function initialize(){return {schema:'mikoshi.motifs.v1',next:1,heard:0,units:[]};}
function validate(state){
 if(!state||state.schema!=='mikoshi.motifs.v1'||!Number.isSafeInteger(state.next)||
  state.next<1||!Number.isSafeInteger(state.heard)||state.heard<0||
  !Array.isArray(state.units)||state.units.length>MAX||
  !state.units.every(u=>typeof u.id==='string'&&/^m[0-9]{5,7}$/.test(u.id)&&
   Number.isSafeInteger(u.count)&&u.count>0&&u.count<=1000000&&
   Array.isArray(u.vector)&&u.vector.length===22&&
   u.vector.every(v=>Number.isFinite(v)&&v>=0&&v<=1.01)))
  throw Error('invalid_motif_state');
 if(new Set(state.units.map(u=>u.id)).size!==state.units.length)
  throw Error('duplicate_motif_id');
}
function nearest(state,vector){
 let best=null,bestDistance=Infinity;
 for(const u of state.units){
  const d=distance(u.vector,vector);
  if(d<bestDistance){best=u;bestDistance=d;}
 }
 return {unit:best,distance:bestDistance};
}
export function recognize(state,vector){
 validate(state);distance(vector,vector);
 const result=nearest(state,vector),matched=result.distance<=THRESHOLD;
 return {schema:'mikoshi.motifs.recognition.v1',
  id:matched?result.unit.id:null,matched,
  nearestId:result.unit?.id??null,
  distance:Number.isFinite(result.distance)?+result.distance.toFixed(5):null,
  threshold:THRESHOLD,heard:state.heard,
  candidates:state.units.length};
}
export function learn(state,vector){
 validate(state);distance(vector,vector);
 const copy=structuredClone(state),near=nearest(copy,vector);
 let kind='reinforced',unit=near.unit;
 if(!unit||near.distance>THRESHOLD){
  if(copy.units.length>=MAX)throw Error('motif_capacity_reached');
  const id='m'+String(copy.next++).padStart(5,'0');
  unit={id,count:1,vector:[...vector]};copy.units.push(unit);kind='discovered';
 }else{
  if(unit.count>=1000000)throw Error('motif_observation_limit');
  // Bounded running mean. Identifiers do not encode a language or identity.
  const count=unit.count+1,weight=1/Math.min(64,count);
  unit.vector=unit.vector.map((v,i)=>v+(vector[i]-v)*weight);
  unit.count=count;
 }
 copy.heard++;
 return {state:copy,result:{kind,id:unit.id,observations:unit.count,
  distance:near.unit?+near.distance.toFixed(5):null,
  units:copy.units.length,heard:copy.heard}};
}
export function catalog(state){
 validate(state);return {schema:'mikoshi.motifs.catalog.v1',
  heard:state.heard,units:state.units.map(u=>({id:u.id,observations:u.count}))};
}
