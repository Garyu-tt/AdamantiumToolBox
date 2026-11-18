import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadModules} from '../core/modules/runtime.mjs';
const root=resolve(fileURLToPath(new URL('../apps/database/modules/',import.meta.url)));
const dir=await mkdtemp(join(tmpdir(),'mas-recursive-'));
try{
 let r=await loadModules(root,{context:{dataDir:dir},policy:{indexing:false}});
 assert(r.actions.has('database.query'));assert(!r.actions.has('database.subjects'));
 assert(r.status.some(m=>m.name==='indexing'&&m.state==='disabled'));
 assert(r.status.some(m=>m.name==='storage.journal'&&m.state==='active'));
 assert(r.status.some(m=>m.name==='replication'&&m.state==='disabled'));
 await r.services.get('storage.graph.store').close();
 r=await loadModules(root,{context:{dataDir:dir}});
 assert(r.actions.has('database.subjects'));
 assert(r.status.some(m=>m.name==='indexing.subjects'&&m.state==='active'));
 assert.deepEqual(r.actions.get('database.subjects').run({namespace:'empty'}).subjects,[]);
 await r.services.get('storage.graph.store').close();
 console.log('MODULES_R01_OK recursive-activation-conditional-visibility-capability-resolution');
}finally{await rm(dir,{recursive:true,force:true});}
