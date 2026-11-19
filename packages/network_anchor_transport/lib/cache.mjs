import {readFile,lstat,open,rename,unlink} from 'node:fs/promises';
import {dirname,basename,isAbsolute} from 'node:path';
import {randomBytes} from 'node:crypto';
import {verifyRemoteState} from './verify.mjs';
async function safe(path){if(typeof path!=='string'||!isAbsolute(path)||path.length>4000)throw Error('invalid_cache_path');
 const parent=await lstat(dirname(path));if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o022))throw Error('unsafe_cache_parent');
 const st=await lstat(path).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
 if(st&&(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)||st.size>16000))throw Error('unsafe_cache_file');return st;
}
export async function loadCache(path,trust){if(!await safe(path))return null;
 let d;try{d=JSON.parse(await readFile(path,'utf8'));}catch{throw Error('corrupt_cache');}
 if(d?.schema!=='network-anchor-transport-cache-v1')throw Error('invalid_cache');
 return verifyRemoteState(d.state,trust);
}
export function compareCache(cache,remote){if(!cache)return;
 if(remote.count<cache.count||remote.witnessSeq<cache.witnessSeq)throw Error('anchor_rollback_detected');
 if(remote.count===cache.count&&remote.revision!==cache.revision)throw Error('anchor_fork_detected');
 if(remote.witnessSeq===cache.witnessSeq&&remote.witnessHead!==cache.witnessHead)throw Error('anchor_fork_detected');
}
export async function saveCache(path,state,trust){await safe(path);verifyRemoteState(state,trust);
 const temporary=dirname(path)+'/.anchor-'+basename(path)+'-'+randomBytes(8).toString('hex')+'.tmp';let f;
 try{f=await open(temporary,'wx',0o600);
  await f.writeFile(JSON.stringify({schema:'network-anchor-transport-cache-v1',state})+'\n');await f.sync();await f.close();f=null;
  await rename(temporary,path);const d=await open(dirname(path),'r');try{await d.sync();}finally{await d.close();}
 }catch(e){if(f)await f.close();await unlink(temporary).catch(()=>{});throw e;}
}
