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
  return {usage:['node tools/plugin-stage.mjs prepare <source> [--port=NNNN]',
   'node tools/plugin-stage.mjs install <source> --approve [--port=NNNN]']};
 const approved=options.includes('--approve'),ports=options.filter(x=>x.startsWith('--port='));
 if((mode==='install'&&!approved)||(mode==='prepare'&&approved))
  throw Error('explicit_approval_required');
 if(ports.length>1||options.filter(x=>x==='--approve').length>1||
  options.some(x=>x!=='--approve'&&!/^--port=\d{4,5}$/.test(x)))
  throw Error('unsupported_option');
 const requested=ports.length?Number(ports[0].slice(7)):null;
 if(requested!==null&&(requested<1024||requested>65535))throw Error('invalid_port');
 const home=process.env.LOCALAPPDATA;if(!home)throw Error('LOCALAPPDATA_required');
 const runtime=join(home,'Adamantium Toolbox'),owner=await existingIdentity(join(runtime,'mesh'));
 const payload=await packDir(resolve(source));
 const manifest=JSON.parse(Buffer.from(payload.files['manifest.json'],'base64').toString('utf8'));
 const previous=(await catalog(project)).find(x=>x.id===payload.id);
 const port=requested??(previous?.source==='plugin'?previous.service.port:null)??manifest.service.port;
 if(port!==manifest.service.port){
  manifest.service.port=port;
  payload.files['manifest.json']=Buffer.from(JSON.stringify(manifest)).toString('base64');
 }
 const envelope=seal(payload,owner);
 const installed=await current(runtime);
 if(installed.apps.some(x=>x.id===payload.id&&x.hash===envelope.hash))
  return {state:'already_active',app:payload.id,hash:envelope.hash,port};
 await receive(runtime,envelope,{[owner.id]:{publicKey:owner.publicKey,receive:true}});
 const plan=await planActivation(project,runtime,envelope.hash);
 if(mode==='prepare')return {state:'plan_ready',app:plan.id,hash:plan.hash,plan,
  note:'signed_and_stored_only_no_execution'};
 const result=await activate(project,runtime,plan,true);
 const selected=(await catalog(project)).find(x=>x.id===result.app);
 if(!selected||selected.source!=='plugin'||selected.hash!==result.hash)
  throw Error('catalog_readback_failed');
 return {...result,port:selected.service.port,catalog:'verified',
  execution:'supervisor_discovers_next_poll'};
}
try{console.log(JSON.stringify(await main(),null,2));}
catch(e){console.error('PLUGIN_STAGE_ERROR '+String(e.message).slice(0,160));process.exitCode=1;}
