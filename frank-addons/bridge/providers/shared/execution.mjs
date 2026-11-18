import {spawn} from 'node:child_process';
import {cp,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {packageDigest} from '../../approval.mjs';
const LIMIT=65536, TIMEOUT=3500;
function sandboxArgs(snapshot,runner,profile,probe=false){
 const args=['--unshare-all','--die-with-parent','--new-session','--clearenv'];
 for(const path of ['/usr','/bin','/lib','/lib64']){
  if(existsSync(path))args.push('--ro-bind',path,path);
 }
 args.push('--proc','/proc','--dev','/dev','--tmpfs','/tmp');
 if(profile.executable){
  args.push('--ro-bind',profile.executable,'/frank-executable');
 }
 if(!probe){
  args.push('--ro-bind',snapshot,'/addon','--ro-bind',runner,'/frank-runner',
   '--chdir','/addon');
 }
 args.push('--setenv','HOME','/tmp','--setenv','PATH','/usr/local/bin:/usr/bin:/bin',
  '--setenv','LANG','C.UTF-8','--setenv','PYTHONDONTWRITEBYTECODE','1','--');
 return args.concat(probe?profile.probe:profile.command.concat('/frank-runner'));
}
function launch(args,input=''){
 return new Promise((resolve,reject)=>{
  if(process.platform!=='linux')return reject(Error('linux_namespace_required'));
  const child=spawn(process.env.FRANK_BWRAP_BIN||'bwrap',args,{
   env:{PATH:process.env.PATH||'/usr/bin:/bin'},
   stdio:['pipe','pipe','pipe'],detached:true,windowsHide:true});
  let stdout='',stderr='',failure,timedOut=false,overflow=false;
  const kill=()=>{
   try{if(child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}
   catch{child.kill('SIGKILL');}
  };
  const timer=setTimeout(()=>{timedOut=true;kill();},TIMEOUT);
  child.on('error',e=>failure=e);
  child.stdin.on('error',()=>{});
  child.stdout.on('data',v=>{
   stdout+=v.toString();if(stdout.length>LIMIT){overflow=true;kill();}
  });
  child.stderr.on('data',v=>{
   stderr+=v.toString();if(stderr.length>LIMIT){overflow=true;kill();}
  });
  child.on('close',code=>{
   clearTimeout(timer);
   if(failure)return reject(Error('sandbox_unavailable'));
   if(timedOut)return reject(Error('sandbox_timeout'));
   if(overflow)return reject(Error('sandbox_output_limit'));
   if(code!==0)return reject(Error('sandbox_failed:'+stderr.slice(0,160)));
   resolve(stdout);
  });
  child.stdin.end(input);
 });
}
export async function ready(profile){
 try{return (await launch(sandboxArgs(null,null,profile,true))).trim()===
  profile.readyText;}
 catch{return false;}
}
export async function execute(pkg,digest,action,params,runner,profile){
 if(!await ready(profile))throw Error('sandbox_unavailable');
 const parent=await mkdtemp(join(tmpdir(),'frank-isolated-'));
 const snapshot=join(parent,'addon');
 try{
  await cp(pkg.directory,snapshot,{recursive:true,force:false,errorOnExist:true});
  if(await packageDigest(snapshot)!==digest)throw Error('snapshot_integrity_failure');
  const request=JSON.stringify({entry:pkg.manifest.entry,action,params});
  if(request.length>LIMIT)throw Error('request_too_large');
  const output=JSON.parse(await launch(sandboxArgs(snapshot,runner,profile),request));
  if(!output||!Object.prototype.hasOwnProperty.call(output,'result'))
   throw Error('invalid_adapter_result');
  return output.result;
 }finally{await rm(parent,{recursive:true,force:true});}
}
