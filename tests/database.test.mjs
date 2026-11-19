import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../apps/database/store.mjs';
const root=await mkdtemp(join(tmpdir(),'mas-gfs-'));
const fact={uid:'f1',subject_uid:'a',relation_uid:'knows',object_uid:'b',valid_from:'2026-11-18',provenance:'test'};
const tx=(observed_seq,mutation_uid,operations)=>({namespace:'noosphere',observed_seq,mutation_uid,operations});
try{
 let db=await openStore(root);
 await assert.rejects(openStore(root),/writer_locked/);
 assert.deepEqual(db.query({namespace:'noosphere'}).facts,[]);
 const res=await db.transact(tx(0,'tx-1',[{kind:'ASSERT',fact}]));assert.equal(res.seq,1);
 await assert.rejects(db.transact(tx(0,'tx-conflict',[{kind:'RETRACT',uid:'f1'}])),/conflict/);
 await assert.rejects(db.transact(tx(1,'tx-bad',[{kind:'RETRACT',uid:'missing'}])),/missing_active_fact/);
 assert.equal(db.query({namespace:'other'}).facts.length,0);
 assert.equal(db.query({namespace:'noosphere'}).facts.length,1);
 await db.transact(tx(1,'tx-2',[{kind:'RETRACT',uid:'f1'}]));
 assert.equal(db.query({namespace:'noosphere'}).facts.length,0);
 assert.equal(db.query({namespace:'noosphere',at_seq:1}).facts.length,1);
 assert.equal(db.history({namespace:'noosphere'}).frames.length,2);
 await db.close();db=await openStore(root);
 assert.equal(db.status().seq,2);assert.equal(db.query({namespace:'noosphere',at_seq:1}).facts.length,1);
 await db.close();const file=join(root,'facts.ndjson'),text=await readFile(file,'utf8');
 await writeFile(file,text.replace('"knows"','"hates"'));
 await assert.rejects(openStore(root),/journal_integrity_failure/);
 console.log('DATABASE_R01_OK append-replay-conflict-history-integrity-isolation');
}finally{await rm(root,{recursive:true,force:true});}
