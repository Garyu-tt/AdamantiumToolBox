import {strict as assert} from 'node:assert';
import {parseRuleset} from '../apps/nftables_readback/parse.mjs';
import {observeRuleset} from '../apps/nftables_readback/observe.mjs';
const text=JSON.stringify({nftables:[
 {metainfo:{version:'1.0',release_name:'test'}},
 {table:{family:'inet',name:'ada_test'}},
 {chain:{family:'inet',table:'ada_test',name:'input',
  type:'filter',hook:'input',prio:0,policy:'accept'}},
 {rule:{family:'inet',table:'ada_test',chain:'input',expr:[]}},
 {set:{family:'inet',table:'ada_test',name:'allowed',type:'ipv4_addr'}}]});
const expected=parseRuleset(text,'2026-11-19T00:00:00Z');
assert.equal(expected.summary.tables,1);
assert.equal(expected.summary.chains,1);
assert.equal(expected.summary.rules,1);
assert.equal(expected.summary.sets,1);
assert.equal(expected.chains[0].baseChain,true);
assert.equal(expected.snapshotSigned,false);
assert.equal(expected.kernelTransactionApplied,false);
assert.equal(expected.readyToApply,false);
assert.deepEqual(expected,parseRuleset(text,'2026-11-19T00:00:00Z'));
assert.throws(()=>parseRuleset('not-json'),/invalid_nft_json/);
assert.throws(()=>parseRuleset('{"nftables":{}}'),/invalid_nft_schema/);
assert.throws(()=>parseRuleset('x'.repeat(1048577)),/ruleset_size_limit/);
const calls=[];
const base={mockPlatform:true,namespace:'fixture_a',namespaceRoot:'/tmp/mock-netns',
 nftBinary:'/opt/approved/nft',ipBinary:'/opt/approved/ip',
 stat:async p=>({dev:4,ino:p.includes('/proc/')?1:2}),
 now:()=> '2026-11-19T00:00:00Z',runner:async args=>{calls.push(args);return text;}};
const result=await observeRuleset(base);
assert.equal(result.status,'observed');
assert.equal(result.kernelReadbackObserved,true);
assert.equal(result.namespaceAttested,false);
assert.equal(result.nodeIdentityVerified,false);
assert.equal(result.readyToApply,false);
assert.deepEqual(calls,[['netns','exec','fixture_a','/opt/approved/nft',
 '-j','list','ruleset']]);
const same=await observeRuleset({...base,stat:async()=>({dev:1,ino:1}),
 runner:async()=>{throw Error('should not run');}});
assert.equal(same.reason,'namespace_matches_controller');
const unset=await observeRuleset({...base,namespace:''});
assert.equal(unset.status,'unavailable');
const fail=await observeRuleset({...base,runner:async()=>{throw Error('private data');}});
assert.equal(fail.reason,'readback_probe_failed');
console.log('GRAPH_NFT_READBACK_OK bounded JSON, distinct namespace, read-only CLI');
