import {issue} from './integrity-common.mjs';
export function checkFunctions(s,report){
 const fs=new Map(s.functions.map(x=>[x.ref,x]));
 const cs=new Map(s.capabilities.map(x=>[x.ref,x]));
 const ms=new Map(s.mounts.map(x=>[x.ref,x]));
 const requests=new Map();
 for(const f of s.functions){
  if(requests.has(f.request_ref))report(issue('SHARED_FUNCTION_REQUEST','functions',
   'One atomic development request is assigned to multiple function nodes',
   [requests.get(f.request_ref),f.ref],'split-requests-or-merge-duplicate-function'));
  else requests.set(f.request_ref,f.ref);
  if(f.state==='blocked'&&(!f.blocker||!f.blocker.evidence_refs?.length||
   !f.blocker.remedy_refs?.length))report(issue('UNEXPLAINED_BLOCKER',f.ref,
   'Blocked function lacks cause, diagnostic evidence or repair options',
   [f.ref],'attach-evidence-cause-and-ranked-remedies'));
  if(f.state==='published'&&!f.verified)report(issue('UNVERIFIED_PUBLICATION',f.ref,
   'Published function lacks verification evidence claim',[f.ref],
   'revoke-visible-action-and-verify-implementation'));
  if(f.state==='published'&&!f.capability_refs.some(id=>
    cs.get(id)?.function_ref===f.ref&&cs.get(id)?.state==='published'&&
    cs.get(id)?.verified===true&&cs.get(id)?.handler_ref))
   report(issue('MISSING_PUBLISHED_CAPABILITY',f.ref,
    'Published function has no matching verified handler-backed capability',
    [f.ref],'invalidate-ui-and-reconcile-capability-registration'));
  for(const id of f.depends_on){
   const dep=fs.get(id);
   if(!dep)report(issue('MISSING_DEPENDENCY',f.ref,
    'Function depends on an absent node',[f.ref,id],'fetch-or-recreate-missing-node'));
   else if(f.state==='published'&&dep.state!=='published')
    report(issue('STALE_DEPENDENCY',f.ref,'Published function depends on unpublished node',
     [f.ref,id],'invalidate-dependent-and-reverify-dependency'));
  }
  for(const id of f.capability_refs)if(!cs.has(id)||cs.get(id).function_ref!==f.ref)
   report(issue('BROKEN_CAPABILITY_LINK',f.ref,'Capability reference is absent or belongs to another function',
    [f.ref,id],'reconcile-forward-capability-edge'));
  for(const id of f.mount_refs)if(!ms.has(id)||ms.get(id).function_ref!==f.ref)
   report(issue('BROKEN_UI_LINK',f.ref,'UI mount reference is absent or belongs to another function',
    [f.ref,id],'reconcile-forward-ui-edge'));
 }
 for(const c of s.capabilities)if(!fs.has(c.function_ref)||
  !fs.get(c.function_ref).capability_refs.includes(c.ref))
  report(issue('ORPHAN_CAPABILITY',c.ref,'Capability lacks reciprocal function reference',
   [c.ref,c.function_ref],'reconcile-reciprocal-capability-edge'));
 for(const m of s.mounts){
  const f=fs.get(m.function_ref),c=cs.get(m.capability_ref);
  if(!f||!f.mount_refs.includes(m.ref)||!c||c.function_ref!==m.function_ref)
   report(issue('ORPHAN_UI_MOUNT',m.ref,'UI mount lacks matching function or capability linkage',
    [m.ref,m.function_ref,m.capability_ref],'reconcile-or-invalidate-ui-mount'));
  if(m.invokable&&(m.state!=='active'||!f||f.state!=='published'||!f.verified||
    !c||c.state!=='published'||!c.verified||!c.handler_ref))
   report(issue('GHOST_UI_ACTION',m.ref,'Invokable UI claim has no verified published execution chain',
    [m.ref,m.function_ref,m.capability_ref],'revoke-ui-claim-before-reverification'));
 }
}
