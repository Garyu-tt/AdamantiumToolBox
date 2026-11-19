import {strict as assert} from 'node:assert';
import {readFile,mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {loadModules} from '../core/modules/runtime.mjs';
import {catalog} from '../core/catalog.mjs';
const root=resolve(fileURLToPath(new URL('../apps/noosphere/modules/',import.meta.url)));
const good={
 id:'event-01',type:'memory.event',schema_version:1,payload_ref:'blob-ref-01',
 content_hash:'a'.repeat(64),source:{system:'legacy-noosphere',original_id:'old-01'},
 observed_at:'2026-11-18T12:00:00Z',recorded_at:'2026-11-18T12:01:00Z',
 updated_at:'2026-11-18T12:02:00Z',valid_from:null,valid_to:null
};
const r=await loadModules(root);
assert(r.actions.has('noosphere.validate'));
assert(r.status.some(x=>x.name==='memory.envelope'&&x.state==='active'));
assert(r.status.some(x=>x.name==='ingestion.provenance'&&x.state==='active'));
const validate=p=>r.actions.get('noosphere.validate').run({envelope:p});
assert.deepEqual(validate(good),{schema:'noosphere-envelope-v1',valid:true,issues:[]});
assert(validate({...good,content_hash:'oops'}).issues.includes('invalid_content_hash'));
assert(validate({...good,source:{}}).issues.includes('invalid_source_system'));
assert(validate({...good,recorded_at:'invalid'}).issues.includes('invalid_recorded_at'));
assert(validate({...good,updated_at:'2026-11-18T11:00:00Z'}).issues.includes('updated_before_recorded'));
assert(validate({...good,valid_from:'2027-01-01T00:00:00Z',
 valid_to:'2026-01-01T00:00:00Z'}).issues.includes('invalid_valid_interval'));
assert(!validate({}).valid);
const off=await loadModules(root,{policy:{ingestion:false}});
assert(!off.actions.has('noosphere.validate'));
assert(off.status.some(x=>x.name==='memory.envelope'&&x.state==='blocked'));
const folder=await mkdtemp(join(tmpdir(),'noosphere-core-only-'));
try{
 await mkdir(join(folder,'apps','noosphere'),{recursive:true});
 const manifest=await readFile(resolve(root,'../manifest.json'),'utf8');
 await writeFile(join(folder,'apps','noosphere','manifest.json'),manifest);
 const plugins=await catalog(folder);
 assert.deepEqual(plugins.map(x=>x.id),['noosphere']);
}finally{await rm(folder,{recursive:true,force:true});}
console.log('NOOSPHERE_R03_OK stateless-envelope-temporal-provenance-recursion-core-only');
