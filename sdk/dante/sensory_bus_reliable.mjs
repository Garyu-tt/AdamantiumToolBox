// Optional CPU-only reliable sensory queue; original sensory_bus.mjs remains unchanged.
import {validateSensoryEvent,SENSORY_SCHEMA} from './sensory_bus.mjs';
export const RELIABLE_SENSORY_SCHEMA = SENSORY_SCHEMA;
function safeJSON(value) {
  const seen=new Set();
  function walk(v) {
    if(v===null||typeof v==='string'||typeof v==='boolean') return true;
    if(typeof v==='number') return Number.isFinite(v);
    if(typeof v!=='object'||seen.has(v)) return false;
    if(!Array.isArray(v) && (Object.getPrototypeOf(v)!==Object.prototype && Object.getPrototypeOf(v)!==null)) return false;
    seen.add(v);
    const ok=Array.isArray(v) ? Array.from({length:v.length},(_,i)=>i in v && walk(v[i])).every(Boolean) : Object.keys(v).every(k=>walk(v[k]));
    seen.delete(v);return ok;
  }
  return walk(value);
}
export class ReliableSensoryBus {
  #queue=[]; #sequences=new Map();
  #metrics={accepted:0,rejected:0,acked:0,replayed:0};
  constructor({capacity=64,maxEventBytes=65536,maxSources=256}={}) {
    for(const [name,value,limit] of [['capacity',capacity,65536],['maxEventBytes',maxEventBytes,1048576],['maxSources',maxSources,65536]])
      if(!Number.isSafeInteger(value)||value<1||value>limit) throw new RangeError('invalid_'+name);
    Object.assign(this,{capacity,maxEventBytes,maxSources});
  }
  #reject(reason){this.#metrics.rejected++;return {ok:false,reason};}
  publish(event){
    if(!validateSensoryEvent(event)||!safeJSON(event)) return this.#reject('invalid_event');
    let serialized;
    try{serialized=JSON.stringify(event);}catch{return this.#reject('invalid_event');}
    if(Buffer.byteLength(serialized,'utf8')>this.maxEventBytes) return this.#reject('event_too_large');
    const key=event.source+'\0'+event.kind;
    if(event.sequence<=(this.#sequences.get(key)??-1)) return this.#reject('non_monotonic_sequence');
    if(!this.#sequences.has(key)&&this.#sequences.size>=this.maxSources) return this.#reject('source_limit');
    if(this.#queue.length>=this.capacity) return this.#reject('backpressure');
    this.#queue.push({key,sequence:event.sequence,event:JSON.parse(serialized)});
    this.#sequences.set(key,event.sequence);this.#metrics.accepted++;return {ok:true};
  }
  peek(limit=this.capacity){
    if(!Number.isSafeInteger(limit)||limit<0) throw new RangeError('invalid_limit');
    const events=this.#queue.slice(0,limit).map(x=>structuredClone(x.event));
    this.#metrics.replayed+=events.length;return events;
  }
  ack(source,kind,sequence){
    if(typeof source!=='string'||typeof kind!=='string'||!Number.isSafeInteger(sequence)||sequence<0) return {ok:false,reason:'invalid_ack'};
    const key=source+'\0'+kind;
    const index=this.#queue.findIndex(x=>x.key===key&&x.sequence===sequence);
    if(index<0)return {ok:false,reason:'unknown_ack'};
    this.#queue.splice(index,1);this.#metrics.acked++;return {ok:true};
  }
  status(){return {schema:SENSORY_SCHEMA,queued:this.#queue.length,sources:this.#sequences.size,capacity:this.capacity,...this.#metrics};}
}
