import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {generateKeyPairSync,sign} from 'node:crypto';
import {Journal} from '../lib/journal.mjs';
import {prepare,message,revokeMessage} from '../lib/contract.mjs';

function setup(){
 const a=generateKeyPairSync('ed25519'),b=generateKeyPairSync('ed25519');
 const trust={schema:'network-approval-trust-v1',nodes:{
  alpha:{keyId:'one',publicKey:a.publicKey.export({type:'spki',format:'pem'}).toString()},
  beta:{keyId:'two',publicKey:b.publicKey.export({type:'spki',format:'pem'}).toString()}}};
 const flow={source:'alpha',destination:'beta',principal:'owner',protocol:'udp',port:51820};
 const request=prepare({flow,revision:'1',expiresAt:new Date(Date.now()+180000).toISOString()}).request;
 const proof=(side,kind='sign',reason)=>({side,keyId:side==='source'?'one':'two',
  signature:sign(null,kind==='revoke'?revokeMessage(request,side,reason):message(request,side),
  side==='source'?a.privateKey:b.privateKey).toString('base64')});
 return {trust,request,proof};
}
async function withJournal(fn){const tmp=await mkdtemp(join(tmpdir(),'network-approval-'));const path=join(tmp,'ledger.jsonl');let store;
 try{const f=setup();store=await new Journal(path,f.trust).start();return await fn({...f,path,store,tmp});}
 finally{await store?.close();await rm(tmp,{recursive:true,force:true});}}
const now=()=>new Date().toISOString();
test('persisted independent signers and replay survive restart',async()=>withJournal(async({trust,request,proof,path,store})=>{
 const one=await store.mutate({expectedRevision:store.head,event:{type:'propose',at:now(),request,proof:proof('source')}});
 assert.equal(one.record.state,'pending');assert.equal(one.seq,1);
 const two=await store.mutate({expectedRevision:one.revision,event:{type:'endorse',at:now(),id:request.id,proof:proof('destination')}});
 assert.equal(two.record.state,'bilaterally_signed');assert.equal(two.record.enforcement,false);
 await store.close();const reopened=await new Journal(path,trust).start();
 try{assert.equal(reopened.get(request.id).state,'bilaterally_signed');assert.equal(reopened.count,2);
  const three=await reopened.mutate({expectedRevision:reopened.head,event:{type:'revoke',at:now(),id:request.id,reason:'owner_withdrawal',proof:proof('source','revoke','owner_withdrawal')}});
  assert.equal(three.record.state,'revoked');assert.equal(three.seq,3);
  await assert.rejects(reopened.mutate({expectedRevision:reopened.head,event:{type:'endorse',at:now(),id:request.id,proof:proof('destination')}}),/already_revoked/);
 }finally{await reopened.close();}
}));
test('revision CAS rejects stale and ambiguous concurrent commits',async()=>withJournal(async({request,proof,store})=>{
 const before=store.head;const first={type:'propose',at:now(),request,proof:proof('source')};
 const [a,b]=await Promise.allSettled([store.mutate({expectedRevision:before,event:first}),store.mutate({expectedRevision:before,event:first})]);
 assert.equal(a.status,'fulfilled');assert.equal(b.status,'rejected');assert.match(b.reason.message,/revision_conflict/);
 assert.equal(store.count,1);
}));
test('unauthorized signature cannot add approval or revoke',async()=>withJournal(async({request,proof,store})=>{
 await store.mutate({expectedRevision:store.head,event:{type:'propose',at:now(),request,proof:proof('source')}});
 await assert.rejects(store.mutate({expectedRevision:store.head,event:{type:'endorse',at:now(),id:request.id,proof:proof('source')}}),/untrusted_destination/);
 await assert.rejects(store.mutate({expectedRevision:store.head,event:{type:'revoke',at:now(),id:request.id,reason:'policy_change',proof:proof('source')}}),/invalid_revocation/);
 assert.equal(store.get(request.id).state,'pending');assert.equal(store.count,1);
}));
test('tamper-evident log fails closed after content corruption',async()=>withJournal(async({request,proof,path,store})=>{
 await store.mutate({expectedRevision:store.head,event:{type:'propose',at:now(),request,proof:proof('source')}});
 const data=await readFile(path,'utf8');await writeFile(path,data.replace('owner','other'),{mode:0o600});
 await assert.rejects(store.reload(),/corrupt_journal/);
 await assert.rejects(store.mutate({expectedRevision:store.head,event:{type:'endorse',at:now(),id:request.id,proof:proof('destination')}}),/corrupt_journal/);
}));
test('second writer lock prevents parallel processes and releases on shutdown',async()=>withJournal(async({trust,path,store})=>{
 await assert.rejects(new Journal(path,trust).start(),/journal_already_locked/);
 await store.close();const second=await new Journal(path,trust).start();await second.close();
}));
test('unsafe world-readable existing ledger fails before lock creation',async()=>{
 const f=setup(),tmp=await mkdtemp(join(tmpdir(),'network-approval-mode-')),path=join(tmp,'ledger');
 try{await writeFile(path,'',{mode:0o600});await chmod(path,0o644);
  await assert.rejects(new Journal(path,f.trust).start(),/unsafe_journal_file/);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
test('truncated log is a hard error, not auto-recovered',async()=>withJournal(async({path,store})=>{
 await writeFile(path,'{"seq":1}',{mode:0o600});
 await assert.rejects(store.reload(),/truncated_journal/);
}));
