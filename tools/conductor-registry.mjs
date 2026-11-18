import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {scan} from './conductor-registry/scan.mjs';
import {normalize} from './conductor-registry/normalize.mjs';
import {reconcile} from './conductor-registry/reconcile.mjs';

function argsOf(argv){
 const result={};for(let i=0;i<argv.length;i++){
  if(!argv[i].startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('expected --key value');
  result[argv[i].slice(2)]=argv[++i];
 }return result;
}
async function fromFile(file){return JSON.parse(await readFile(resolve(file),'utf8'));}
export async function build(options){
 const root=resolve(options.root||process.cwd());
 const at=options.at||new Date().toISOString();
 if(!Number.isFinite(Date.parse(at)))throw Error('invalid_observed_at');
 const source={type:options['source-type']||'repository_checkout',ref:options.ref||null,uri:options.uri||null};
 if(!['repository_checkout','git_pr','archive_export','local_worktree'].includes(source.type))
  throw Error('invalid_source_type');
 const found=await scan(root,source);
 const normalized=normalize(found,at);
 const old=options.previous?await fromFile(options.previous):[];
 const previous=Array.isArray(old)?old:(old.records||[]);
 const observed=options.observations?await fromFile(options.observations):null;
 const previousObserved=options['previous-observations']?await fromFile(options['previous-observations']):null;
 const maxAge=options['max-age-minutes']!==undefined?Number(options['max-age-minutes'])*60000:null;
 if(maxAge!==null&&(!Number.isFinite(maxAge)||maxAge<0))throw Error('invalid_max_age');
 const compared=reconcile(normalized.records,previous,observed,previousObserved,at,maxAge);
 return {registry:{schema:'mechanicus-registry-1',observed_at:at,source:found.source,
  records:normalized.records,errors:normalized.errors},
  reconciliation:{schema:'mechanicus-reconciliation-1',observed_at:at,...compared}};
}
export async function main(argv){
 const options=argsOf(argv);
 const outputs=await build(options);
 const output=resolve(options.out||join(process.cwd(),'conductor-registry-output'));
 await mkdir(output,{recursive:true});
 await writeFile(join(output,'registry.json'),JSON.stringify(outputs.registry,null,2)+'\n');
 await writeFile(join(output,'reconciliation.json'),JSON.stringify(outputs.reconciliation,null,2)+'\n');
 console.log(JSON.stringify({out:output,records:outputs.registry.records.length,
  errors:outputs.registry.errors.length,conflicts:outputs.reconciliation.conflicts.length,
  changes:outputs.reconciliation.changes.length}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
}