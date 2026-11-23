import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalog} from '../core/catalog.mjs';
import {validateManifest} from '../core/contract.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const apps=await catalog(root),errors=[];
for(const app of apps){
 const dir=resolve(root,'apps',app.id);
 if(!validateManifest(app))errors.push(app.id+':invalid_manifest');
 for(const name of (app.ui?.mode==='headless'?['service.mjs']:['service.mjs','view.js'])){
  try{if(!(await stat(resolve(dir,name))).isFile())errors.push(app.id+':bad_'+name);}
  catch{errors.push(app.id+':missing_'+name);}
 }
 if(app.ui?.mode!=='headless'){
  try{await stat(resolve(root,'icons',app.icon+'.ico'));}
  catch{errors.push(app.id+':missing_icon');}
 }
 const source=await readFile(resolve(dir,'service.mjs'),'utf8').catch(()=>'');
 if(!source.includes("'/graph'"))errors.push(app.id+':missing_graph_route');
}
if(errors.length){console.error(errors.join('\n'));process.exit(2);}
console.log('MAS_CONTRACT_OK',apps.map(a=>a.id).join(',')||'empty');
