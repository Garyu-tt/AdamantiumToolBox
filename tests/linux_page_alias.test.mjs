import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
if(process.platform!=='linux'){
 console.log('DRAM_MEMFD_SKIPPED non-linux host');
 process.exit(0);
}
const compiler=spawnSync('cc',['--version'],{encoding:'utf8'});
if(compiler.error?.code==='ENOENT'){
 console.log('DRAM_MEMFD_SKIPPED no C compiler');
 process.exit(0);
}
assert.equal(compiler.status,0,'compiler must launch cleanly');
const dir=await mkdtemp(join(tmpdir(),'dram-probe-'));
try{
 const exe=join(dir,'alias');
 const source=resolve(dirname(fileURLToPath(import.meta.url)),'../experiments/dram/memfd-alias.c');
 const built=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror',source,'-o',exe],{encoding:'utf8'});
 assert.equal(built.status,0,built.stderr);
 const run=spawnSync(exe,[],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 assert.match(run.stdout,/DRAM_MEMFD_OK/);
 console.log(run.stdout.trim());
}finally{await rm(dir,{recursive:true,force:true});}
