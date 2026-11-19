import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,rm,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {DurableQueue} from '../apps/dantesensory/queue.mjs';

const event=n=>({schema:'dante.sensory.event.v1',source:'world.mock',
 kind:'position',sequence:n,observedAtMs:n,payload:{position:n}});

test('SIGKILL during locked mutation leaves durable spool intact and refuses next writer',
 {skip:process.platform==='win32'?'SIGKILL semantics tested on POSIX':false,timeout:15000},
 async()=>{
  const dir=await mkdtemp(join(tmpdir(),'dante-crash-lock-'));
  const path=join(dir,'journal.json');
  let child;
  try{
   const initial=await new DurableQueue({path}).open();
   assert.equal((await initial.publish(event(0))).ok,true);
   const before=await readFile(path);
   const script=`
    import {DurableQueue} from ${JSON.stringify(new URL('../apps/dantesensory/queue.mjs',import.meta.url).href)};
    const q=await new DurableQueue({path:process.argv[1]}).open();
    q.store.save=async()=>{process.stdout.write('LOCK_HELD\\n');await new Promise(()=>{});};
    await q.publish({schema:'dante.sensory.event.v1',source:'world.mock',
     kind:'position',sequence:1,observedAtMs:1,payload:{position:1}});
   `;
   child=spawn(process.execPath,['--input-type=module','-e',script,path],
    {stdio:['ignore','pipe','pipe']});
   let output='';
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('writer_did_not_reach_locked_save')),8000);
    child.stdout.on('data',chunk=>{
     output+=chunk.toString();
     if(output.includes('LOCK_HELD')){clearTimeout(timer);resolve();}
    });
    child.once('error',e=>{clearTimeout(timer);reject(e);});
    child.once('exit',(code,signal)=>{
     clearTimeout(timer);reject(Error('writer_exited_before_lock: '+code+'/'+signal));
    });
   });
   child.kill('SIGKILL');
   const [code,signal]=await once(child,'exit');
   assert.equal(signal,'SIGKILL');
   assert.equal(code,null);
   await access(path+'.writer.lock');
   assert.deepEqual(await readFile(path),before);
   const other=await new DurableQueue({path}).open();
   assert.equal(other.peek().length,1);
   await assert.rejects(other.publish(event(2)),/journal_writer_locked/);
   assert.deepEqual(await readFile(path),before);
  }finally{
   if(child&&!child.killed){child.kill('SIGKILL');}
   await rm(dir,{recursive:true,force:true});
  }
 });
