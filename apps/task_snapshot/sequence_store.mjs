/**
 * R07 durable SINGLE-HOST monotonic sequence allocator (POSIX local filesystem).
 *
 * Intentionally NO automatic bootstrap, lock breaking, state reset, or key
 * generation. Corruption, missing state, a crash-held lock and unsafe file
 * permissions all fail closed until the operator reconciles the last epoch.
 *
 * Not a distributed CAS database; do not share it over NFS or across peers.
 */
import {open,readFile,lstat,mkdir,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const SCHEMA='mechanicus.snapshot-sequence/1';
const ID=/^[a-z][a-z0-9._:-]{0,127}$/;
const FILE='high-water.json';
const LOCK='high-water.lock';
function fail(why){throw new Error('Snapshot sequence store: '+why);}
function identifier(x){
 if(typeof x!=='string'||!ID.test(x))fail('invalid stream/issuer ID');
 return x;
}
async function safeDir(path,{create=false}={}){
 if(typeof path!=='string'||!path.startsWith('/'))fail('absolute operator-owned directory required');
 if(create)await mkdir(path,{recursive:true,mode:0o700});
 const st=await lstat(path);
 if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077)!==0)fail('unsafe directory');
 if(typeof process.getuid==='function'&&st.uid!==process.getuid())fail('directory owner mismatch');
}
async function fsyncDir(path){
 const dir=await open(path,'r');
 try{await dir.sync();}finally{await dir.close();}
}
async function atomicState(path,value){
 const file=join(path,FILE),tmp=join(path,'.pending-'+randomUUID());
 const body=JSON.stringify(value)+'\n';
 const out=await open(tmp,'wx',0o600);
 try{await out.writeFile(body,'utf8');await out.sync();}
 finally{await out.close();}
 // Incomplete pending temps may remain after a crash. They are never
 // consulted for recovery; operator reconciliation is required if lock remains.
 await rename(tmp,file);
 await fsyncDir(path);
}
async function readState(path){
 const file=join(path,FILE);
 const st=await lstat(file);
 if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)!==0)fail('unsafe state file');
 if(typeof process.getuid==='function'&&st.uid!==process.getuid())fail('state owner mismatch');
 const doc=JSON.parse(await readFile(file,'utf8'));
 if(!doc||doc.schema!==SCHEMA||!Number.isSafeInteger(doc.sequence)||doc.sequence<0||
    !ID.test(doc.streamId)||!ID.test(doc.issuerProviderId)||
    Object.keys(doc).sort().join(',')!=='issuerProviderId,schema,sequence,streamId'){
  fail('corrupted or unknown state format');
 }
 return doc;
}
async function withExclusiveLock(path,fn){
 const lockPath=join(path,LOCK);
 let lock;
 try{lock=await open(lockPath,'wx',0o600);}
 catch(e){
  if(e?.code==='EEXIST')fail('lock already exists; operator must inspect and reconcile');
  throw e;
 }
 try{
  await lock.writeFile(String(process.pid)+'\n');
  await lock.sync();
  await fsyncDir(path);
  return await fn();
 }finally{
  await lock.close();
  await unlink(lockPath);
  await fsyncDir(path);
 }
}
export class FileSequenceStore{
 constructor({directory}={}){
  if(typeof directory!=='string'||!directory.startsWith('/'))fail('explicit absolute directory required');
  this.directory=directory;
 }
 async initialize({streamId,issuerProviderId}={}){
  identifier(streamId);identifier(issuerProviderId);
  // This call is an EXPLICIT owner-approved bootstrap operation.
  await safeDir(this.directory,{create:true});
  return withExclusiveLock(this.directory,async()=>{
   try{await lstat(join(this.directory,FILE));fail('already initialized; refusing rollback');}
   catch(e){if(e?.code!=='ENOENT')throw e;}
   const doc={schema:SCHEMA,streamId,issuerProviderId,sequence:0};
   await atomicState(this.directory,doc);
   return {initialized:true,streamId,issuerProviderId,sequence:0};
  });
 }
 async inspect(){
  await safeDir(this.directory);
  return readState(this.directory);
 }
 async reserve({streamId,issuerProviderId}={}){
  identifier(streamId);identifier(issuerProviderId);
  await safeDir(this.directory);
  return withExclusiveLock(this.directory,async()=>{
   const state=await readState(this.directory);
   if(state.streamId!==streamId||state.issuerProviderId!==issuerProviderId)fail('stream/issuer identity mismatch');
   if(state.sequence>=Number.MAX_SAFE_INTEGER)fail('sequence exhausted');
   const next={...state,sequence:state.sequence+1};
   await atomicState(this.directory,next);
   return next.sequence;
  });
 }
}
