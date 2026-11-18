import {readdir,lstat,readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const cap=/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/;
const key=/^frank\.[a-z][a-z0-9_-]{0,39}\.[a-z][a-z0-9_-]{0,39}$/;
const blank=()=>({schema:'frank-registry-1',packages:[],adapters:[]});
export function stateFile(){
 const base=process.env.ADA_FRANK_STATE_DIR||
  (process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Adamantium Toolbox','frank'))||
  (process.env.XDG_STATE_HOME&&join(process.env.XDG_STATE_HOME,'adamantium-toolbox','frank'));
 return base?join(resolve(base),'registry.json'):null;
}
export async function packageDigest(dir){
 const hash=createHash('sha256');let count=0,bytes=0;
 async function walk(folder,prefix=''){
  const entries=(await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'));
  for(const e of entries){
   const p=join(folder,e.name),name=prefix+e.name,st=await lstat(p);
   if(st.isSymbolicLink())throw Error('package_symlink');
   if(st.isDirectory()){await walk(p,name+'/');continue;}
   if(!st.isFile()||++count>256||bytes+st.size>8388608)throw Error('package_limit');
   const value=await readFile(p);bytes+=value.length;
   if(bytes>8388608)throw Error('package_limit');
   hash.update(name+'\0'+value.length+'\0');hash.update(value);
  }
 }
 await walk(dir);return hash.digest('hex');
}
export function validRegistry(d){
 if(!d||d.schema!=='frank-registry-1'||!Array.isArray(d.packages)||
  !Array.isArray(d.adapters)||d.packages.length>128||d.adapters.length>64)return false;
 const ids=new Set(),providers=new Set();
 for(const p of d.packages){
  if(!key.test(p.key)||!/^[a-f0-9]{64}$/.test(p.digest)||ids.has(p.key))return false;
  ids.add(p.key);
 }
 for(const a of d.adapters){
  if(!cap.test(a.capability)||providers.has(a.capability)||
   !Number.isInteger(a.port)||a.port<1024||a.port>65535)return false;
  providers.add(a.capability);
 }
 return true;
}
export async function loadRegistry(){
 const file=stateFile();if(!file)return blank();
 try{
  const d=JSON.parse(await readFile(file,'utf8'));
  if(!validRegistry(d))throw Error('invalid_frank_registry');
  return d;
 }catch(e){if(e.code==='ENOENT')return blank();throw e;}
}
export async function saveRegistry(d){
 if(!validRegistry(d))throw Error('invalid_frank_registry');
 const file=stateFile();if(!file)throw Error('frank_state_dir_required');
 await mkdir(dirname(file),{recursive:true,mode:0o700});
 const tmp=file+'.'+process.pid+'.tmp';
 await writeFile(tmp,JSON.stringify(d,null,2)+'\n',{mode:0o600,flag:'wx'});
 await rename(tmp,file);
}
