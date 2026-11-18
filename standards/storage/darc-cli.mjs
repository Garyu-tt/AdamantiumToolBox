import {access,readFile} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';
const MAX_OUTPUT=1024*1024;
async function available(path){try{await access(path);return true;}catch{return false;}}
export async function discoverDarc(config={}){
 const candidates=[config.executable,process.env.DEDUPARC_BIN];
 if(process.platform==='win32'&&process.env.LOCALAPPDATA)
  candidates.push(join(process.env.LOCALAPPDATA,'Programs','DedupArc','deduparc-core.exe'));
 for(const name of candidates){
  if(typeof name==='string'&&isAbsolute(name)&&await available(name))return name;
 }
 throw Error('deduparc_provider_unavailable');
}
export function runDarc(binary,args,{timeout=120000}={}){
 return new Promise((resolve,reject)=>{
  if(!isAbsolute(binary)||!Array.isArray(args))return reject(Error('invalid_provider_arguments'));
  let settled=false,stdout='',stderr='';
  const child=spawn(binary,args,{windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
  const timer=setTimeout(()=>child.kill(),timeout);
  const rejectOnce=err=>{if(!settled){settled=true;clearTimeout(timer);reject(err);}};
  for(const [stream,field] of [[child.stdout,'out'],[child.stderr,'err']]){
   stream.on('data',chunk=>{
    if(field==='out')stdout+=chunk.toString('utf8');else stderr+=chunk.toString('utf8');
    if(stdout.length+stderr.length>MAX_OUTPUT)child.kill();
   });
  }
  child.on('error',rejectOnce);
  child.on('close',code=>{
   if(settled)return;
   clearTimeout(timer);settled=true;
   if(code!==0)return reject(Error('darc_failed_'+code+':'+stderr.slice(0,180)));
   resolve({stdout,stderr});
  });
 });
}
export async function configuredDarc(configFile){
 if(!configFile)return discoverDarc();
 const config=JSON.parse(await readFile(configFile,'utf8'));
 return discoverDarc(config);
}
