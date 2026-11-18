import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {serviceCatalog} from '../core/services.mjs';
const root=await mkdtemp(join(tmpdir(),'mas-services-'));
const put=async(id,entry,enabled=true)=>{
 await writeFile(join(root,'services',id+'.json'),
  JSON.stringify({schema:'mas-system-service-1',id,runtime:'node',entry,enabled}));
};
try{
 assert.deepEqual(await serviceCatalog(root),[]);
 await mkdir(join(root,'services'));
 await mkdir(join(root,'providers'));
 await writeFile(join(root,'providers','alpha.mjs'),'export const alpha=true');
 await writeFile(join(root,'providers','beta.mjs'),'export const beta=true');
 await put('alpha','providers/alpha.mjs');
 let found=await serviceCatalog(root);
 assert.equal(found.length,1);assert.equal(found[0].id,'alpha');
 await put('beta','providers/beta.mjs');
 found=await serviceCatalog(root);
 assert.deepEqual(found.map(s=>s.id),['alpha','beta']);
 await put('beta','providers/beta.mjs',false);
 assert.deepEqual((await serviceCatalog(root)).map(s=>s.id),['alpha']);
 await put('beta','../private.mjs',true);
 await assert.rejects(serviceCatalog(root),/invalid_service_manifest/);
 await put('beta','providers/missing.mjs',true);
 await assert.rejects(serviceCatalog(root));
 await put('beta','providers/beta.mjs',true);
 const broken={schema:'mas-system-service-1',id:'beta',runtime:'node',entry:'providers/beta.mjs',enabled:'yes'};
 await writeFile(join(root,'services','beta.json'),JSON.stringify(broken));
 await assert.rejects(serviceCatalog(root),/invalid_enabled_flag/);
 console.log('SERVICE_DISCOVERY_OK independent dynamic add disable path checks');
}finally{await rm(root,{recursive:true,force:true});}
