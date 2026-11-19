import {strict as assert} from 'node:assert';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseStoragePolicy} from '../apps/database/storage-policy.mjs';
import {openStore} from '../apps/database/store.mjs';
const defaults=parseStoragePolicy();
assert.equal(defaults.tier,'edge');
assert.equal(defaults.allowWrites,false);
assert.equal(defaults.maxBackups,0);
assert.equal(defaults.maxJournalBytes,16*1024*1024);
for(const p of [
 {schema:'mas-database-policy-1',tier:'edge',maxJournalBytes:65536,maxBackups:0,allowWrites:false},
 {schema:'mas-database-policy-1',tier:'edge',maxJournalBytes:1048576,maxBackups:2,allowWrites:false},
 {schema:'mas-database-policy-1',tier:'edge',maxJournalBytes:1024*1024*1024,maxBackups:1,allowWrites:false},
])assert.throws(()=>parseStoragePolicy(JSON.stringify(p)),/invalid_storage_policy|edge_quota_exceeded/);
const one=parseStoragePolicy(JSON.stringify({schema:'mas-database-policy-1',
 tier:'edge',maxJournalBytes:1048576,maxBackups:1,allowWrites:true}));
assert.equal(one.maxBackups,1);
const root=await mkdtemp(join(tmpdir(),'db-edge-'));
const fact=uid=>({uid,subject_uid:'object',relation_uid:'contains',typed_value:'y'.repeat(350)});
const tx=(seq,uid)=>({namespace:'edge',observed_seq:seq,mutation_uid:uid,
 operations:[{kind:'ASSERT',fact:fact(uid)}]});
try{
 let db=await openStore(root,defaults);
 await assert.rejects(db.transact(tx(0,'read-only')),/write_disabled/);
 assert.equal(db.status().usedBytes,0);
 await db.close();
 await assert.rejects(stat(join(root,'writer.lock')),/ENOENT/);
 await assert.rejects(stat(join(root,'facts.ndjson')),/ENOENT/);
 db=await openStore(root,{maxJournalBytes:800,allowWrites:true});
 await db.transact(tx(0,'small'));
 assert.equal(db.status().seq,1);
 await assert.rejects(db.transact(tx(1,'overflow')),/storage_quota_exceeded/);
 assert.equal(db.status().seq,1);
 assert((await stat(join(root,'facts.ndjson'))).size<=800);
 await db.close();
 await assert.rejects(openStore(root,{maxJournalBytes:100,allowWrites:false}),/journal_over_quota/);
 console.log('DATABASE_EDGE_OK no-writes-default zero-backup max-one strict-byte-quota');
}finally{await rm(root,{recursive:true,force:true});}
