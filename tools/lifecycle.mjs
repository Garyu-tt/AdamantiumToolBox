import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {current} from '../standards/lifecycle/registry.mjs';
import {planActivation} from '../standards/lifecycle/plan.mjs';
import {activate,rollback} from '../standards/lifecycle/apply.mjs';
import {inventory} from '../standards/mesh/store.mjs';
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const home=process.env.LOCALAPPDATA;
if(!home)throw Error('LOCALAPPDATA required for lifecycle');
const runtime=join(home,'Adamantium Toolbox');
const [cmd,arg,...options]=process.argv.slice(2);
async function execute(){
 if(cmd==='status')return {...await current(runtime),packages:await inventory(runtime)};
 if(cmd==='plan')return planActivation(project,runtime,arg);
 if(cmd==='activate'){
  if(!options.includes('--approve'))throw Error('explicit_approval_required');
  const plan=JSON.parse(await readFile(arg,'utf8'));
  return activate(project,runtime,plan,true);
 }
 if(cmd==='rollback')return rollback(project,runtime,arg,options.includes('--approve'));
 return {commands:['status','plan <package-hash>','activate <plan.json> --approve',
  'rollback <app-id> --approve'],
  warning:'--approve executes signed third-party code with your current OS permissions. No sandbox yet.'};
}
try{console.log(JSON.stringify(await execute(),null,2));}
catch(e){console.error('LIFECYCLE_ERROR '+String(e.message).slice(0,180));process.exitCode=1;}
