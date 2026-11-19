import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const paths=['contracts/mikoshi-av-permit.mjs',
 'apps/mikoshi_sourcepolicy/permit.mjs',
 'apps/mikoshi_motifs/permit.mjs',
 'apps/mikoshi_grounding/permit.mjs'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=await Promise.all(paths.map(p=>readFile(new URL(p,root))));
assert.equal(new Set(files.map(hash)).size,1,
 'all independently bundled permit contracts must match the canonical protocol');
for(const name of ['mikoshi_sourcepolicy','mikoshi_motifs','mikoshi_grounding']){
 const path=name==='mikoshi_sourcepolicy'?'policy.mjs':'service.mjs';
 const text=await readFile(new URL('apps/'+name+'/'+path,root),'utf8');
 assert(text.includes("from './permit.mjs'"));
 assert(!text.includes("../../contracts/"),
  'standalone provider must not import files outside its app');
}
console.log('MIKOSHI_PERMIT_CONTRACT_OK three isolated MAS copies match source protocol');
