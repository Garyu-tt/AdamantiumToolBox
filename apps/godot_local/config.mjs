import {readFile,realpath,stat} from 'node:fs/promises';
import {isAbsolute,join,relative} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const config=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
export const expectedVersion=config.engine.upstreamVersion;
export async function engine(){
 const binary=process.env.ADA_GODOT_EXECUTABLE;
 if(!binary)return {configured:false,reason:'godot_executable_not_configured',
  expectedVersion};
 if(!isAbsolute(binary))return {configured:false,reason:'executable_must_be_absolute',
  expectedVersion};
 try{
  const {stdout}=await run(binary,['--version'],{timeout:2500,windowsHide:true});
  const version=stdout.trim().split(/\s/)[0];
  if(!version.startsWith(expectedVersion))
   return {configured:false,reason:'engine_version_mismatch',version,expectedVersion};
  return {configured:true,version,expectedVersion};
 }catch{return {configured:false,reason:'engine_probe_failed',expectedVersion};}
}
export async function projectPath(projectId){
 if(typeof projectId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(projectId))
  throw Error('invalid_project_id');
 const root=process.env.ADA_GODOT_PROJECT_ROOT;
 if(!root||!isAbsolute(root))throw Error('project_root_not_configured');
 const base=await realpath(root),dir=await realpath(join(base,projectId));
 const rel=relative(base,dir);
 if(!rel||rel==='..'||rel.startsWith('..\\')||rel.startsWith('../')||isAbsolute(rel))
  throw Error('project_outside_root');
 const descriptor=await realpath(join(dir,'project.godot'));
 const sub=relative(dir,descriptor);
 if(sub==='..'||sub.startsWith('../')||sub.startsWith('..\\')||isAbsolute(sub))
  throw Error('project_descriptor_outside_root');
 if(!(await stat(descriptor)).isFile())throw Error('project_descriptor_missing');
 return dir;
}
export async function check(projectId){
 const path=await projectPath(projectId);
 return {projectId,ready:true,projectPath:path,engine:await engine()};
}
