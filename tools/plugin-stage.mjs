import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {existingIdentity} from '../core/node_identity.mjs';
import {packDir} from '../standards/mesh/bundle.mjs';
import {seal} from '../standards/mesh/identity.mjs';
import {receive} from '../standards/mesh/store.mjs';
import {planActivation} from '../standards/lifecycle/plan.mjs';
import {activate} from '../standards/lifecycle/apply.mjs';
import {current} from '../standards/lifecycle/registry.mjs';
import {catalog} from '../core/catalog.mjs';
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const [mode,source,...options]=process.argv.slice(2);
async function main(){
 if(!['prepare','install'].includes(mode)||!source)
  return {usage:['node tools/plugin-stage.mjs prepare <plugin-source>',
   'node tools/plugin-stage.mjs install <plugin-source> --approve']};
 if(mode==='install'&&!options.includes('--approve'))throw Error('explicit_approval_required');
 if(options.some(x=>x!=='--approve')||(mode==='prepare'&&options.length))
  throw Error('unsupported_option');
 const home=process.env.LOCALAPPDATA;if(!home)throw Error('LOCALAPPDATA_required');
 const runtime=join(home,'Adamantium Toolbox');
 const owner=await existingIdentity(join(runtime,'mesh'));
 const envelope=seal(await packDir(resolve(source)),owner);
 const installed=await current(runtime);
 if(installed.apps.some(x=>x.id===envelope.payload.id&&x.hash===envelope.hash))
  return {state:'already_active',app:envelope.payload.id,hash:envelope.hash};
 await receive(runtime,envelope,{[owner.id]:{publicKey:owner.publicKey,receive:true}});
 const plan=await planActivation(project,runtime,envelope.hash);
 if(mode==='prepare')return {state:'plan_ready',app:plan.id,hash:plan.hash,plan,
  note:'signed_and_stored_only_no_execution'};
 const result=await activate(project,runtime,plan,true);
 const selected=(await catalog(project)).find(x=>x.id===result.app);
 if(!selected||selected.source!=='plugin'||selected.hash!==result.hash)
  throw Error('catalog_readback_failed');
 return {...result,catalog:'verified',execution:'supervisor_discovers_next_poll'};
}
try{console.log(JSON.stringify(await main(),null,2));}
catch(e){console.error('PLUGIN_STAGE_ERROR '+String(e.message).slice(0,160));process.exitCode=1;}
