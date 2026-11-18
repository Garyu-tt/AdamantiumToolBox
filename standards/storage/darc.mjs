import {access,mkdir,rename,rm,stat} from 'node:fs/promises';
import {dirname,extname,resolve,basename,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {discoverDarc,runDarc} from './darc-cli.mjs';
const modes=new Set(['fast','balanced','maximum']);
export const capabilities=Object.freeze({
 schema:'mas-storage-provider-1',id:'deduparc',format:'.darc',
 snapshot:true,restore:true,list:true,verify:true,
 randomAccess:false,inPlaceWrite:false,dependencies:false
});
async function exists(path){try{await access(path);return true;}catch{return false;}}
function archivePath(path){
 if(typeof path!=='string'||!path.trim())throw Error('invalid_archive_path');
 const full=resolve(path);
 if(extname(full).toLowerCase()!=='.darc')throw Error('archive_extension_required');
 return full;
}
export async function snapshot({sources,destination,profile='balanced',executable}){
 if(!Array.isArray(sources)||!sources.length||sources.length>256)throw Error('invalid_sources');
 if(!modes.has(profile))throw Error('invalid_compression_profile');
 const output=archivePath(destination),paths=sources.map(p=>resolve(p));
 for(const path of paths)if(!(await exists(path)))throw Error('source_missing');
 if(await exists(output))throw Error('archive_exists');
 await mkdir(dirname(output),{recursive:true});
 const stage=join(dirname(output),'.'+basename(output)+'.'+randomUUID()+'.darc');
 const binary=await discoverDarc({executable});
 try{
  await runDarc(binary,['create','--'+profile,stage,...paths]);
  await runDarc(binary,['verify',stage]);
  if(await exists(output))throw Error('archive_exists');
  await rename(stage,output);
  return {schema:capabilities.schema,format:capabilities.format,destination:output,
   bytes:(await stat(output)).size,verified:true};
 }finally{await rm(stage,{force:true});}
}
export async function inspect({archive,operation='list',executable}){
 if(!['list','info','verify'].includes(operation))throw Error('invalid_operation');
 const path=archivePath(archive),binary=await discoverDarc({executable});
 const result=await runDarc(binary,[operation,path]);
 return {operation,archive:path,output:result.stdout.trim(),verified:operation==='verify'};
}
export async function restore({archive,destination,executable}){
 const path=archivePath(archive),out=resolve(destination);
 if(await exists(out))throw Error('destination_exists');
 const binary=await discoverDarc({executable});
 await runDarc(binary,['verify',path]);
 const stage=out+'.'+randomUUID()+'.staging';
 try{
  await runDarc(binary,['extract',path,stage]);
  if(await exists(out))throw Error('destination_exists');
  await rename(stage,out);
  return {destination:out,verified:true};
 }catch(e){await rm(stage,{recursive:true,force:true});throw e;}
}
