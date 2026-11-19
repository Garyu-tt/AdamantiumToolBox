import {readFile} from 'node:fs/promises';
const p=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url)));
const excluded=new Set(['rete-structures','rete-scopes-plugin','rete-studio']);
const allowed=new Set(['MIT','ISC','Apache-2.0','BSD-2-Clause',
  'BSD-3-Clause','0BSD','CC0-1.0','Unlicense','Unicode-3.0']);
for(const [path,metadata] of Object.entries(lock.packages||{})){
  if(!path)continue;
  const name=path.split('node_modules/').at(-1);
  if(excluded.has(name))throw Error('noncommercial_rete_dependency:'+name);
  const license=metadata.license;
  if(!license || !allowed.has(license))
    throw Error('unreviewed_dependency_license:'+name+':'+(license||'?'));
}
for(const name of Object.keys({...p.dependencies,...p.devDependencies})){
  if(excluded.has(name))throw Error('forbidden_direct_dependency:'+name);
}
console.log('RETE_LICENSE_GATE_OK: lockfile metadata checked for all packages');
