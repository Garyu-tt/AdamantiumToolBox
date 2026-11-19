import {strict as assert} from 'node:assert';
import {DedupRamModel,capabilities} from '../standards/memory/dedup.mjs';
assert.equal(capabilities.physicalPageMerging,false);
const make=(n)=>new Uint8Array(4096).fill(n);
const pool=new DedupRamModel();
const ids=Array.from({length:4},()=>pool.allocate(make(7)));
assert.equal(pool.stats().unique_pages,1);
assert.equal(pool.stats().logical_bytes,16384);
assert.equal(pool.readByte(ids[2],100),7);
pool.write(ids[0],100,Uint8Array.of(99));
assert.equal(pool.readByte(ids[0],100),99);
assert.equal(pool.readByte(ids[1],100),7);
assert.equal(pool.stats().unique_pages,2);
pool.write(ids[0],100,Uint8Array.of(7));
assert.equal(pool.stats().unique_pages,1);
const external=pool.readCopy(ids[0]);external[0]=255;
assert.equal(pool.readByte(ids[0],0),7);
assert.throws(()=>pool.readByte('missing',0),/invalid_handle/);
assert.throws(()=>pool.write(ids[0],4096,Uint8Array.of(1)),/invalid_write/);
for(const id of ids)pool.release(id);
assert.equal(pool.stats().unique_pages,0);

// Hash collisions MUST NOT conflate distinct pages.
const collide=new DedupRamModel({hash:()=> 'same'});
const a=collide.allocate(make(1)),b=collide.allocate(make(2));
assert.equal(collide.stats().unique_pages,2);
assert.equal(collide.readByte(a,0),1);
assert.equal(collide.readByte(b,0),2);
collide.release(a);collide.release(b);

// Equal private bytes across trust domains are not shared.
const isolated=new DedupRamModel();
const x=isolated.allocate(make(1),{tenant:'a'});
const y=isolated.allocate(make(1),{tenant:'b'});
assert.equal(isolated.stats().unique_pages,2);
isolated.release(x);isolated.release(y);

const limited=new DedupRamModel({maxPages:1});
const z=limited.allocate(make(1));
assert.throws(()=>limited.write(z,0,Uint8Array.of(2)),/page_limit/);
assert.equal(limited.readByte(z,0),1);
assert.equal(limited.stats().unique_pages,1);
limited.release(z);

const handleLimit=new DedupRamModel({maxHandles:1});
const first=handleLimit.allocate(make(1));
assert.throws(()=>handleLimit.allocate(make(1)),/handle_limit/);
handleLimit.release(first);
console.log('DRAM_MODEL_OK exact-match, COW, collision, isolation, limits, no-decode byte reads');
