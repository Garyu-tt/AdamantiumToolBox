import {open,readFile,mkdir,rename,unlink} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hash} from './event_codec.mjs';
const SCHEMA='dante.atomic.record.v1';
export class AtomicStore{
 constructor(path,maxBytes){this.path=path;this.maxBytes=maxBytes;}
 async load(){
  let raw;try{raw=await readFile(this.path);}catch(e){if(e.code==='ENOENT')return null;throw e;}
  if(raw.byteLength>this.maxBytes*2+1024)throw Error('spool_too_large');
  let obj;try{obj=JSON.parse(raw.toString('utf8'));}catch{throw Error('spool_corrupt');}
  if(obj?.schema!==SCHEMA||typeof obj.payload!=='string'||
     Buffer.byteLength(obj.payload)>this.maxBytes||hash(obj.payload)!==obj.sha256)throw Error('spool_integrity_failed');
  try{return JSON.parse(obj.payload);}catch{throw Error('spool_corrupt');}
 }
 async save(state){
  const payload=JSON.stringify(state);
  if(Buffer.byteLength(payload)>this.maxBytes)throw Error('spool_capacity_exceeded');
  const record=JSON.stringify({schema:SCHEMA,sha256:hash(payload),payload});
  if(Buffer.byteLength(record)>this.maxBytes*2+1024)throw Error('spool_record_too_large');
  await mkdir(dirname(this.path),{recursive:true});
  const temp=join(dirname(this.path),'.spool-'+randomUUID()+'.tmp');
  let f;try{
   f=await open(temp,'wx',0o600);await f.writeFile(record,'utf8');await f.sync();
   await f.close();f=undefined;await rename(temp,this.path);
   let dir;try{dir=await open(dirname(this.path),'r');await dir.sync();}
   catch(e){if(!['EINVAL','EISDIR','EPERM','EACCES','ENOTSUP'].includes(e.code))throw e;}
   finally{await dir?.close();}
  }finally{await f?.close();await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 }
}
