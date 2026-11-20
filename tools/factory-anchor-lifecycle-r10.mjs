// SPDX-License-Identifier: Apache-2.0
// Signed MAS lifecycle stage for factory_anchor. NEVER activates or grants policy.
// This source-tool is not an app runtime dependency.
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {packDir} from '../standards/mesh/bundle.mjs';
import {seal,trustEnvelope} from '../standards/mesh/identity.mjs';
import {receive,readEnvelope} from '../standards/mesh/store.mjs';
import {planActivation} from '../standards/lifecycle/plan.mjs';
import {current} from '../standards/lifecycle/registry.mjs';
import {existingIdentity} from '../core/node_identity.mjs';
import {catalog} from '../core/catalog.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const hash=data=>createHash('sha256').update(data).digest('hex');
const factory='factory_anchor';
async function context(project,runtime){
 const root=resolve(project),dir=resolve(runtime);
 const owner=await existingIdentity(join(dir,'mesh'));
 const m=JSON.parse(await readFile(join(root,'packages/factory_anchor/manifest.json'),'utf8'));
 if(m.id!==factory||m.lifecycle!=='independent'||
   m.service.protocol!=='mas-http-1'||m.auth.mode!=='host-delegated')
  fail('factory_anchor_manifest_not_isolated');
 const file=join(dir,'policy.json');
 let policy;
 try{policy=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));}
 catch{fail('owner_policy_unavailable');}
 if(policy.schema!=='mas-owner-policy-1'||!Array.isArray(policy.capabilities))
  fail('owner_policy_invalid');
 const grants=new Set(policy.capabilities);
 const permissions=m.permissions||[];
 const missing=permissions.filter(x=>!grants.has(x));
 const selected=await current(dir);
 const active=selected.apps.some(x=>x.id===factory);
 const appList=await catalog(root);
 const reserved=appList.some(x=>x.id!==factory&&x.service.port===m.service.port);
 return {root,dir,owner,m,missing,selected,active,reserved};
}
export async function factoryLifecyclePreflight(project,runtime){
 const ctx=await context(project,runtime);
 return {
  schema:'adamantium.factory_anchor.lifecycle-preflight/1',
  app:factory,version:ctx.m.version,
  active:ctx.active,readyForStaging:
   !ctx.active&&!ctx.reserved&&ctx.missing.length===0,
  runtimeRegistryRevision:ctx.selected.revision,
  permissionReadApproved:ctx.missing.includes('factory_anchor.read')===false,
  permissionAttestApproved:ctx.missing.includes('factory_anchor.attest')===false,
  missingPermissions:ctx.missing,
  portReserved:ctx.reserved,manifestPort:ctx.m.service.port,
  ownerIdentityPresent:true,signingKeyAccessed:false,
  keyMaterialReturned:false,productionAppModified:false
 };
}
export async function stageFactoryAnchor(project,runtime,expectedRevision){
 if(typeof expectedRevision!=='string'||!/^[0-9a-f]{64}$/.test(expectedRevision))
  fail('expected_registry_revision_required');
 const before=await context(project,runtime);
 if(before.selected.revision!==expectedRevision)fail('registry_revision_conflict');
 if(before.active)fail('factory_anchor_already_active');
 if(before.reserved)fail('factory_anchor_port_reserved');
 if(before.missing.length)fail('factory_anchor_permission_not_approved');
 const payload=await packDir(join(before.root,'packages/factory_anchor'));
 if(payload.id!==factory||payload.version!==before.m.version)
  fail('factory_anchor_package_mismatch');
 const envelope=seal(payload,before.owner);
 const trust={[before.owner.id]:{
  publicKey:before.owner.publicKey,receive:true,activate:true
 }};
 trustEnvelope(envelope,trust);
 const noChange=await current(before.dir);
 if(noChange.revision!==expectedRevision)fail('registry_changed_before_stage');
 const stored=await receive(before.dir,envelope,trust);
 const verified=trustEnvelope(await readEnvelope(before.dir,envelope.hash),trust);
 if(verified.manifest.id!==factory)fail('signed_package_readback_failed');
 const plan=await planActivation(before.root,before.dir,envelope.hash);
 if(plan.expected_revision!==expectedRevision)fail('plan_revision_conflict');
 const after=await current(before.dir);
 if(after.revision!==expectedRevision||
   after.apps.some(x=>x.id===factory))
  fail('activation_changed_during_stage');
 return {
  schema:'adamantium.factory_anchor.lifecycle-stage/1',
  app:factory,version:before.m.version,state:'signed_staged_unactivated',
  digest:envelope.hash,signatureVerified:true,originPublicKeyVerified:true,
  packageBytes:verified.bytes,registryRevision:expectedRevision,
  activationPlanId:plan.plan_id,activationPlan:plan,
  storedAlready:stored.already===true,
  active:false,productionServiceStarted:false,
  signingKeyExposed:false,corePolicyEdited:false,
  grantsMasCapabilities:false,needsExplicitActivationApproval:true
 };
}
export async function inspectFactoryStage(project,runtime,digest){
 const ctx=await context(project,runtime);
 const envelope=await readEnvelope(ctx.dir,digest);
 if(envelope?.origin!==ctx.owner.id)fail('not_owner_signed');
 const trust={[ctx.owner.id]:{
  publicKey:ctx.owner.publicKey,receive:true,activate:true
 }};
 const proof=trustEnvelope(envelope,trust);
 if(proof.manifest.id!==factory)fail('untrusted_factory_stage');
 const selected=await current(ctx.dir);
 const active=selected.apps.some(x=>x.id===factory&&x.hash===digest);
 let plan=null;
 if(!active)plan=await planActivation(ctx.root,ctx.dir,digest);
 return {
  schema:'adamantium.factory_anchor.lifecycle-stage/1',
  app:factory,version:proof.manifest.version,
  state:active?'selected':'signed_staged_unactivated',
  digest,signatureVerified:true,packageBytes:proof.bytes,
  active,activationPlanId:plan?.plan_id??null,
  registryRevision:selected.revision,
  productionServiceStarted:false,grantsMasCapabilities:false,
  needsExplicitActivationApproval:!active,
  ownerPrivateKeyReturned:false
 };
}
