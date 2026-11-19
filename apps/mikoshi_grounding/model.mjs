// Learns temporal co-occurrences, not word meanings or causal knowledge.
const MAX=128,MAX_LINKS=12,THRESHOLD=.135,ID=/^m[0-9]{5,7}$/;
export function checkVector(v){
 if(!Array.isArray(v)||v.length!==10||
  !v.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1.01))
  throw Error('invalid_visual_vector');
 return [...v];
}
const dist=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/10);
export const initialize=()=>({schema:'mikoshi.grounding.v1',next:1,paired:0,visuals:[]});
export function validate(s){
 if(!s||s.schema!=='mikoshi.grounding.v1'||!Number.isSafeInteger(s.next)||
  s.next<1||!Number.isSafeInteger(s.paired)||s.paired<0||
  !Array.isArray(s.visuals)||s.visuals.length>MAX)
  throw Error('invalid_grounding_state');
 const ids=new Set();
 for(const v of s.visuals){
  if(!v||typeof v.id!=='string'||!/^v[0-9]{5,7}$/.test(v.id)||
   ids.has(v.id)||!Number.isSafeInteger(v.count)||v.count<1||
   v.count>1000000||!Array.isArray(v.links)||v.links.length>MAX_LINKS)
   throw Error('invalid_grounding_state');
  ids.add(v.id);checkVector(v.vector);
  const linked=new Set();
  for(const e of v.links){
   if(!e||!ID.test(e.soundId)||linked.has(e.soundId)||
    !Number.isSafeInteger(e.count)||e.count<1||e.count>1000000)
    throw Error('invalid_grounding_state');
   linked.add(e.soundId);
  }
 }
}
function nearest(s,vector){
 let winner=null,delta=Infinity;
 for(const v of s.visuals){
  const d=dist(v.vector,vector);
  if(d<delta){delta=d;winner=v;}
 }
 return {winner,delta};
}
export function learn(s,input){
 validate(s);
 const {visualVector,soundId,visualAtMs,soundAtMs,sourceApproved}=input||{};
 const x=checkVector(visualVector);
 if(!ID.test(soundId)||sourceApproved!==true||
  !Number.isInteger(visualAtMs)||!Number.isInteger(soundAtMs)||
  visualAtMs<0||soundAtMs<0||visualAtMs>10000||soundAtMs>10000||
  Math.abs(visualAtMs-soundAtMs)>250)
  throw Error('invalid_temporal_pair');
 const copy=structuredClone(s),match=nearest(copy,x);
 let item=match.winner,kind='reinforced';
 if(!item||match.delta>THRESHOLD){
  if(copy.visuals.length>=MAX)throw Error('grounding_capacity_reached');
  item={id:'v'+String(copy.next++).padStart(5,'0'),
   vector:x,count:0,links:[]};copy.visuals.push(item);kind='discovered';
 }
 const link=item.links.find(e=>e.soundId===soundId);
 if(!link&&item.links.length>=MAX_LINKS)throw Error('grounding_link_capacity');
 if(item.count>=1000000||copy.paired>=1000000||link?.count>=1000000)
  throw Error('grounding_observation_limit');
 const weight=1/Math.min(64,item.count+1);
 item.vector=item.vector.map((v,i)=>v+(x[i]-v)*weight);
 item.count++;
 if(link)link.count++;
 else item.links.push({soundId,count:1});
 copy.paired++;
 return {state:copy,result:{kind,visualId:item.id,soundId,
  support:item.links.find(e=>e.soundId===soundId).count,
  paired:copy.paired,observations:item.count}};
}
export function associate(s,vector){
 validate(s);const x=checkVector(vector),n=nearest(s,x);
 if(!n.winner||n.delta>THRESHOLD)return {
  schema:'mikoshi.grounding.association.v1',matched:false,
  ready:false,reason:'unknown_visual_event',candidates:[]};
 const links=n.winner.links,total=links.reduce((a,b)=>a+b.count,0);
 const candidates=links.map(e=>({soundId:e.soundId,support:e.count,
  share:+(e.count/total).toFixed(4)})).sort((a,b)=>b.support-a.support||
  a.soundId.localeCompare(b.soundId));
 const best=candidates[0],ready=best.support>=2&&best.share>=.75;
 return {schema:'mikoshi.grounding.association.v1',matched:true,
  ready,visualId:n.winner.id,distance:+n.delta.toFixed(5),
  reason:ready?'repeated_temporal_correlation':'insufficient_or_ambiguous',
  candidates};
}
export function recall(s,soundId){
 validate(s);if(!ID.test(soundId))throw Error('invalid_sound_id');
 const candidates=s.visuals.flatMap(v=>{
  const link=v.links.find(e=>e.soundId===soundId);
  return link?[{visualId:v.id,support:link.count}]:[];
 }).sort((a,b)=>b.support-a.support||a.visualId.localeCompare(b.visualId));
 return {schema:'mikoshi.grounding.recall.v1',soundId,
  ready:candidates.some(c=>c.support>=2),candidates};
}
export function catalog(s){
 validate(s);return {schema:'mikoshi.grounding.catalog.v1',
  paired:s.paired,visuals:s.visuals.length,
  links:s.visuals.reduce((sum,v)=>sum+v.links.length,0)};
}
