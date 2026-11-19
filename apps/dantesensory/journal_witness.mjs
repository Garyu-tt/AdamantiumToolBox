import {open as openFile,access,readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
const MARK='dante.sensory.journal.initialized.v1\n';
export async function witnessExists(path){
 try{await access(path+'.initialized');return true;}
 catch(e){if(e.code==='ENOENT')return false;throw e;}
}
export async function ensureWitness(path){
 const witness=path+'.initialized';
 let handle,created=false;
 try{handle=await openFile(witness,'wx',0o600);created=true;}
 catch(e){if(e.code!=='EEXIST')throw e;}
 if(created){
  try{await handle.writeFile(MARK);await handle.sync();}
  finally{await handle.close();}
  let dir;
  try{dir=await openFile(dirname(witness),'r');await dir.sync();}
  catch(e){if(!['EINVAL','EISDIR','EPERM','EACCES','ENOTSUP'].includes(e.code))throw e;}
  finally{await dir?.close();}
 }
 // Existing incomplete/foreign markers must never authorize a new commit.
 if(await readFile(witness,'utf8')!==MARK)throw Error('journal_witness_invalid');
}
