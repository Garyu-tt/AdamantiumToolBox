// Validate external participant receipts; no owned transaction journal.
import {obj,token,ref,MAX,issue,reject,sortRefs} from './distribution-common.mjs';
import {finishRecovery} from './distribution-recovery-eval.mjs';
export function recoverDistribution(p){
 if(!obj(p)||p.schema!=='forge.distribution.recovery.request.v1')
  return reject([issue('BAD_SCHEMA','schema','Expected forge.distribution.recovery.request.v1',
   'Cannot prepare safe recovery',['use-recovery-v1'])]);
 const errors=[];
 const add=(code,path,reason,impact,fix,observed)=>errors.push(issue(code,path,reason,impact,fix,observed));
 for(const k of ['operation_id','request_id','graph_revision','policy_revision'])
  if(!token(p[k]))add('MISSING_RECOVERY_CONTEXT',k,`Missing ${k}`,
   'Ambiguous cross-node recovery',['refresh-external-transaction-journal']);
 if(!['publish','revoke'].includes(p.mode))add('BAD_MODE','mode','Publish/revoke mode required',
  'Wrong recovery semantics',['specify-original-operation']);
 if(!Array.isArray(p.participants)||p.participants.length===0||p.participants.length>MAX.participants)
  add('BAD_PARTICIPANTS','participants','Bounded nonempty participant records required',
   'Cannot infer affected external nodes',['readback-authoritative-participant-list']);
 if(!obj(p.coordinator)||!['absent','prepared','committed','aborted','unknown'].includes(p.coordinator.status))
  add('BAD_COORDINATOR','coordinator','Explicit coordinator status required',
   'Cannot infer transaction state',['readback-transaction-coordinator']);
 if(!obj(p.ui_readback)||!['visible','hidden','unknown'].includes(p.ui_readback.state))
  add('BAD_UI_READBACK','ui_readback','Visible/hidden/unknown readback required',
   'Cannot infer published UI',['readback-authoritative-ui']);
 if(errors.length)return reject(errors);
 const statuses=new Set(['not_started','prepared','committed','failed','unknown']);
 const seenNodes=new Set(),seenFns=new Set(),participants=[],issues=[];
 const block=(code,path,reason,impact,fix,observed)=>issues.push(issue(code,path,reason,impact,fix,observed));
 for(const [i,x] of p.participants.entries()){
  const path=`participants[${i}]`;
  if(!obj(x)||!token(x.node_ref)||seenNodes.has(x.node_ref)||!statuses.has(x.status)||
    !Array.isArray(x.function_refs)||x.function_refs.length===0||
    x.function_refs.length>MAX.functions||x.function_refs.some(f=>!ref(f)||seenFns.has(f))||
    new Set(x.function_refs).size!==x.function_refs.length){
   add('BAD_PARTICIPANT',path,'Unique node, valid status and unique atomic functions required',
    'External transaction cannot be reconstructed',['readback-participant-by-operation-id']);continue;
  }
  seenNodes.add(x.node_ref);
  for(const f of x.function_refs)seenFns.add(f);
  participants.push({node_ref:x.node_ref,status:x.status,function_refs:sortRefs(x.function_refs),
   observed_receipt_ref:token(x.receipt_ref)?x.receipt_ref:null});
  if(['prepared','committed'].includes(x.status)&&!token(x.receipt_ref))
   block('MISSING_PARTICIPANT_RECEIPT',path,'Prepared/committed status lacks readback receipt',
    'Commit cannot be considered demonstrated',['readback-participant-operation-status']);
  if(x.status==='committed'&&(!token(x.committed_revision)||
    x.receipt_policy_revision!==p.policy_revision||x.operation_id!==p.operation_id))
   block('UNBOUND_COMMIT_RECEIPT',path,'Committed receipt revision, policy or operation ID missing/mismatched',
    'Partial state may violate current policy',['refresh-signed-commit-receipt']);
 }
 if(errors.length)return reject(errors);
 return finishRecovery(p,{participants,issues,block,seenFns});
}
