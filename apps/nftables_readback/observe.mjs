import {stat} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parseRuleset} from './parse.mjs';
const invoke=promisify(execFile);
const nsName=x=>typeof x==='string'&&/^[a-zA-Z][a-zA-Z0-9_.-]{0,47}$/.test(x);
const path=x=>typeof x==='string'&&isAbsolute(x)&&!/\r|\n|\0/.test(x);
export async function observeRuleset(options={}){
 const unavailable=reason=>({schema:'nftables-readback-1',
  status:'unavailable',reason,namespaceAttested:false,
  kernelTransactionApplied:false,readyToApply:false});
 const namespace=options.namespace??process.env.ADA_NFT_OBSERVE_NAMESPACE;
 const root=options.namespaceRoot??process.env.ADA_NFT_OBSERVE_NAMESPACE_ROOT;
 const nft=options.nftBinary??process.env.ADA_NFT_OBSERVE_NFT;
 const ip=options.ipBinary??process.env.ADA_NFT_OBSERVE_IP;
 if(process.platform!=='linux'&&!options.mockPlatform)
  return unavailable('linux_required');
 if(!nsName(namespace)||!path(root)||!path(nft)||!path(ip))
  return unavailable('configured_isolated_namespace_required');
 let self,target;
 try{
  const readStat=options.stat??stat;
  [self,target]=await Promise.all([readStat('/proc/self/ns/net'),
   readStat(join(root,namespace))]);
 }catch{return unavailable('namespace_unavailable');}
 if(self.ino===target.ino&&self.dev===target.dev)
  return unavailable('namespace_matches_controller');
 const runner=options.runner??(async args=>(await invoke(ip,args,{
  shell:false,timeout:3000,maxBuffer:1048576,windowsHide:true})).stdout);
 try{
  const text=await runner(['netns','exec',namespace,nft,'-j','list','ruleset']);
  return {...parseRuleset(text,options.now?.()??new Date().toISOString()),
   scope:'configured_isolated_namespace',namespaceCompared:true,
   nodeIdentityVerified:false,kernelReadbackObserved:true};
 }catch{return unavailable('readback_probe_failed');}
}
