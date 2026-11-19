import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBackend} from '../lib/backend.mjs';
import {snapshotHash,digest} from '../lib/contract.mjs';
test('guarded live peer add is verified, append-only audited, never retried',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wg-peer-'));
 const journal=join(dir,'enroll.jsonl'),pub=randomBytes(32).toString('base64');
 let value='',commands=[];
 const runner=async(_binary,args)=>{
  commands.push(args);
  if(args[0]==='show')return {stdout:value};
  if(args[0]==='set'&&args[2]==='peer'){
   if(args.includes('remove'))value='';
   else value=pub+'\t10.222.33.4/32\n';
   return {stdout:''};
  }
  throw Error('unsupported');
 };
 const backend=createBackend({binary:'not-executed',journal,runner});
 const plan={schema:'network-wireguard-peer-plan-v1',operation:'add',interface:'wg0',
  peerPublicKey:pub,allowedIP:'10.222.33.4/32',expiresAt:Date.now()+90000,
  nonce:randomBytes(24).toString('base64url'),expectedState:snapshotHash([])};
 try{
  const result=await backend.commit(plan);
  assert.equal(result.verified,true);
  assert.equal(result.persistent,false);
  assert.equal(result.operationId,digest(plan));
  assert.equal((await backend.state('wg0'))[0].publicKey,pub);
  await assert.rejects(()=>backend.commit(plan),/operation_replayed/);
  assert.equal(commands.filter(x=>x[0]==='set').length,1);
  const log=await readFile(journal,'utf8');
  assert.equal(log.split('\n').filter(Boolean).length,2);
  assert(!log.includes(pub));
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('stale snapshot rejected inside lock before any wg mutation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wg-peer-stale-')),pub=randomBytes(32).toString('base64');
 let writes=0;
 const backend=createBackend({journal:join(dir,'log'),runner:async(_bin,args)=>{
  if(args[0]==='set')writes++;
  return {stdout:args[0]==='show'?pub+'\t10.222.33.4/32\n':''};
 }});
 try{
  await assert.rejects(()=>backend.commit({operation:'add',interface:'wg0',peerPublicKey:pub,
   allowedIP:'10.222.33.5/32',expectedState:snapshotHash([]),nonce:'a',
   expiresAt:Date.now()+60000}),/stale_state/);
  assert.equal(writes,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});
