// Opt-in ordered checkpoint facade for deterministic single-writer Dante consumers.
// Existing hash-only checkpoint API remains unsafe for out-of-order event replay.
import {CheckpointManager} from './manager.mjs';
export const ORDERED_CURSOR_SCHEMA='dante.state.ordered-cursor.v1';
const eventId=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export class OrderedCheckpointManager {
 #inner;
 constructor(path,options){this.#inner=new CheckpointManager(path,options);}
 async open(){
  await this.#inner.open();
  const record=this.#inner.read();
  if(record&&!this.#valid(record))throw Error('cursor_migration_required');
  return this;
 }
 #valid(record){
  const box=record?.state, cursor=box?.cursor;
  return plain(box)&&box.schema===ORDERED_CURSOR_SCHEMA&&
   plain(cursor)&&integer(cursor.sequence)&&eventId(cursor.eventId)&&
   cursor.eventId===record.lastEventId&&plain(box.value);
 }
 read(){
  const record=this.#inner.read();
  if(!record)return null;
  if(!this.#valid(record))throw Error('cursor_migration_required');
  return {instanceId:record.instanceId,revision:record.revision,
   sequence:record.state.cursor.sequence,eventId:record.lastEventId,
   state:record.state.value};
 }
 status(){
  const s=this.#inner.status(),r=this.read();
  return {...s,cursorSchema:ORDERED_CURSOR_SCHEMA,sequence:r?.sequence??null};
 }
 async commit({instanceId,expectedRevision,sequence,eventId:id,previousEventId,state}={}){
  if(!integer(sequence)||!eventId(id)||!plain(state))
   throw Error('invalid_ordered_commit');
  const current=this.read();
  if(current){
   if(!eventId(previousEventId)||previousEventId!==current.eventId)
    throw Error('cursor_parent_conflict');
   if(sequence<=current.sequence)throw Error('cursor_sequence_regression');
  }else if(previousEventId!==null)throw Error('cursor_parent_conflict');
  const wrapped={schema:ORDERED_CURSOR_SCHEMA,
   cursor:{sequence,eventId:id},value:structuredClone(state)};
  return this.#inner.commit({instanceId,expectedRevision,lastEventId:id,state:wrapped});
 }
}
