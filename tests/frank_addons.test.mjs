import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {frankCatalog} from '../frank-addons/bridge/catalog.mjs';
import {validateFrankAddon} from '../frank-addons/bridge/contract.mjs';
const root=await mkdtemp(join(tmpdir(),'frank-addons-'));
const base=join(root,'frank-addons');
const make=async(language,id,extra={})=>{
 const dir=join(base,language,id);
 await mkdir(dir,{recursive:true});
 const m={schema:'frank-addon-1',language,id,name:id,version:'0.1.0',
  entry:'main.frank',adapter:'frankenstein.adapter.'+language,
  lifecycle:'independent',permissions:[],...extra};
 await writeFile(join(dir,'frank-addon.json'),JSON.stringify(m));
 await writeFile(join(dir,'main.frank'),'// fixture');
 return dir;
};
try{
 assert.deepEqual(await frankCatalog(root),[]);
 await make('python','hello');
 await make('rust','hello');
 await make('python','bad',{entry:'../outside'});
 await make('python','bad_cap',{adapter:'../../bin/sh'});
 const good=await make('python','escape',{entry:'linked.frank'});
 await symlink(join(root,'secret'),join(good,'linked.frank'));
 await mkdir(join(base,'python','no_manifest'),{recursive:true});
 const found=await frankCatalog(root);
 assert.deepEqual(found.map(x=>x.key),['frank.python.hello','frank.rust.hello']);
 assert(found.every(x=>x.source==='frank-addon'));
 assert(!validateFrankAddon({schema:'frank-addon-1'},'python','hello'));
 console.log('FRANK_ADDONS_DISCOVERY_OK language separation, invalid path, missing manifest');
}finally{await rm(root,{recursive:true,force:true});}
