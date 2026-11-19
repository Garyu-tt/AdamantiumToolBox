import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const id=x=>typeof x==='string'&&/^[a-z][a-z0-9_.:-]{0,95}$/.test(x);
const sec=x=>Number.isSafeInteger(x)&&x>=0;
const zero='0'.repeat(64);
const permitted={
 draft:{armed:'armed'},armed:{staged:'staged',cancelled:'cancelled'},
 staged:{probe_passed:'observed',rollback_requested:'rollback_pending'},
 observed:{operator_confirmed:'confirmed',rollback_requested:'rollback_pending'},
 rollback_pending:{rollback_verified:'rolled_back'}
};
const eventHash=(ctx,e)=>hash(JSON.stringify([ctx.leaseId,ctx.planDigest,
 e.seq,e.kind,e.atSeconds,e.prevHash]));
export function makeJournalEvent(ctx,prev,kind,atSeconds){
 if(!id(ctx?.leaseId)||!hex(ctx?.planDigest)||!sec(atSeconds)||
  !permitted[ctx?.state]?.[kind])throw Error('invalid_journal_event');
 const e={seq:ctx.seq,kind,atSeconds,prevHash:prev??zero};
 if(!Number.isSafeInteger(e.seq)||e.seq<1||!hex(e.prevHash))
  throw Error('invalid_journal_sequence');
 return {...e,hash:eventHash(ctx,e)};
}
export function inspectJournal(input,options={}){
 if(!input||input.schema!=='rollback-watchdog-journal-1'||
  !id(input.leaseId)||!hex(input.planDigest)||!sec(input.deadlineSeconds)||
  !Array.isArray(input.events)||input.events.length>100)throw Error('invalid_journal');
 const now=options.nowSeconds??Math.floor(Date.now()/1000);
 if(!sec(now))throw Error('clock_unavailable');
 const issues=[],graph=[],edges=[];
 let state='draft',previous=zero,last=-1;
 for(const [i,event] of input.events.entries()){
  const invalid=!event||event.seq!==i+1||!sec(event.atSeconds)||
   event.atSeconds<last||event.atSeconds>now||
   !hex(event.prevHash)||event.prevHash!==previous||
   !hex(event.hash)||event.hash!==eventHash(input,event);
  if(invalid){issues.push({code:'journal_integrity_failure',index:i,
   cause:'hash_chain_sequence_or_timestamp_mismatch',
   remediation:'isolate journal; restore from independently verified archive'});break;}
  const next=permitted[state]?.[event.kind];
  if(!next||(event.atSeconds>=input.deadlineSeconds&&
    !['rollback_requested','rollback_verified'].includes(event.kind))){
   issues.push({code:'invalid_transition',index:i,state,kind:event.kind,
    remediation:'verify lease and rollback status out of band'});break;
  }
  graph.push({id:'event:'+event.seq,type:'transition',label:event.kind,
   atSeconds:event.atSeconds,hash:event.hash});
  if(i)edges.push({from:'event:'+i,to:'event:'+event.seq,type:'previous'});
  state=next;previous=event.hash;last=event.atSeconds;
 }
 const expired=now>=input.deadlineSeconds;
 if(!issues.length&&expired&&['staged','observed'].includes(state))
  issues.push({code:'rollback_overdue',cause:'lease_expired_without_verified_rollback',
   remediation:'perform independently authorized rollback and verify kernel state'});
 if(!issues.length&&expired&&state==='rollback_pending')
  issues.push({code:'rollback_unconfirmed',cause:'no verified restoration receipt',
   remediation:'inspect local ruleset and persist independent rollback evidence'});
 const complete=issues.length===0;
 return {schema:'rollback-watchdog-journal-check-1',leaseId:input.leaseId,
  planDigest:input.planDigest,state,expired,issues,graph:{nodes:graph,edges},
  journalIntegrityVerified:complete,writerAuthenticated:false,
  nodeIdentityVerified:false,kernelReadbackVerified:false,
  watchdogAliveVerified:false,rollbackCompleted:complete&&state==='rolled_back',
  requiresRecovery:issues.some(x=>x.code.startsWith('rollback_')),
  readyToApply:false,applied:false};
}
