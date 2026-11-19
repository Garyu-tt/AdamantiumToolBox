import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomBytes} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {appendManaged} from '../lib/managed.mjs';
import {snapshotHash} from '../lib/contract.mjs';
const script=fileURLToPath(new URL('../tools/restore.mjs',import.meta.url));
const key=()=>randomBytes(32).toString('base64');
test('boot restore requires opt-in, replays a proven peer and blocks ambiguous attempts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wg-restore-test-'));
 const ledger=join(dir,'managed.jsonl'),journal=join(dir,'attempts.jsonl'),signerFile=join(dir,'signers.json');
 const wg=join(dir,'wg-mock'),state=join(dir,'wg-state.txt'),pub=key();
 const cfg={interface:'wg0',pool:'10.223.44.0/24'};
 const plan={schema:'network-wireguard-peer-plan-v1',operation:'add',interface:cfg.interface,
  peerPublicKey:pub,allowedIP:'10.223.44.8/32',expiresAt:Date.now()+100000,
  nonce:randomBytes(24).toString('base64url'),expectedState:snapshotHash([])};
 const a=generateKeyPairSync('ed25519'),b=generateKeyPairSync('ed25519');
 const trust={sourcePublicKeyPem:a.publicKey.export({format:'pem',type:'spki'}),
  destinationPublicKeyPem:b.publicKey.export({format:'pem',type:'spki'})};
 const msg=Buffer.from(JSON.stringify(plan));
 const proofs={source:sign(null,msg,a.privateKey).toString('base64'),destination:sign(null,msg,b.privateKey).toString('base64')};
 const mock="#!/usr/bin/env node\n"+
  "const fs=require('node:fs');const a=process.argv.slice(2),f=process.env.TEST_WG_STATE;"+
  "if(a[0]==='show'){try{process.stdout.write(fs.readFileSync(f,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}}"+
  "else if(a[0]==='set'){fs.writeFileSync(f,a[3]+'\\t'+a[5]+'\\n')}else process.exit(2);\n";
 try{
  await appendManaged(ledger,plan,proofs,trust,cfg);
  await writeFile(signerFile,JSON.stringify(trust));
  await writeFile(wg,mock);await chmod(wg,0o700);
  const env={...process.env,NETWORK_WG_IFACE:'wg0',NETWORK_WG_POOL:cfg.pool,
   NETWORK_WG_MANAGED_LEDGER:ledger,NETWORK_WG_JOURNAL:journal,NETWORK_WG_SIGNERS_FILE:signerFile,
   NETWORK_WG_SERVER_IP:'10.223.44.1',NETWORK_WG_BIN:wg,TEST_WG_STATE:state};
  const run=(mode,allow)=>spawnSync(process.execPath,[script,mode],{env:{...env,NETWORK_WG_RESTORE_ENABLED:allow?'1':'0'},encoding:'utf8',timeout:8000});
  const preview=run('--preview',false);
  assert.equal(preview.status,0,preview.stderr);
  assert.equal(JSON.parse(preview.stdout).toRestore,1);
  assert.notEqual(run('--apply',false).status,0);
  const first=run('--apply',true);
  assert.equal(first.status,0,first.stderr);
  assert.equal(JSON.parse(first.stdout).restored,1);
  assert((await readFile(state,'utf8')).includes(pub));
  assert.equal(JSON.parse(run('--apply',true).stdout).restored,0);
  // Simulated interface reset: a previously verified run may restore again.
  await rm(state);
  const second=run('--apply',true);
  assert.equal(second.status,0,second.stderr);
  assert.equal(JSON.parse(second.stdout).restored,1);
  // An unmatched attempt remains blocked across reboot rather than retried.
  const records=(await readFile(journal,'utf8')).trim().split('\n').map(JSON.parse);
  const id=records.find(x=>x.id.startsWith('restore:')).id;
  await rm(state);
  await writeFile(journal,(await readFile(journal,'utf8'))+JSON.stringify({id,stage:'attempted',when:Date.now()})+'\n');
  const bad=run('--apply',true);
  assert.notEqual(bad.status,0);
  assert(bad.stderr.includes('restore_unverified_attempt'));
 }finally{await rm(dir,{recursive:true,force:true})}
});
