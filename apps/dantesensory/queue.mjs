import {AtomicStore} from './atomic_store.mjs';
import {QUEUE_SCHEMA,encoded,keyOf,validateState} from './event_codec.mjs';
export class DurableQueue{
 #entries=[];#cursors=new Map();#acked=[];#tail=Promise.resolve();
 constructor({path,capacity=64,maxSources=128,maxEventBytes=8192}={}){
  if(typeof path!=='string'||!path||!Number.isSafeInteger(capacity)||capacity<1||capacity>256||
     !Number.isSafeInteger(maxSources)||maxSources<1||maxSources>256||
     !Number.isSafeInteger(maxEventBytes)||maxEventBytes<256||maxEventBytes>16384)
   throw Error('invalid_queue_config');
  this.config={capacity,maxSources,maxEventBytes};
  this.store=new AtomicStore(path,capacity*(maxEventBytes+400)+maxSources*256+8192);
 }
 async open(){
  const s=await this.store.load();if(!s)return this;
  validateState(s,this.config);
  this.#entries=s.entries;this.#cursors=new Map(s.cursors);this.#acked=s.acked;
  return this;
 }
 #run(fn){
  const task=this.#tail.then(fn);this.#tail=task.then(()=>{},()=>{});
  return task;
 }
 async #commit(entries,cursors,acked){
  await this.store.save({schema:QUEUE_SCHEMA,entries,cursors:[...cursors],acked});
  this.#entries=entries;this.#cursors=cursors;this.#acked=acked;
 }
 publish(event){return this.#run(async()=>{
  const item=encoded(event,this.config.maxEventBytes),key=keyOf(item.event);
  const cursor=this.#cursors.get(key);
  if(cursor!==undefined&&item.event.sequence<=cursor){
   const old=this.#entries.find(x=>x.id===item.id);
   if(old&&JSON.stringify(old.event)===JSON.stringify(item.event))return {ok:true,id:item.id,duplicate:true};
   return {ok:false,reason:'non_monotonic_sequence'};
  }
  if(this.#entries.length>=this.config.capacity)return {ok:false,reason:'backpressure'};
  if(cursor===undefined&&this.#cursors.size>=this.config.maxSources)return {ok:false,reason:'too_many_sources'};
  const cursors=new Map(this.#cursors);cursors.set(key,item.event.sequence);
  await this.#commit([...this.#entries,{id:item.id,event:item.event}],cursors,this.#acked);
  return {ok:true,id:item.id,duplicate:false};
 });}
 peek(limit=8){
  if(!Number.isSafeInteger(limit)||limit<1||limit>16)throw Error('invalid_peek_limit');
  return this.#entries.slice(0,limit).map(x=>structuredClone(x));
 }
 ack(id){return this.#run(async()=>{
  if(typeof id!=='string'||!/^[0-9a-f]{64}$/.test(id))throw Error('invalid_ack_id');
  const pos=this.#entries.findIndex(x=>x.id===id);
  if(pos<0)return this.#acked.includes(id)?{ok:true,already:true}:{ok:false,reason:'unknown_event'};
  const entries=this.#entries.filter(x=>x.id!==id);
  const acked=[...this.#acked.filter(x=>x!==id),id].slice(-64);
  await this.#commit(entries,this.#cursors,acked);
  return {ok:true,already:false};
 });}
 status(){return {schema:QUEUE_SCHEMA,queued:this.#entries.length,sources:this.#cursors.size,
  capacity:this.config.capacity,delivery:'at_least_once',persistence:'fsync_rename',ackedRecent:this.#acked.length};}
}
