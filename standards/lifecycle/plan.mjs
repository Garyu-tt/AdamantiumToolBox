import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {catalog} from '../../core/catalog.mjs';
import {current} from './registry.mjs';
import {identity,trustEnvelope} from '../mesh/identity.mjs';
import {readEnvelope} from '../mesh/store.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const semver=v=>v.split('.').map(Number);
export async function trust(runtime){
 const owner=await identity(join(runtime,'mesh'));
 let remote={};
 try{remote=JSON.parse((await readFile(join(runtime,'mesh','trust.json'),'utf8')).replace(/^\uFEFF/,''));}
 catch(e){if(e.code!=='ENOENT')throw e;}
 return {...remote,[owner.id]:{publicKey:owner.publicKey,receive:true,activate:true}};
}
export async function planActivation(project,runtime,packageHash){
 if(typeof packageHash!=='string'||!/^[0-9a-f]{64}$/.test(packageHash))throw Error('invalid_hash');
 const envelope=await readEnvelope(runtime,packageHash);
 const {manifest:m,rule,bytes}=trustEnvelope(envelope,await trust(runtime));
 if(!rule.activate)throw Error('activation_not_trusted');
 if(m.updates.migrations.length)throw Error('migrations_not_supported');
 const owner=JSON.parse((await readFile(join(runtime,'policy.json'),'utf8').catch(()=>'{ }')).replace(/^\uFEFF/,''));
 if(owner.schema!=='mas-owner-policy-1'||!Array.isArray(owner.capabilities))throw Error('missing_owner_policy');
 if(!m.permissions.every(p=>owner.capabilities.includes(p)))throw Error('missing_permission_approval');
 const installed=await catalog(project),prior=await current(runtime);
 if(installed.some(a=>a.id===m.id&&a.source==='bundled'))throw Error('bundled_app_reserved');
 if(installed.some(a=>a.id!==m.id&&a.service.port===m.service.port))throw Error('port_reserved');
 const old=prior.apps.find(x=>x.id===m.id);
 if(old?.hash===packageHash)throw Error('already_active');
 const previous=installed.find(a=>a.id===m.id);
 if(old&&!previous)throw Error('previous_install_invalid');
 if(previous){
  const before=semver(previous.version),after=semver(m.version);
  if(after[0]!==before[0])throw Error('major_upgrade_requires_review');
  if(after.every((x,i)=>x===before[i]))throw Error('same_version_different_package');
  const newer=after.findIndex((x,i)=>x!==before[i]);
  if(newer<0||after[newer]<before[newer])throw Error('version_downgrade');
 }
 const payload={schema:'mas-activation-plan-1',id:m.id,hash:packageHash,version:m.version,
  port:m.service.port,bytes,previous:old?.hash||null,expected_revision:prior.revision,
  checks:['ed25519_signature','mas_contract','permissions','port_unique','version_compatible','no_migrations']};
 return {...payload,plan_id:hash(payload)};
}
