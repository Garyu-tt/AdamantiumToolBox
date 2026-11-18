import {spawn} from 'node:child_process';
import {cp,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {packageDigest} from '../../approval.mjs';
const worker=fileURLToPath(new URL('./runner.py',import.meta.url));
const limits={output:65536,timeout:3500};
function argsFor(snapshot,probe=false){
 const args=['--unshare-all','--die-with-parent','--new-session','--clearenv'];
 for(const path of ['/usr','/bin','/lib','/lib64']){
  if(existsSync(path))args.push('--ro-bind',path,path);
 }
 args.push('--proc','/proc','--dev','/dev','--tmpfs','/tmp');
 if(snapshot){
  args.push('--ro-bind',snapshot,'/addon','--ro-bind',worker,'/runner.py','--chdir','/addon');
 }
 args.push('--setenv','HOME','/tmp','--setenv','PATH','/usr/local/bin:/usr/bin:/bin',
  '--setenv','LANG','C.UTF-8','--setenv','PYTHONDONTWRITEBYTECODE','1','--');
 return args.concat(probe?['python3','-I','-S','-c','print("FRANK_SANDBOX_OK")']:
  ['python3','-I','-S','/runner.py']);
}
function launch(args,input=''){
 return new Promise((resolve,reject)=>{
  if(process.platform!=='linux')return reject(Error('linux_namespace_required'));
  const bin=process.env.FRANK_BWRAP_BIN||'bwrap';
  const child=spawn(bin,args,{env:{PATH:process.env.PATH||'/usr/bin:/bin'},
   stdio:['pipe','pipe','pipe'],detached:true,windowsHide:true});
  let output='',error='',fault,exceeded=false;
  const kill=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}};
  const timer=setTimeout(()=>{exceeded=true;kill();},limits.timeout);
  child.on('error',e=>{fault=e;});
  child.stdin.on('error',()=>{});
  child.stdout.on('data',b=>{output+=b.toString();if(output.length>limits.output)kill();});
  child.stderr.on('data',b=>{error+=b.toString();if(error.length>limits.output)kill();});
  child.on('close',code=>{
   clearTimeout(timer);
   if(fault)return reject(Error('sandbox_unavailable'));
   if(exceeded)return reject(Error('sandbox_timeout'));
   if(code!==0)return reject(Error('sandbox_failed:'+error.slice(0,160)));
   if(output.length>limits.output)return reject(Error('sandbox_output_limit'));
   resolve(output);
  });
  child.stdin.end(input);
 });
}
export async function sandboxReady(){
 try{return (await launch(argsFor(null,true))).trim()==='FRANK_SANDBOX_OK';}
 catch{return false;}
}
export async function runPython(pkg,digest,action,params){
 if(!await sandboxReady())throw Error('sandbox_unavailable');
 const temp=await mkdtemp(join(tmpdir(),'frank-python-'));
 const snapshot=join(temp,'addon');
 try{
  await cp(pkg.directory,snapshot,{recursive:true,force:false,errorOnExist:true});
  if(await packageDigest(snapshot)!==digest)throw Error('snapshot_integrity_failure');
  const request=JSON.stringify({entry:pkg.manifest.entry,action,params});
  if(request.length>65536)throw Error('request_too_large');
  const out=JSON.parse(await launch(argsFor(snapshot),request));
  if(!out||!Object.prototype.hasOwnProperty.call(out,'result'))throw Error('invalid_python_result');
  return out.result;
 }finally{await rm(temp,{recursive:true,force:true});}
}
