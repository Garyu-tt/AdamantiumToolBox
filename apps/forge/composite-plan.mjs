// Validate recursive group nodes and unique atomic function catalog.
import {validateFunction} from './contract.mjs';
import {obj,ref,semver,limits,issue,reject,cleanRevision} from './composite-common.mjs';
import {emitComposite} from './composite-emit.mjs';
export function planComposite(p){
 const errors=[];
 if(!obj(p)||p.schema!=='forge.composite.request.v1')errors.push(issue('BAD_SCHEMA','schema','Expected forge.composite.request.v1'));
 if(typeof p?.request_id!=='string'||p.request_id.length<8||p.request_id.length>128)
  errors.push(issue('BAD_REQUEST_ID','request_id','Stable request ID required (8..128 characters)'));
 if(p?.expected_revision!==undefined&&!cleanRevision(p.expected_revision))
  errors.push(issue('BAD_REVISION','expected_revision','External graph revision must be an opaque nonempty token'));
 if(!Array.isArray(p?.functions)||p.functions.length<1||p.functions.length>limits.functions)
  errors.push(issue('BAD_CATALOG','functions','Nonempty bounded catalog of atomic functions is required'));
 if(!obj(p?.root))errors.push(issue('BAD_ROOT','root','A recursive root group is required'));
 if(errors.length)return reject(errors);
 const functions=new Map(),actions=new Map();
 for(const [i,fn] of p.functions.entries()){
  const check=validateFunction(fn);
  if(!check.ok){for(const e of check.errors)errors.push(issue('INVALID_FUNCTION',`functions[${i}].${e.path}`,e.reason));continue;}
  if(functions.has(fn.id))errors.push(issue('DUPLICATE_FUNCTION',`functions[${i}].id`,fn.id,['remove-duplicate-function']));
  else functions.set(fn.id,fn);
  const action=fn.capability.action;
  if(actions.has(action))errors.push(issue('AMBIGUOUS_CAPABILITY',`functions[${i}].capability.action`,
    `Several local functions declare ${action}`,['choose-explicit-provider-or-separate-namespace']));
  else actions.set(action,fn.id);
 }
 if(errors.length)return reject(errors);
 const groups=new Map(),mounted=new Map(),contains=[],views=[];
 // Nested containers have distinct identities; function refs are reusable across groups.
 function walk(group,depth,path){
  if(depth>limits.depth){errors.push(issue('DEPTH_LIMIT',path,'Composition exceeds safe traversal depth',['split-composition-request']));return;}
  if(!obj(group)||group.kind!=='group'||!ref.test(group.id)||!semver.test(group.version||'')){
   errors.push(issue('INVALID_GROUP',path,'Group needs namespaced id and semantic version'));return;}
  if(groups.has(group.id)||functions.has(group.id)){
   errors.push(issue('DUPLICATE_GROUP',path,`Duplicated or colliding group ${group.id}`));return;}
  if(typeof group.label!=='string'||!group.label.trim()||!Array.isArray(group.children)||group.children.length===0){
   errors.push(issue('INVALID_GROUP_UI',path,'Group needs a label and nonempty children'));return;}
  if(groups.size>=limits.groups){errors.push(issue('GROUP_LIMIT',path,'Composition exceeds bounded planning size'));return;}
  groups.set(group.id,group);
  views.push({id:`ui:${group.id}`,kind:'ui_contribution',role:'group',
   target_ref:group.id,label:group.label,availability:'unverified',invokable:false});
  for(const [i,child] of group.children.entries()){
   const at=`${path}.children[${i}]`;
   if(child?.kind==='function'){
    if(typeof child.ref!=='string'||!functions.has(child.ref)){
     errors.push(issue('UNKNOWN_FUNCTION',at,'Child reference must resolve to an atomic function',['add-function-to-catalog']));continue;}
    const key=`${group.id}\u0000${child.ref}`;
    if(mounted.has(key)){errors.push(issue('DUPLICATE_MOUNT',at,'Same function mounted twice within one group'));continue;}
    mounted.set(key,true);
    contains.push({from:group.id,to:child.ref,kind:'contains'});
   }else if(child?.kind==='group'){
    if(!ref.test(child.id||'')){
     errors.push(issue('INVALID_CHILD',at,'Nested group has no valid reference'));continue;}
    contains.push({from:group.id,to:child.id,kind:'contains'});
    walk(child,depth+1,at);
   }else errors.push(issue('INVALID_CHILD',at,'Child must be a group or a function reference'));
  }
 }
 walk(p.root,0,'root');
 for(const id of functions.keys())if(![...mounted.keys()].some(k=>k.endsWith(`\u0000${id}`)))
  errors.push(issue('UNMOUNTED_FUNCTION','functions',`${id} is absent from the composition tree`,['mount-function-reference']));
 if(errors.length)return reject(errors);
 return emitComposite(p,{functions,actions,groups,contains,views});
}
