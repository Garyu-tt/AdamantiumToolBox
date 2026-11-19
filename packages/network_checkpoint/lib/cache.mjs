import {open,readFile,lstat,rename,unlink} from 'node:fs/promises';
import {dirname,basename,isAbsolute} from 'node:path';
import {randomBytes} from 'node:crypto';
import {witnessReceipt} from './contract.mjs';
const valid=x=>typeof x==='string'&&isAbsolute(x)&&x.length<4000;
const safe=async path=>{if(!valid(path))throw Error('invalid_receipt_path');
 const parent=await lstat(dirname(path));
 if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o022))throw Error('unsafe_receipt_directory');
 const st=await lstat(path).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
 if(st&&(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)||st.size>16000))throw Error('unsafe_receipt_cache');
 return st;
};
export async function readCache(path,witness){if(!await safe(path))return null;
 const entry=JSON.parse(await readFile(path,'utf8'));
 if(entry?.schema!=='network-checkpoint-receipt-cache-v1'||!entry.result)throw Error('invalid_receipt_cache');
 const r=entry.result;
 witnessReceipt(r,r.receipt?.checkpoint,r.receipt?.sourceSignature,witness.id,witness.publicKey);
 return {seq:r.receipt.ledgerSeq,head:r.receipt.ledgerHead,revision:r.witnessRevision};
}
export async function saveCache(path,result,witness){await safe(path);
 witnessReceipt(result,result.receipt?.checkpoint,result.receipt?.sourceSignature,witness.id,witness.publicKey);
 const name=dirname(path)+'/.checkpoint-'+basename(path)+'-'+randomBytes(8).toString('hex')+'.tmp';
 let f;try{f=await open(name,'wx',0o600);
  await f.writeFile(JSON.stringify({schema:'network-checkpoint-receipt-cache-v1',result})+'\n');await f.sync();await f.close();f=null;
  await rename(name,path);const dir=await open(dirname(path),'r');try{await dir.sync();}finally{await dir.close();}
 }catch(e){if(f)await f.close();await unlink(name).catch(()=>{});throw e;}
}
export function compareCache(cache,state){if(!cache)return;
 if(cache.seq>state.ledgerSeq)throw Error('witness_rollback_detected');
 if(cache.seq===state.ledgerSeq&&cache.head!==state.ledgerHead)throw Error('witness_fork_detected');
}
