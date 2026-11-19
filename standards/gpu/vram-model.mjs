import {createHash} from 'node:crypto';

export const capabilities=Object.freeze({
 schema:'mas-gpu-memory-dedup-1',id:'dvram-model',backend:'cpu-state-machine',
 gpuDevicePresent:false,hardwareAliasing:false,readOnlyAliasModel:true,
 explicitCopyOnWrite:true,crossTenantSharing:false
});
const round=(n,g)=>Math.ceil(n/g)*g;

// No CUDA, driver or physical VRAM is touched by this model.
export class DedupVramModel{
 constructor({granularity=65536,maxPhysicalBytes=64*1024*1024,hash}={}){
  if(!Number.isSafeInteger(granularity)||granularity<1)throw Error('invalid_granularity');
  if(!Number.isSafeInteger(maxPhysicalBytes)||maxPhysicalBytes<granularity)throw Error('invalid_budget');
  this.granularity=granularity;this.maxPhysicalBytes=maxPhysicalBytes;
  this.hash=hash??(b=>createHash('sha256').update(b).digest('hex'));
  this.buckets=new Map();this.handles=new Map();this.sequence=0;
 }
 _valid(bytes){if(!(bytes instanceof Uint8Array)||bytes.length<1)throw Error('invalid_buffer');return Buffer.from(bytes);}
 _get(id){const h=this.handles.get(id);if(!h)throw Error('invalid_gpu_handle');return h;}
 _key(tenant,digest){return JSON.stringify([tenant,digest]);}
 _size(){let sum=0;for(const bucket of this.buckets.values())for(const item of bucket)sum+=item.physicalBytes;return sum;}
 _intern(tenant,bytes){
  const digest=this.hash(bytes);
  if(typeof digest!=='string'||!digest)throw Error('invalid_digest');
  const key=this._key(tenant,digest),bucket=this.buckets.get(key)??[];
  const same=bucket.find(p=>p.bytes.equals(bytes));
  if(same){same.refs++;return same;}
  const physicalBytes=round(bytes.length,this.granularity);
  if(this._size()+physicalBytes>this.maxPhysicalBytes)throw Error('gpu_budget_exceeded');
  const item={bytes:Buffer.from(bytes),physicalBytes,refs:1,key};
  bucket.push(item);this.buckets.set(key,bucket);return item;
 }
 _release(page){
  if(--page.refs>0)return;
  const bucket=this.buckets.get(page.key),idx=bucket.indexOf(page);
  if(idx<0)throw Error('gpu_index_corrupt');
  bucket.splice(idx,1);if(!bucket.length)this.buckets.delete(page.key);
 }
 allocate(bytes,{tenant='default'}={}){
  if(typeof tenant!=='string'||!tenant||tenant.length>128)throw Error('invalid_tenant');
  const page=this._intern(tenant,this._valid(bytes));
  const id='vram:'+(++this.sequence);this.handles.set(id,{page,tenant,busy:0});return id;
 }
 readByte(id,index){
  const p=this._get(id).page.bytes;
  if(!Number.isSafeInteger(index)||index<0||index>=p.length)throw Error('invalid_offset');
  return p[index]; // In a real backend this would be a GPU kernel read.
 }
 beginReadKernel(id){const h=this._get(id);h.busy++;return {handle:id,closed:false};}
 endReadKernel(lease){
  if(!lease||lease.closed)throw Error('invalid_kernel_lease');
  const h=this._get(lease.handle);
  if(!h.busy)throw Error('invalid_kernel_lease');h.busy--;lease.closed=true;
 }
 write(id,index,bytes){
  const h=this._get(id),old=h.page.bytes;
  if(h.busy)throw Error('gpu_allocation_busy');
  if(!Number.isSafeInteger(index)||index<0||!(bytes instanceof Uint8Array)||bytes.length>old.length-index)
   throw Error('invalid_write');
  const next=Buffer.from(old);Buffer.from(bytes).copy(next,index);
  if(next.equals(old))return;
  const p=this._intern(h.tenant,next),prior=h.page;
  h.page=p;this._release(prior); // Explicit pre-launch COW, not a GPU page fault.
 }
 release(id){const h=this._get(id);if(h.busy)throw Error('gpu_allocation_busy');this.handles.delete(id);this._release(h.page);}
 stats(){
  const unique=[...this.buckets.values()].flat(),physical=this._size();
  const logical=[...this.handles.values()].reduce((s,h)=>s+round(h.page.bytes.length,this.granularity),0);
  const estimatedMetadata=unique.length*80+this.handles.size*32;
  return {schema:capabilities.schema,simulated:true,gpuDevicePresent:false,
   logical_aligned_bytes:logical,unique_aligned_bytes:physical,
   estimated_index_bytes:estimatedMetadata,estimated_net_saved_bytes:logical-physical-estimatedMetadata,
   unique_allocations:unique.length,aliases:this.handles.size};
 }
}
