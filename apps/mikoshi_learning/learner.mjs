// Online exemplar prototypes. Neither cognition nor unsupervised phoneme acquisition.
const domains=new Set(['hearing','speech','reading','writing','counting','typing','action']);
function valid(x){
 if(!x||!domains.has(x.domain)||typeof x.label!=='string'||!x.label.trim()||
  x.label.length>48||!Array.isArray(x.vector)||x.vector.length<2||
  x.vector.length>24||!x.vector.every(v=>Number.isFinite(v)&&v>=0&&v<=1))
  throw Error('invalid_learning_example');
}
export function teach(state,example){
 valid(example);
 if(typeof example.correct!=='boolean')throw Error('feedback_required');
 const next=structuredClone(state||{schema:'mikoshi.prototypes.v1',items:[]});
 if(next.schema!=='mikoshi.prototypes.v1'||!Array.isArray(next.items))throw Error('state_schema');
 const item=next.items.find(x=>x.domain===example.domain&&x.label===example.label);
 if(!item&&next.items.length>=512)throw Error('prototype_quota');
 if(!example.correct)return {state:next,updated:false,reason:'negative_feedback_not_learned'};
 if(item){
  if(item.vector.length!==example.vector.length)throw Error('vector_dimension_change');
  const n=item.count+1;
  item.vector=item.vector.map((v,i)=>v+(example.vector[i]-v)/n);
  item.count=n;
 }else next.items.push({domain:example.domain,label:example.label,
  vector:[...example.vector],count:1});
 return {state:next,updated:true};
}
export function infer(state,query){
 valid({...query,label:'?'});
 const candidates=(state?.items||[]).filter(x=>x.domain===query.domain&&
  x.vector.length===query.vector.length);
 if(!candidates.length)return {label:null,confidence:0,reason:'untrained'};
 let best=null,distance=Infinity;
 for(const x of candidates){
  const d=Math.sqrt(x.vector.reduce((s,v,i)=>s+(v-query.vector[i])**2,0)/x.vector.length);
  if(d<distance){best=x;distance=d;}
 }
 const confidence=Math.max(0,1-distance);
 return {label:confidence>=.8?best.label:null,confidence:+confidence.toFixed(3),
  reason:confidence>=.8?'prototype_match':'low_confidence',observations:best.count};
}
export function progress(state){
 return {schema:'mikoshi.learning.progress.v1',prototypes:state?.items?.length||0,
  observations:(state?.items||[]).reduce((s,x)=>s+x.count,0),
  domains:[...new Set((state?.items||[]).map(x=>x.domain))]};
}
