import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {catalog} from '../core/catalog.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const home=process.env.LOCALAPPDATA;
if(!home)throw Error('LOCALAPPDATA required');
const file=join(home,'Adamantium Toolbox','policy.json');
const [action,id,confirm]=process.argv.slice(2);
async function main(){
 if(!/^[a-z][a-z0-9_-]{1,39}$/.test(id||''))throw Error('invalid_app_id');
 const app=(await catalog(root)).find(x=>x.id===id);
 if(!app)throw Error('app_not_registered');
 const policy=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
 if(policy.schema!=='mas-owner-policy-1'||!Array.isArray(policy.capabilities))
  throw Error('invalid_owner_policy');
 const granted=new Set(policy.capabilities);
 const missing=app.permissions.filter(x=>!granted.has(x));
 if(action==='inspect')return {app:id,required:app.permissions,missing,approved:missing.length===0};
 if(action!=='grant'||confirm!=='--approve')throw Error('explicit_approval_required');
 if(!missing.length)return {app:id,alreadyApproved:true,granted:[]};
 for(const permission of missing)granted.add(permission);
 const next={...policy,capabilities:[...granted]};
 const temporary=file+'.'+randomUUID()+'.tmp';
 try{
  await writeFile(temporary,JSON.stringify(next,null,2),{flag:'wx'});
  await rename(temporary,file);
 }finally{await rm(temporary,{force:true});}
 return {app:id,granted:missing,restartRequired:true};
}
try{console.log(JSON.stringify(await main(),null,2));}
catch(e){console.error('OWNER_POLICY_ERROR '+e.message);process.exitCode=1;}
