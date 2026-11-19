// Pure recursive composition planner; no runtime invocation or activation.
export const COMPOSITION_SCHEMA='mas.composite.v1';
const ident=/^[a-z][a-z0-9_-]{1,39}$/;
const semver=/^\d+\.\d+\.\d+$/;
const contract=/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+\.v[1-9][0-9]*$/;
const action=/^[a-z][a-z0-9_-]{1,39}\.[a-z][a-z0-9_.-]{0,95}$/;
const validSlot=x=>x&&ident.test(x.slot)&&contract.test(x.contract);
function verify(spec){
 if(!spec||spec.schema!==COMPOSITION_SCHEMA||!ident.test(spec.id)||!semver.test(spec.version)||
    !Array.isArray(spec.exports)||!Array.isArray(spec.requires)||
    !Array.isArray(spec.optional)||spec.exports.length>16||
    spec.requires.length>32||spec.optional.length>32||
    !spec.exports.every(x=>typeof x==='string'&&contract.test(x))||
    ![...spec.requires,...spec.optional].every(validSlot)||
    new Set([...spec.requires,...spec.optional].map(x=>x.slot)).size!==spec.requires.length+spec.optional.length||
    new Set(spec.exports).size!==spec.exports.length)throw Error('invalid_composite_spec');
}
const fail=(kind,extra={})=>({status:kind,...extra});
export function resolveComposition(root,specs,graph,{maxDepth=16,maxNodes=512}={}){
 if(!ident.test(root)||!Array.isArray(specs)||specs.length>128||
    !Number.isSafeInteger(maxDepth)||maxDepth<1||maxDepth>64||
    !Number.isSafeInteger(maxNodes)||maxNodes<1||maxNodes>4096)
  throw Error('invalid_resolve_options');
 const table=new Map();
 for(const s of specs){verify(s);if(table.has(s.id))throw Error('duplicate_composite_id');table.set(s.id,s);}
 if(!table.has(root))throw Error('unknown_root');
 const providers=Array.isArray(graph?.nodes)?graph.nodes.filter(n=>n&&n.type==='action'&&
  typeof n.id==='string'&&action.test(n.id)&&contract.test(n.contract)):[];
 if(providers.length>maxNodes)throw Error('too_many_providers');
 let calls=0;
 const getCandidates=c=>{
  const result=[];
  for(const p of providers)if(p.contract===c)result.push({kind:'action',id:p.id,fixture:p.fixture===true});
  for(const s of table.values())if(s.exports.includes(c))result.push({kind:'composite',id:s.id});
  return result.sort((a,b)=>(a.kind+':'+a.id).localeCompare(b.kind+':'+b.id));
 };
 function expand(id,stack){
  if(++calls>maxNodes)throw Error('composition_node_budget');
  if(stack.includes(id))return fail('cycle',{id,path:[...stack,id]});
  if(stack.length>=maxDepth)return fail('depth_limit',{id});
  const spec=table.get(id),roles=[];
  for(const req of [...spec.requires.map(x=>({...x,required:true})),...spec.optional.map(x=>({...x,required:false}))]){
   const matches=getCandidates(req.contract),base={slot:req.slot,contract:req.contract,required:req.required};
   if(matches.length===0){roles.push({...base,...fail('missing')});continue;}
   if(matches.length>1){roles.push({...base,...fail('ambiguous',{candidates:matches.map(x=>x.kind+':'+x.id)})});continue;}
   const match=matches[0];
   if(match.kind==='action'){
    roles.push({...base,...fail(match.fixture?'fixture':'discovered',{provider:match.id})});continue;
   }
   const child=expand(match.id,[...stack,id]);
   roles.push({...base,...fail(child.status==='discovered'?'discovered':'blocked',{provider:'composite:'+match.id,child})});
  }
  const ready=roles.filter(r=>r.required).every(r=>r.status==='discovered');
  return {id,status:ready?'discovered':'blocked',roles};
 }
 const result=expand(root,[]);
 return {schema:'mas.composition.plan.v1',root,status:result.status,
  tree:result,discovered:result.status==='discovered',runnable:false,
  note:'Discovery only; verified live provider, signed release, ACL and state recovery are external gates'};
}
