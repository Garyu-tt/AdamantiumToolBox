import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=await mkdtemp(join(tmpdir(),'mas-interrupt-'));
try{
 process.env.ADA_APP_DATA_DIR=join(root,'chat_store');
 const {invoke:chat}=await import('../apps/chat_store/journal.mjs');
 const created=await chat('chat_store.create',{opId:'create',title:'Concurrent conversation'});
 const thread=created.thread;
 const saved=await Promise.all(Array.from({length:20},(_,i)=>chat('chat_store.append',{
  thread,opId:'message-'+i,text:'message '+i,role:'user'})));
 assert.equal(saved.length,20);
 await assert.rejects(chat('chat_store.append',{thread,opId:'message-0',text:'tampered',role:'user'}),/op_conflict/);
 process.env.ADA_APP_DATA_DIR=join(root,'chat_turns');
 const {invoke:turns}=await import('../apps/chat_turns/ledger.mjs');
 const events=await Promise.all(saved.map((r,i)=>turns('chat_turns.register',{
  thread,sourceId:r.id,sourceSeq:r.seq,opId:'register-'+i})));
 assert.equal(events.length,20);
 assert.equal((await turns('chat_turns.status',{thread})).pending,20);
 const worker=await turns('chat_turns.claim',{thread,opId:'claim-1'});
 assert.equal(worker.inputs.length,20);
 await assert.rejects(turns('chat_turns.claim',{thread,opId:'claim-while-active'}),/turn_active/);
 const last=await chat('chat_store.append',{thread,opId:'message-20',text:'interrupt now',role:'user'});
 await turns('chat_turns.register',{thread,opId:'register-20',sourceId:last.id,sourceSeq:last.seq});
 assert.equal((await turns('chat_turns.status',{thread})).active.interruptRequested,true);
 await assert.rejects(turns('chat_turns.close',{thread,opId:'stale',turnId:worker.turnId,outcome:'completed'}),/stale_completion/);
 const stopped=await turns('chat_turns.close',{thread,opId:'stop-1',turnId:worker.turnId,outcome:'superseded'});
 assert.equal(stopped.state,'superseded');
 assert.equal((await turns('chat_turns.status',{thread})).pending,21);
 const replacement=await turns('chat_turns.claim',{thread,opId:'claim-2'});
 assert.equal(replacement.inputs.length,21);
 const complete=await turns('chat_turns.close',{thread,opId:'done-2',turnId:replacement.turnId,outcome:'completed'});
 assert.equal(complete.state,'completed');
 const done=await turns('chat_turns.status',{thread});assert.equal(done.pending,0);assert.equal(done.completed,21);
 assert.equal((await turns('chat_turns.close',{thread,opId:'done-2',turnId:replacement.turnId,outcome:'completed'})).replayed,true);
 await assert.rejects(turns('chat_turns.close',{thread,opId:'done-2',turnId:replacement.turnId,outcome:'failed'}),/op_conflict/);
 const late=await turns('chat_turns.register',{thread,opId:'late',sourceId:'late-source',sourceSeq:1});
 await assert.rejects(turns('chat_turns.register',{thread,opId:'conflicting-source',sourceId:'late-source',sourceSeq:2}),/source_conflict/);
 assert.equal((await turns('chat_turns.status',{thread})).pending,1);
 assert.equal(late.registered,true);
 const {invoke:restarted}=await import('../apps/chat_turns/ledger.mjs?reload=1');
 assert.equal((await restarted('chat_turns.status',{thread})).pending,1);
 process.env.ADA_APP_DATA_DIR=join(root,'chat_context');
 const {invoke:context}=await import('../apps/chat_context/checkpoints.mjs');
 assert.equal((await context('chat_context.due',{thread,messageCount:9})).due,false);
 assert.equal((await context('chat_context.due',{thread,messageCount:10})).due,true);
 const params={thread,opId:'checkpoint-1',sourceCount:10,summary:'Decisions: retain MAS isolation.',
  producer:'test-adapter',sourceRefs:saved.slice(0,10).map(x=>x.id)};
 const first=await context('chat_context.save',params);
 assert.equal(first.version,1);
 assert.equal((await context('chat_context.save',params)).replayed,true);
 await assert.rejects(context('chat_context.save',{...params,summary:'different'}),/op_conflict/);
 assert.equal((await context('chat_context.due',{thread,messageCount:19})).due,false);
 assert.equal((await context('chat_context.due',{thread,messageCount:20})).due,true);
 await assert.rejects(context('chat_context.save',{...params,opId:'old',sourceCount:9}),/invalid_source_count/);
 const second=await context('chat_context.save',{...params,opId:'checkpoint-2',sourceCount:21,
  summary:'New version with all the user interruptions.',sourceRefs:[last.id]});
 assert.equal(second.version,2);
 const loaded=await context('chat_context.read',{thread});
 assert.equal(loaded.latest.summary,'New version with all the user interruptions.');
 assert.equal(loaded.history.length,2);
 const stored=(await readFile(join(root,'chat_store','events.jsonl'),'utf8')).trim().split('\n');
 assert.equal(stored.length,22);
 console.log('CONVERSATION_INTERRUPTS_OK 21 durable messages, concurrent intake, interruption, supersession, replay, checkpoint, restart');
}finally{await rm(root,{recursive:true,force:true});}
