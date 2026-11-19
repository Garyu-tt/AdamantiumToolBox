import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
if(process.platform!=='linux'){
 console.log('DVRAM_CUDA_PROBE_SKIPPED non-linux host');process.exit(0);
}
const cc=spawnSync('cc',['--version'],{encoding:'utf8'});
if(cc.error?.code==='ENOENT'){
 console.log('DVRAM_CUDA_PROBE_SKIPPED no compiler');process.exit(0);
}
assert.equal(cc.status,0);
const dir=await mkdtemp(join(tmpdir(),'dvram-cuda-'));
try{
 const exe=join(dir,'probe');
 const source=resolve(dirname(fileURLToPath(import.meta.url)),'../experiments/dvram-cuda-probe.c');
 const build=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror',source,'-ldl','-o',exe],{encoding:'utf8'});
 assert.equal(build.status,0,build.stderr);
 const passive=spawnSync(exe,[],{encoding:'utf8',timeout:5000});
 assert.equal(passive.status,0,passive.stderr);
 const guard=JSON.parse(passive.stdout);
 assert.equal(guard.status,'opt_in_required');
 assert.equal(guard.changes,false);
 const active=spawnSync(exe,['--probe'],{encoding:'utf8',timeout:5000});
 assert.equal(active.status,0,active.stderr);
 const data=JSON.parse(active.stdout);
 assert.equal(data.schema,'dvram-cuda-capabilities-1');
 assert.equal(data.changes,false);
 assert(Array.isArray(data.devices));
 if(data.status==='ok')assert(data.devices.length>0);
 if(data.status==='cuda_driver_not_found')assert.equal(data.probed,false);
 console.log('DVRAM_CUDA_PROBE_OK',data.status,data.device_count??0);
}finally{await rm(dir,{recursive:true,force:true});}
