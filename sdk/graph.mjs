import {validateModules} from './modules.mjs';
const compatible=(v,range)=>{
 if(typeof v!=='string'||!/^\d+\.\d+\.\d+$/.test(v))return false;
 const actual=v.split('.').map(Number),expected=range.replace('^','').split('.').map(Number);
 const compare=actual[0]-expected[0]||actual[1]-expected[1]||actual[2]-expected[2];
 if(!range.startsWith('^'))return compare===0;
 if(compare<0||actual[0]!==expected[0])return false;
 if(expected[0]>0)return true;
 if(actual[1]!==expected[1])return false;
 return expected[1]>0||actual[2]===expected[2];
};
export function makeGraph(doc,manifest,external=[]){
 validateModules(doc,manifest);
 if(!Array.isArray(external))throw Error('invalid_external_graph');
 const nodes=[];
 const flatten=(m)=>{if(m.enabled===false)return;
  nodes.push(m);for(const child of m.children||[])flatten(child);};
 for(const module of doc.modules)flatten(module);
 const externalById=new Map(external.filter(x=>x&&typeof x.id==='string')
  .map(x=>[x.id,x]));
 let active=nodes.slice();
 let changed=true;
 while(changed){
  changed=false;
  const own=new Map(active.flatMap(m=>m.provides||[]).map(p=>[p.id,p]));
  const next=active.filter(m=>(m.consumes||[]).every(c=>{
   if(c.optional)return true;
   const found=own.get(c.id)||externalById.get(c.id);
   return found&&compatible(found.version,c.version);
  }));
  if(next.length!==active.length){changed=true;active=next;}
 }
 const result=active.flatMap(m=>m.provides||[]).map(p=>({
  id:p.id,type:p.type,title:p.title,version:p.version,
  requires:[...p.permissions],...(p.type==='view'?{icon:manifest.icon}:{})
 }));
 const visible=new Set(result.map(n=>n.id));
 const edges=active.flatMap(m=>m.links||[])
  .filter(e=>visible.has(e.from)&&visible.has(e.to));
 return {app:manifest.id,version:1,nodes:result,edges};
}
