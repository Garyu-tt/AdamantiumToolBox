import {issue} from './integrity-common.mjs';
export function checkEdges(s,report){
 const fs=new Map(s.functions.map(f=>[f.ref,f]));
 const expected=new Map(s.functions.map(f=>[f.ref,new Set()]));
 for(const f of s.functions)for(const d of f.depends_on)if(expected.has(d))expected.get(d).add(f.ref);
 const supplied=new Map(s.reverse_index.map(x=>[x.function_ref,x.dependents]));
 for(const [ref,deps] of expected){
  const actual=supplied.get(ref);
  if(!actual||actual.length!==deps.size||actual.some(x=>!deps.has(x)))
   report(issue('REVERSE_INDEX_DRIFT',ref,
    'Supplied reverse dependency list does not match forward edges',[ref,...deps],
    'rebuild-reverse-index-from-canonical-forward-edges'));
 }
 for(const [ref,deps] of supplied)if(!fs.has(ref)||deps.some(x=>!fs.has(x)))
  report(issue('ORPHAN_REVERSE_EDGE',ref,'Reverse index contains unknown function refs',
   [ref,...deps],'remove-or-reconcile-dangling-reverse-entry'));
 const state=new Map();const visitedCycles=new Set();
 for(const root of fs.keys()){
  if(state.get(root)===2)continue;
  const stack=[{id:root,next:0}],path=[];
  while(stack.length){
   const top=stack.at(-1),current=fs.get(top.id);
   if(!state.has(top.id)){state.set(top.id,1);path.push(top.id);}
   if(top.next>=current.depends_on.length){state.set(top.id,2);stack.pop();path.pop();continue;}
   const dep=current.depends_on[top.next++];if(!fs.has(dep))continue;
   if(state.get(dep)===1){const cycle=path.slice(path.indexOf(dep)).concat(dep);
    const key=[...new Set(cycle)].sort().join('|');
    if(!visitedCycles.has(key)){visitedCycles.add(key);report(issue('DEPENDENCY_CYCLE',top.id,
     'Dependency graph contains a cycle, so no valid execution order exists',cycle,
     'break-cycle-by-extracting-independent-contract'));}}
   else if(!state.has(dep))stack.push({id:dep,next:0});
  }
 }
}
