const types=new Set(['syntax_validated','arm_rollback','commit_simulated',
 'management_probe_ok','management_probe_failed','operator_confirmed']);
const integers=x=>Number.isSafeInteger(x)&&x>=0;
export function simulateRollbackTrial(input){
 if(!input||!integers(input.deadlineMs)||input.deadlineMs<100||
  input.deadlineMs>600000||!Array.isArray(input.events)||input.events.length>100||
  !integers(input.advanceToMs))throw Error('invalid_trial');
 let state='draft',at=0,reason=null,rolledBack=false;
 const journal=[];
 const record=(event,time,next,cause)=>{journal.push({event,atMs:time,
  from:state,to:next,cause:cause||null});state=next;};
 const rollback=time=>{rolledBack=true;record('timeout_rollback',time,'rolled_back',
  'commit_unconfirmed_before_deadline');};
 for(const event of input.events){
  if(!event||!types.has(event.kind)||!integers(event.atMs)||event.atMs<at||
   event.atMs>input.advanceToMs)throw Error('invalid_event');
  if(event.atMs>=input.deadlineMs&&['committed','verified'].includes(state)){
   rollback(input.deadlineMs);break;
  }
  at=event.atMs;
  if(['confirmed','rolled_back','blocked'].includes(state))break;
  const transitions={
   draft:{syntax_validated:'checked'},
   checked:{arm_rollback:'armed'},
   armed:{commit_simulated:'committed'},
   committed:{management_probe_ok:'verified',management_probe_failed:'rolled_back'},
   verified:{operator_confirmed:'confirmed',management_probe_failed:'rolled_back'}
  };
  const next=transitions[state]?.[event.kind];
  if(!next){
   reason='invalid_transition_'+state+'_'+event.kind;
   record(event.kind,at,'blocked',reason);break;
  }
  if(next==='rolled_back')rolledBack=true;
  record(event.kind,at,next,next==='rolled_back'?'management_probe_failed':null);
 }
 if(input.advanceToMs>=input.deadlineMs&&['committed','verified'].includes(state))
  rollback(input.deadlineMs);
 if(input.advanceToMs<input.deadlineMs&&['draft','checked','armed'].includes(state))
  reason='incomplete_precommit_sequence';
 return {schema:'nftables-rollback-trial-1',state,reason,
  simulated:true,privilegedOperations:0,kernelChanged:false,
  rollbackSimulated:rolledBack,watchdogArmedLive:false,
  confirmedInProduction:false,journal,
  reminder:state==='confirmed'?'confirmation_is_a_mock_event_only':
   'independent_watchdog_and_management_proof_missing'};
}
