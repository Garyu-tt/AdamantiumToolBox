#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Prove a signed Lifecycle stage using a DISPOSABLE test identity.
// Never access, import, copy or change the real MAS owner identity or policy.
import {mkdtemp,mkdir,writeFile,readFile,lstat,rename,rm,stat} from 'node:fs/promises';
import {join,resolve,isAbsolute,parse,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {createPublicKey,verify,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {identity} from '../core/node_identity.mjs';
import {factoryLifecyclePreflight,stageFactoryAnchor,inspectFactoryStage}
 from './factory-anchor-lifecycle-r10.mjs';
import {readEnvelope} from '../standards/mesh/store.mjs';
import {current} from '../standards/lifecycle/registry.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const outputArg=process.argv[2];
async function main(){
 if(process.argv.length!==3||!outputArg||!isAbsolute(outputArg))
  fail('explicit_sandbox_status_directory_required');
 const output=resolve(outputArg);
 if(output===parse(output).root||!(await stat(output)).isDirectory())
  fail('unsafe_sandbox_view_destination');
 const sandbox=await mkdtemp(join(tmpdir(),'mas-r10-disposable-signer-'));
 const original=process.env.LOCALAPPDATA;
 let record;
 try{
  process.env.LOCALAPPDATA=sandbox;
  const runtime=join(sandbox,'Adamantium Toolbox');
  await mkdir(runtime);
  const owner=await identity(join(runtime,'mesh'));
  await writeFile(join(runtime,'policy.json'),JSON.stringify({
   schema:'mas-owner-policy-1',
   capabilities:['factory_anchor.read','factory_anchor.attest']
  }),{flag:'wx',mode:0o600});
  const pre=await factoryLifecyclePreflight(project,runtime);
  if(!pre.readyForStaging)fail('disposable_signer_preflight_denied');
  const stage=await stageFactoryAnchor(project,runtime,pre.runtimeRegistryRevision);
  const checked=await inspectFactoryStage(project,runtime,stage.digest);
  const env=await readEnvelope(runtime,stage.digest);
  const signature=Buffer.from(env.signature,'base64');
  const valid=verify(null,Buffer.from(env.hash),createPublicKey(owner.publicKey),signature);
  const after=await current(runtime);
  if(!valid||!checked.signatureVerified||checked.active||after.apps.length!==0||
    after.revision!==pre.runtimeRegistryRevision)
   fail('disposable_signed_staging_integrity_failed');
  record={
   schema:'adamantium.factory_anchor.sandbox-stage/1',
   state:'sandbox_signed_staged_unactivated',app:'factory_anchor',
   testIdentityOnly:true,ownerProductionIdentityUsed:false,
   testKeyPublicPem:owner.publicKey,
   testPackageSignature:env.signature,
   packageHash:env.hash,
   signedPackageReadbackVerified:true,
   activationPlanId:stage.activationPlanId,
   testCoreActiveApps:after.apps.length,
   productionCoreModified:false,ownerPolicyModified:false,
   productionAppActivated:false,
   meaning:'Isolated signer in disposable runtime: not actual operator MAS approval'
  };
 }finally{
  if(original===undefined)delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA=original;
  await rm(sandbox,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
 record.ephemeralSigningKeyDestroyed=true;
 const path=join(output,'factory-anchor-r10-sandbox-stage.json');
 try{
  const old=await lstat(path);
  if(!old.isFile()||old.isSymbolicLink())fail('refuse_unowned_sandbox_receipt');
  const previous=JSON.parse(await readFile(path,'utf8'));
  if(previous.schema!==record.schema)fail('refuse_other_status_schema');
 }catch(e){if(e.code!=='ENOENT')throw e;}
 const temp=join(output,'r10-sandbox-'+randomUUID()+'.tmp');
 try{
  await writeFile(temp,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
  await rename(temp,path);
 }finally{await rm(temp,{force:true});}
 process.stdout.write(JSON.stringify({
  state:record.state,digest:record.packageHash,
  signatureVerified:true,ephemeralSigningKeyDestroyed:true,
  productionCoreModified:false,outputFile:path
 })+'\n');
}
try{await main();}catch(e){
 process.stderr.write('R10 disposable sandbox refused: '+(e.code||e.message||'failed').slice(0,100)+'\n');
 process.exitCode=1;
}
