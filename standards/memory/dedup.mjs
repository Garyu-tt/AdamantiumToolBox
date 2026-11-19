import {createHash} from 'node:crypto';

export const capabilities=Object.freeze({
 schema:'mas-memory-dedup-1',id:'dram-model',backend:'userspace-model',
 exactZeroDecode:false,physicalPageMerging:false,copyOnWrite:true,
 crossTenantSharing:false,requiresGpu:false
});

// This is a deterministic content store, NOT an MMU/KSM memory merger.
export class DedupRamModel{
 constructor({pageSize=4096,maxPages=4096,maxHandles=16384,hash}={}){
  if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>1048576)throw Error('invalid_page_size');
  if(!Number.isSafeInteger(maxPages)||maxPages<1)throw Error('invalid_page_limit');
  if(!Number.isSafeInteger(maxHandles)||maxHandles<1)throw Error('invalid_handle_limit');
  this.pageSize=pageSize;this.maxPages=maxPages;this.maxHandles=maxHandles;
  this.hash=hash??(bytes=>createHash('sha256').update(bytes).digest('hex'));
  this.index=new Map();this.handles=new Map();this.sequence=0;
 }
 _tenant(value){if(typeof value!=='string'||!value||value.length>128)throw Error('invalid_tenant');return value;}
 _bytes(value){
  if(!(value instanceof Uint8Array)||value.length!==this.pageSize)throw Error('invalid_page');
  return Buffer.from(value);
 }
 _digest(bytes){const key=this.hash(bytes);if(typeof key!=='string'||!key)throw Error('invalid_digest');return key;}
 _bucket(tenant,digest){return JSON.stringify([tenant,digest]);}
 _find(tenant,digest,bytes){
  return this.index.get(this._bucket(tenant,digest))?.find(p=>p.bytes.equals(bytes));
 }
 _intern(tenant,bytes){
  const digest=this._digest(bytes),same=this._find(tenant,digest,bytes);
  if(same){same.refs++;return same;}
  if(this.uniquePages>=this.maxPages)throw Error('page_limit');
  const key=this._bucket(tenant,digest),bucket=this.index.get(key)??[];
  const page={tenant,digest,bytes:Buffer.from(bytes),refs:1};
  bucket.push(page);this.index.set(key,bucket);return page;
 }
 _release(page){
  if(--page.refs>0)return;
  const key=this._bucket(page.tenant,page.digest),bucket=this.index.get(key);
  const idx=bucket.indexOf(page);if(idx<0)throw Error('corrupt_index');
  bucket.splice(idx,1);if(!bucket.length)this.index.delete(key);
 }
 _get(handle){const entry=this.handles.get(handle);if(!entry)throw Error('invalid_handle');return entry;}
 get uniquePages(){let count=0;for(const bucket of this.index.values())count+=bucket.length;return count;}
 allocate(bytes,{tenant='default'}={}){
  tenant=this._tenant(tenant);
  if(this.handles.size>=this.maxHandles)throw Error('handle_limit');
  const page=this._intern(tenant,this._bytes(bytes));
  const id='ram:'+(++this.sequence);this.handles.set(id,{tenant,page});return id;
 }
 readByte(handle,offset){
  const {page}=this._get(handle);
  if(!Number.isSafeInteger(offset)||offset<0||offset>=this.pageSize)throw Error('invalid_offset');
  return page.bytes[offset]; // Direct indexed byte; no archive decoding.
 }
 readCopy(handle){return Buffer.from(this._get(handle).page.bytes);} // Safe caller-owned copy.
 write(handle,offset,source){
  const entry=this._get(handle);
  if(!Number.isSafeInteger(offset)||offset<0)throw Error('invalid_offset');
  if(!(source instanceof Uint8Array)||source.length>this.pageSize-offset)throw Error('invalid_write');
  const next=Buffer.from(entry.page.bytes);Buffer.from(source).copy(next,offset);
  if(next.equals(entry.page.bytes))return;
  // Allocate before switching the handle: failure leaves the old mapping intact.
  const replacement=this._intern(entry.tenant,next),prior=entry.page;
  entry.page=replacement;this._release(prior);
 }
 release(handle){const entry=this._get(handle);this.handles.delete(handle);this._release(entry.page);}
 stats(){
  const unique=this.uniquePages,logical=this.handles.size*this.pageSize;
  const physical=unique*this.pageSize;
  const estimatedMetadata=unique*64+this.handles.size*24;
  return {schema:capabilities.schema,backend:capabilities.backend,simulated:true,
   logical_bytes:logical,unique_page_bytes:physical,estimated_index_bytes:estimatedMetadata,
   estimated_net_saved_bytes:logical-physical-estimatedMetadata,
   unique_pages:unique,aliases:this.handles.size};
 }
}
