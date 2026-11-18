import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const defaults='standards/architecture/runtime-policy.json';
const valid=p=>p?.schema==='mas-runtime-policy-1'&&
 ['checkIntervalMs','startupGraceMs','healthTimeoutMs','crashLimit','windowMs',
 'backoffBaseMs','backoffMaxMs','stableResetMs'].every(k=>Number.isInteger(p[k])&&p[k]>0)&&
 p.crashLimit<=12&&p.checkIntervalMs>=1000&&p.healthTimeoutMs<=5000&&
 p.backoffMaxMs>=p.backoffBaseMs&&typeof p.autoRollback==='boolean';
export async function loadRuntimePolicy(root,runtime){
 let p;try{p=JSON.parse(await readFile(join(runtime,'runtime-policy.json'),'utf8'));}
 catch(e){if(e.code!=='ENOENT')throw e;p=JSON.parse(await readFile(join(root,defaults),'utf8'));}
 if(!valid(p))throw Error('invalid_runtime_policy');
 return p;
}
export class RuntimeGuard{
 constructor(policy,state={},clock=()=>Date.now()){if(!valid(policy))throw Error('invalid_runtime_policy');
  this.policy=policy;this.state=state;this.clock=clock;}
 get(key){return this.state[key]||{failures:[],retryAt:0,blocked:false};}
 allowed(key){const x=this.get(key);return !x.blocked&&this.clock()>=x.retryAt;}
 fail(key){
  const now=this.clock(),p=this.policy,x=this.get(key);
  const failures=x.failures.filter(t=>now-t<p.windowMs&&t<=now);failures.push(now);
  const blocked=failures.length>=p.crashLimit;
  const retryAt=now+Math.min(p.backoffMaxMs,p.backoffBaseMs*2**(failures.length-1));
  const state={failures,retryAt,blocked,attempted:blocked?x.attempted||false:false};
  this.state[key]=state;return state;
 }
 healthy(key){
  const x=this.get(key),now=this.clock();
  if(x.blocked)return;
  if(!x.healthySince)x.healthySince=now;
  if(now-x.healthySince>=this.policy.stableResetMs)
   this.state[key]={failures:[],retryAt:0,blocked:false,healthySince:now};
  else this.state[key]=x;
 }
 attempted(key){this.state[key]={...this.get(key),attempted:true};}
 prune(){const now=this.clock(),window=this.policy.windowMs;
  for(const [k,x] of Object.entries(this.state))
   if(!x.blocked&&(!x.failures?.length||now-Math.max(...x.failures)>window*2))delete this.state[k];
 }
}
export async function readGuard(runtime){
 try{return JSON.parse(await readFile(join(runtime,'plugins','runtime-guard.json'),'utf8'));}
 catch(e){if(e.code==='ENOENT')return {schema:'mas-runtime-guard-1',entries:{}};throw e;}
}
export async function persistGuard(runtime,guard){
 guard.prune();const dir=join(runtime,'plugins');await mkdir(dir,{recursive:true});
 const path=join(dir,'runtime-guard.json'),temp=path+'.'+randomUUID();
 try{await writeFile(temp,JSON.stringify({schema:'mas-runtime-guard-1',entries:guard.state}));
  await rename(temp,path);}finally{await rm(temp,{force:true});}
}
