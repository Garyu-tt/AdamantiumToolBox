import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=await mkdtemp(join(tmpdir(),'mas-chat-'));
const dir=new URL('../apps/',import.meta.url);
const delay=t=>new Promise(ok=>setTimeout(ok,t));
async function check(id){
 const file=new URL(id+'/service.mjs',dir);
 const manifest=JSON.parse(await readFile(new URL(id+'/manifest.json',dir),'utf8'));
 assert.equal(manifest.lifecycle,'independent');assert.equal(manifest.mas,'1.0');
 assert.equal(manifest.service.protocol,'mas-http-1');
 assert(await readFile(new URL(id+'/view.js',dir),'utf8'));
 assert((await readFile(file,'utf8')).includes("'/graph'"));
}
try{
 for(const id of ['chat_store','chat_threads','chat_messages','chat_composer',
  'chat_folders','chat_mcp','chat_workspace'])await check(id);
 process.env.ADA_APP_DATA_DIR=join(root,'journal');
 const {invoke:chat}=await import('../apps/chat_store/journal.mjs');
 const op='op-1',created=await chat('chat_store.create',{title:'Test',opId:op});
 const replay=await chat('chat_store.create',{title:'Test',opId:op});
 assert.equal(created.thread,replay.thread);assert.equal(replay.replayed,true);
 const writes=await Promise.all(Array.from({length:20},(_,i)=>chat('chat_store.append',{
  thread:created.thread,text:'message '+i,role:'user',opId:'msg-'+i})));
 assert.equal(new Set(writes.map(w=>w.seq)).size,20);
 const read=await chat('chat_store.read',{thread:created.thread});
 assert.equal(read.messages.length,20);
 assert.equal((await chat('chat_store.list')).threads[0].count,20);
 assert((await readFile(join(root,'journal','events.jsonl'),'utf8')).split('\n').length>=22);
 await assert.rejects(chat('chat_store.append',{thread:'missing',role:'user',text:'oops',opId:'bad'}),/thread_not_found/);
 process.env.ADA_APP_DATA_DIR=join(root,'folders');
 const {invoke:folders}=await import('../apps/chat_folders/store.mjs');
 const folder=await folders('chat_folders.create',{name:'Projects',opId:'folder-op'});
 await folders('chat_folders.link',{folder:folder.id,ref:'mas://chat_store/thread/'+created.thread,opId:'link-op'});
 assert.equal((await folders('chat_folders.list')).folders[0].items.length,1);
 const view=await readFile(new URL('chat_workspace/view.js',dir),'utf8');
 assert(view.includes('mas-composite-view-1')&&view.includes('composition.surface'));
 console.log('CONVERSATION_HUB_OK isolated manifests, journal durability, idempotency, concurrency, folder links, composition');
}finally{await delay(10);await rm(root,{recursive:true,force:true});}
