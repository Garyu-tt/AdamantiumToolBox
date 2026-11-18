import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {capabilities,snapshot,inspect,restore} from '../standards/storage/darc.mjs';
import {discoverDarc} from '../standards/storage/darc-cli.mjs';
assert.equal(capabilities.randomAccess,false);
assert.equal(capabilities.inPlaceWrite,false);
await assert.rejects(snapshot({sources:[],destination:'none.darc'}),/invalid_sources/);
await assert.rejects(snapshot({sources:['x'],destination:'x.darc',profile:'typo'}),/invalid_compression_profile/);
let executable;
try{executable=await discoverDarc();}
catch(e){
 assert.equal(e.message,'deduparc_provider_unavailable');
 console.log('DARC_PROVIDER_SKIPPED optional_binary_unavailable');
 process.exit(0);
}
const root=await mkdtemp(join(tmpdir(),'darc-'));
try{
 const source=join(root,'tiny-files'),dest=join(root,'snapshot.darc'),out=join(root,'restored');
 await mkdir(source);
 const expected=new Map();
 for(let i=0;i<15;i++){
  const name='file'+i+'.txt',body='Repeated small block '+i%3+'\n'.repeat(60);
  expected.set(name,body);await writeFile(join(source,name),body);
 }
 const written=await snapshot({sources:[source],destination:dest,executable});
 assert.equal(written.verified,true);
 assert((await stat(dest)).size>0);
 assert((await inspect({archive:dest,operation:'list',executable})).output.length>0);
 const checked=await inspect({archive:dest,operation:'verify',executable});
 assert.equal(checked.verified,true);
 await assert.rejects(snapshot({sources:[source],destination:dest,executable}),/archive_exists/);
 const restored=await restore({archive:dest,destination:out,executable});
 assert.equal(restored.verified,true);
 const found=new Map();
 async function walk(dir){
  for(const ent of await readdir(dir,{withFileTypes:true})){
   const path=join(dir,ent.name);
   if(ent.isDirectory())await walk(path);
   else if(expected.has(ent.name))found.set(ent.name,await readFile(path,'utf8'));
  }
 }
 await walk(out);
 assert.deepEqual(found,expected);
 console.log('DARC_STORAGE_OK roundtrip verified',found.size,'small files');
}finally{await rm(root,{recursive:true,force:true});}
