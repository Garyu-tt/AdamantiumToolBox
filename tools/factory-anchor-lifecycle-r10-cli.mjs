// SPDX-License-Identifier: Apache-2.0
import {resolve,join,isAbsolute,parse,relative} from 'node:path';
import {readFile,lstat,stat,writeFile,rename,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {factoryLifecyclePreflight,stageFactoryAnchor,inspectFactoryStage}
 from './factory-anchor-lifecycle-r10.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const runtimeHome=process.env.LOCALAPPDATA;
const [cmd,revisionOrDigest,outputArg,...extra]=process.argv.slice(2);
const nested=(a,b)=>{
 const rel=relative(a,b);
 return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));
};
const publicView=result=>{
 const stage=result?.schema==='adamantium.factory_anchor.lifecycle-stage/1';
 return {
  schema:'adamantium.factory_anchor.lifecycle-view/1',
  app:'factory_anchor',
  state:stage?result.state:
   result.readyForStaging?'ready_to_stage':'not_ready',
  version:result.version,
  signedPackageDigest:stage?result.digest:null,
  signatureVerified:stage?result.signatureVerified:false,
  activationPlanId:stage?result.activationPlanId:null,
  selectedInCore:stage?result.active:result.active,
  sourceReady:stage?true:result.readyForStaging,
  readPermissionApproved:stage?true:result.permissionReadApproved,
  attestPermissionApproved:stage?true:result.permissionAttestApproved,
  registryRevision:stage?result.registryRevision:result.runtimeRegistryRevision,
  missingPermissions:stage?[]:result.missingPermissions,
  operatorPolicyApprovalRequired:stage?false:result.missingPermissions.length>0,
  executionNeverStarted:true,
  activeProductionServiceVerified:false,
  productionInstallationPerformed:false,
  policyEdited:false,signingKeysExposed:false,
  needsExplicitActivationApproval:stage?result.needsExplicitActivationApproval:true
 };
};
async function saveView(out,value,runtime){
 if(typeof out!=='string'||!isAbsolute(out))fail('absolute_readonly_view_destination_required');
 const path=resolve(out),production=resolve(runtime);
 if(path===parse(path).root||nested(path,production)||nested(production,path))
  fail('forbidden_lifecycle_view_root');
 if(!(await stat(path)).isDirectory())fail('output_directory_missing');
 const file=join(path,'factory-anchor-lifecycle-r10.json');
 try{
  const old=await lstat(file);
  if(!old.isFile()||old.isSymbolicLink())fail('refuse_unowned_status');
  const prior=JSON.parse(await readFile(file,'utf8'));
  if(prior.schema!==value.schema)fail('refuse_other_status');
 }catch(e){if(e.code!=='ENOENT')throw e;}
 const temp=join(path,'factory-lifecycle-'+randomUUID()+'.tmp');
 try{
  await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
  await rename(temp,file);
 }finally{await rm(temp,{force:true});}
 return file;
}
async function main(){
 if(!runtimeHome||!isAbsolute(runtimeHome)||extra.length)
  fail('explicit_local_runtime_required');
 const runtime=join(runtimeHome,'Adamantium Toolbox');
 let result;
 if(cmd==='preflight'&&(!revisionOrDigest||revisionOrDigest==='-')){
  result=await factoryLifecyclePreflight(project,runtime);
 }else if(cmd==='stage-only'&&revisionOrDigest){
  result=await stageFactoryAnchor(project,runtime,revisionOrDigest);
 }else if(cmd==='inspect'&&revisionOrDigest){
  result=await inspectFactoryStage(project,runtime,revisionOrDigest);
 }else fail('lifecycle_usage_preflight_stage_only_inspect');
 const view=publicView(result);
 const file=outputArg?await saveView(outputArg,view,runtime):null;
 process.stdout.write(JSON.stringify({
  ...view,viewFile:file
 })+'\n');
}
try{await main();}
catch(e){
 process.stderr.write('R10 lifecycle denied: '+(e.code||e.message||'unknown').slice(0,95)+'\n');
 process.exitCode=1;
}
