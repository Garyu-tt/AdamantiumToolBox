import {stat} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {spawn} from 'node:child_process';
import {compileLabScript} from './compile.mjs';
const nsName=x=>typeof x==='string'&&/^[a-zA-Z][a-zA-Z0-9_.-]{0,47}$/.test(x);
const isBinary=x=>typeof x==='string'&&isAbsolute(x)&&!/\r|\n|\0/.test(x);
export function spawnReadOnly(command,args,stdin){
 return new Promise(resolve=>{
  const child=spawn(command,args,{shell:false,stdio:['pipe','ignore','pipe'],
   windowsHide:true,env:{PATH:process.env.PATH||''}});
  let stderr='',done=false;
  const finish=result=>{if(done)return;done=true;clearTimeout(timer);resolve(result);};
  const timer=setTimeout(()=>{child.kill('SIGKILL');finish({ok:false,code:'check_timeout'});},4000);
  child.on('error',()=>finish({ok:false,code:'execution_failed'}));
  child.stderr.on('data',part=>{if(stderr.length<8192)stderr+=part.toString().slice(0,8192);});
  child.on('close',(code,signal)=>finish({ok:code===0&&signal===null,
   code:code===0?'syntax_valid':'syntax_rejected'}));
  child.stdin.on('error',()=>{});
  child.stdin.end(stdin);
 });
}
export async function checkLab(preview,options={}){
 const script=compileLabScript(preview);
 const unavailable=(reason)=>({schema:'nftables-lab-check-1',
  status:'unavailable',reason,scriptSha256:script.sha256,table:script.table,
  scope:'no_kernel_writes',syntaxVerified:false,namespaceVerified:false,
  applied:false,canApply:false});
 const ns=options.namespace??process.env.ADA_NFT_LAB_NAMESPACE;
 const nft=options.nftBinary??process.env.ADA_NFT_LAB_NFT;
 const ip=options.ipBinary??process.env.ADA_NFT_LAB_IP;
 if(process.platform!=='linux'&&!options.mockPlatform)
  return unavailable('linux_required');
 if(!nsName(ns)||!isBinary(nft)||!isBinary(ip))
  return unavailable('sandbox_configuration_missing');
 const readStat=options.stat??stat;
 let active,target;
 try{
  [active,target]=await Promise.all([readStat('/proc/self/ns/net'),
   readStat(join('/var/run/netns',ns))]);
 }catch{return unavailable('sandbox_not_verified');}
 if(active.ino===target.ino&&active.dev===target.dev)
  return unavailable('sandbox_matches_process_namespace');
 const runner=options.runner??spawnReadOnly;
 let result;
 try{
  result=await runner(ip,['netns','exec',ns,nft,'--check','--file','-'],script.script);
 }catch{return unavailable('checker_unavailable');}
 return {schema:'nftables-lab-check-1',status:result?.ok===true?'syntax_checked':'failed',
  reason:result?.ok===true?null:'nft_syntax_check_failed',
  scriptSha256:script.sha256,table:script.table,scope:'isolated_existing_namespace',
  namespaceVerified:true,syntaxVerified:result?.ok===true,
  applied:false,canApply:false,rollbackArmed:false};
}
