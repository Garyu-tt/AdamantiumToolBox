import {loadCheckpoint,saveCheckpoint} from './atomic_checkpoint.mjs';
export const STATE_SCHEMA='dante.state.session.v1';
const ident=s=>typeof s==='string'&&/^[a-z][a-z0-9_.-]{0,95}$/.test(s);
const hash=s=>s===null||(typeof s==='string'&&/^[a-f0-9]{64}$/.test(s));
const copy=v=>structuredClone(v);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export class CheckpointManager{
 #current=null;#tail=Promise.resolve();
 constructor(path,{maxBytes=1048576}={}){
  if(typeof path!=='string'||!path||!Number.isSafeInteger(maxBytes)||maxBytes<2048||maxBytes>8388608)
   throw Error('invalid_checkpoint_config');
  this.path=path;this.maxBytes=maxBytes;
 }
 async open(){
  let saved;try{saved=(await loadCheckpoint(this.path,{maxBytes:this.maxBytes})).state;}
  catch(e){if(e.code==='ENOENT')return this;throw e;}
  if(!plain(saved)||saved.schema!==STATE_SCHEMA||!ident(saved.instanceId)||
     !Number.isSafeInteger(saved.revision)||saved.revision<1||!hash(saved.lastEventId)||
     !plain(saved.state))throw Error('invalid_session_checkpoint');
  this.#current=saved;return this;
 }
 read(){return this.#current?copy(this.#current):null;}
 status(){return {schema:STATE_SCHEMA,exists:!!this.#current,
  revision:this.#current?.revision??0,instanceId:this.#current?.instanceId??null,storage:'atomic_sha256'};}
 commit(params){
  // Snapshot inputs before the queued asynchronous operation starts.
  let captured;try{captured={...params,state:copy(params?.state)};}
  catch(e){return Promise.reject(e);}
  const task=this.#tail.then(()=>this.#save(captured));
  this.#tail=task.then(()=>{},()=>{});return task;
 }
 async #save(params){
  if(!plain(params)||!ident(params.instanceId)||!hash(params.lastEventId)||
    !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0||
    !plain(params.state))throw Error('invalid_commit');
  const current=this.#current;
  if(current&&current.instanceId!==params.instanceId)throw Error('instance_mismatch');
  if(params.expectedRevision!==(current?.revision??0))throw Error('revision_conflict');
  if(current&&current.lastEventId!==null&&params.lastEventId===null)
   throw Error('event_cursor_regression');
  if(current&&current.lastEventId!==null&&current.lastEventId===params.lastEventId)
   throw Error('event_already_committed');
  const revision=params.expectedRevision+1;
  if(!Number.isSafeInteger(revision))throw Error('revision_overflow');
  const candidate={schema:STATE_SCHEMA,instanceId:params.instanceId,revision,
   lastEventId:params.lastEventId,state:copy(params.state)};
  // durable commit precedes publish of in-memory revision
  await saveCheckpoint(this.path,candidate,{maxBytes:this.maxBytes});
  this.#current=JSON.parse(JSON.stringify(candidate));
  return {ok:true,revision,lastEventId:candidate.lastEventId};
 }
}
