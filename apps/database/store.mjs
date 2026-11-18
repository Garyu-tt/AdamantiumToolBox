import {mkdir,readFile,open,unlink,chmod} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const nsValid=n=>typeof n==='string'&&/^[a-z][a-z0-9_-]{1,39}$/.test(n);
const clone=m=>new Map([...m].map(([k,v])=>[k,{...v}]));
const apply=(base,ops)=>{
 const next=clone(base);
 for(const op of ops){
  if(op.kind==='ASSERT'){
   const f=op.fact;
   if(!f||typeof f.uid!=='string'||!f.uid||typeof f.subject_uid!=='string'||!f.subject_uid||
    typeof f.relation_uid!=='string'||!f.relation_uid||next.has(f.uid)||
    !((typeof f.object_uid==='string')!==Object.hasOwn(f,'typed_value')))throw Error('invalid_fact');
   next.set(f.uid,{...f,active:true});
  }else if(op.kind==='RETRACT'){
   const f=next.get(op.uid);
   if(!f?.active)throw Error('missing_active_fact');
   next.set(op.uid,{...f,active:false});
  }else throw Error('unsupported_operation');
 }
 return next;
};
export async function openStore(location,policy={}){
 const maxBytes=policy.maxJournalBytes??Number.MAX_SAFE_INTEGER;
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('invalid_journal_quota');
 const allowWrites=policy.allowWrites!==false;
 const dir=resolve(location);await mkdir(dir,{recursive:true,mode:0o700});
 const lock=join(dir,'writer.lock'),journal=join(dir,'facts.ndjson');
 let guard;try{guard=await open(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('writer_locked');throw e;}
 let lines=[],frames=[],state=new Map(),seq=0,prev='0'.repeat(64),closed=false,queue=Promise.resolve();
 try{
  const buf=await readFile(journal).catch(e=>{if(e.code==='ENOENT')return Buffer.alloc(0);throw e;});
  if(buf.length&&!buf.toString('utf8').endsWith('\n'))throw Error('incomplete_journal_tail');
  lines=buf.toString('utf8').split('\n').filter(Boolean);
  let usedBytes=buf.length;
  for(const line of lines){
   const f=JSON.parse(line),{hash,...payload}=f;
   if(f.seq!==seq+1||f.prev!==prev||sha(payload)!==hash||!nsValid(f.namespace))throw Error('journal_integrity_failure');
   state.set(f.namespace,apply(state.get(f.namespace)||new Map(),f.ops));
   frames.push(f);seq=f.seq;prev=hash;
  }
  const handle=await open(journal,'a',0o600);await chmod(journal,0o600);
  const transact=({namespace,observed_seq,mutation_uid,operations})=>new Promise((ok,fail)=>{
   queue=queue.then(async()=>{
    try{
     if(closed)throw Error('store_closed');
     if(!allowWrites)throw Error('write_disabled');
     if(!nsValid(namespace)||!Array.isArray(operations)||!operations.length||operations.length>100)throw Error('invalid_mutation');
     if(!Number.isInteger(observed_seq)||observed_seq!==seq)throw Error('conflict');
     if(typeof mutation_uid!=='string'||!mutation_uid||mutation_uid.length>128)throw Error('invalid_mutation_id');
     const duplicate=frames.find(f=>f.mutation_uid===mutation_uid);
     if(duplicate)throw Error('mutation_id_reused');
     const ops=structuredClone(operations);
     for(const op of ops)if(op.kind==='ASSERT'&&!op.fact.uid)op.fact.uid=randomUUID();
     const next=apply(state.get(namespace)||new Map(),ops);
     const payload={seq:seq+1,prev,mutation_uid,namespace,ts:new Date().toISOString(),ops};
     const frame={...payload,hash:sha(payload)};
     const record=JSON.stringify(frame)+'\n',bytes=Buffer.byteLength(record);
     if(usedBytes+bytes>maxBytes)throw Error('storage_quota_exceeded');
     await handle.writeFile(record);await handle.sync();usedBytes+=bytes;
     state.set(namespace,next);frames.push(frame);seq=frame.seq;prev=frame.hash;
     ok({seq,hash:prev,mutation_uid,assigned_uids:ops.filter(x=>x.kind==='ASSERT').map(x=>x.fact.uid)});
    }catch(e){fail(e);}
   });
  });
  const query=({namespace,subject_uid,relation_uid,at_seq,include_retracted=false,limit=100})=>{
   if(!nsValid(namespace)||!Number.isInteger(limit)||limit<1||limit>500)throw Error('invalid_query');
   if(at_seq!==undefined&&(!Number.isInteger(at_seq)||at_seq<0||at_seq>seq))throw Error('invalid_sequence');
   let current=state.get(namespace)||new Map();
   if(at_seq!==undefined){current=new Map();for(const f of frames){if(f.seq>at_seq)break;if(f.namespace===namespace)current=apply(current,f.ops);}}
   return {seq:at_seq??seq,facts:[...current.values()].filter(f=>
    (include_retracted||f.active)&&(!subject_uid||f.subject_uid===subject_uid)&&
    (!relation_uid||f.relation_uid===relation_uid)).slice(0,limit)};
  };
  const history=({namespace,after_seq=0,limit=100})=>{
   if(!nsValid(namespace)||!Number.isInteger(after_seq)||after_seq<0||!Number.isInteger(limit)||limit<1||limit>500)throw Error('invalid_query');
   return {frames:frames.filter(f=>f.namespace===namespace&&f.seq>after_seq).slice(0,limit),seq};
  };
  const close=async()=>{if(closed)return;closed=true;await queue;await handle.close();await guard.close();await unlink(lock);};
  return {transact,query,history,close,status:()=>({seq,hash:prev,namespaces:state.size,
   usedBytes,maxJournalBytes:maxBytes,allowWrites,backupCopies:0})};
 }catch(e){await guard.close();await unlink(lock).catch(()=>{});throw e;}
}
