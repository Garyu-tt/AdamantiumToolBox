// Pure bounded temporal statistics, no wall clock or subjective interpretation.
import {cursorKey} from './contract.mjs';
export function summarize(recent,source,kind){
 const key=cursorKey(source,kind),history=recent.filter(e=>cursorKey(e.source,e.kind)===key);
 const series=new Map();
 for(const e of history)for(const [name,value] of Object.entries(e.signals)){
  if(!series.has(name))series.set(name,[]);series.get(name).push(value);
 }
 const signals=Object.create(null);
 for(const [name,values] of series){
  let mean=values[0];
  for(let i=1;i<values.length;i++)mean=mean*(i/(i+1))+values[i]/(i+1);
  signals[name]={count:values.length,last:values.at(-1),mean,min:Math.min(...values),max:Math.max(...values)};
 }
 return {source,kind,events:history.length,signals};
}
