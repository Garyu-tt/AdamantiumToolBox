import {tok,issue,fail,flags,keys} from './integrity-common.mjs';
import {validSnapshot} from './integrity-validate.mjs';
import {checkFunctions} from './integrity-checks.mjs';
import {checkEdges} from './integrity-edges.mjs';
export function auditIntegrity(p){
 if(!validSnapshot(p))return fail([issue('INVALID_GRAPH_SNAPSHOT','$',
  'Valid bounded graph, reverse-index and UI/capability snapshot required',[],
  'fetch-authoritative-revision-bound-complete-snapshot')]);
 const s=p.snapshot,issues=[];
 const report=x=>issues.push(x);
 checkFunctions(s,report);checkEdges(s,report);
 // Deterministic output: never silently discard additional findings.
 issues.sort((a,b)=>a.code.localeCompare(b.code)||a.path.localeCompare(b.path));
 const limited=issues.length>256;
 return {ok:true,schema:'forge.integrity.audit.v1',request_id:p.request_id,
  snapshot_ref:s.snapshot_ref,revision_claims:Object.fromEntries(keys.map(k=>[k,s[k]])),
  consistent:issues.length===0&&!limited,
  issues:issues.slice(0,256),finding_count:issues.length,findings_truncated:limited,
  next_step:issues.length?'re-read-authoritative-graph-and-investigate-differences':
   'ask-authoritative-host-to-verify-current-graph',
  requires_external_reverse_index_and_ui_readback:true,
  requires_current_policy_and_identity_verification:true,...flags};
}
