import {strict as assert} from 'node:assert';
import {spawnSync} from 'node:child_process';
import {observeRuleset} from '../../apps/nftables_readback/observe.mjs';
const namespace=process.env.ADA_NFT_OBSERVE_NAMESPACE;
const ip=process.env.ADA_NFT_OBSERVE_IP,nft=process.env.ADA_NFT_OBSERVE_NFT;
assert(process.env.ADA_NFT_LAB_DISPOSABLE_ONLY==='1');
assert(/^ada-ci-[0-9]+-[0-9]+$/.test(namespace||''));
const run=(args)=>spawnSync(ip,['netns','exec',namespace,nft,...args],{
 encoding:'utf8',timeout:4000,shell:false});
const before=await observeRuleset();
assert.equal(before.status,'observed',JSON.stringify(before));
const table='ada_ci_observe_'+process.pid.toString(36);
let created=false;
try{
 const add=run(['add','table','inet',table]);
 assert.equal(add.status,0,add.stderr);
 created=true;
 const present=await observeRuleset();
 assert.equal(present.status,'observed',JSON.stringify(present));
 assert(present.tables.some(x=>x.name===table&&x.family==='inet'));
 assert.notEqual(present.revision,before.revision);
 assert.equal(present.kernelTransactionApplied,false);
 assert.equal(present.nodeIdentityVerified,false);
}finally{
 if(created){
  const del=run(['delete','table','inet',table]);
  assert.equal(del.status,0,del.stderr);
 }
}
const restored=await observeRuleset();
assert.equal(restored.status,'observed',JSON.stringify(restored));
assert.equal(restored.revision,before.revision);
console.log('NFTABLES_READBACK_REAL_OK real JSON digest, presence, deletion, unchanged final state');
