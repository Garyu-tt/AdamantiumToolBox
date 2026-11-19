import {strict as assert} from 'node:assert';
import {compileLabScript} from '../apps/nftables_lab/compile.mjs';
import {checkLab} from '../apps/nftables_lab/check.mjs';
import {readFile,access} from 'node:fs/promises';
const preview={schema:'nftables-intent-preview-1',applied:false,safeToApply:false,
 proposedBackend:{attachedToKernel:false},
 candidate:[{addressFamily:'ip',sourceAddress:'192.0.2.2',
  destinationAddress:'192.0.2.20',protocol:'tcp',destinationPort:8443,verdict:'accept'}]};
const script=compileLabScript(preview);
assert.match(script.script,/add table inet ada_lab_[a-f0-9]{12}/);
assert.match(script.script,/add chain inet ada_lab_[a-f0-9]{12} verify/);
assert(script.script.includes('ip saddr 192.0.2.2 ip daddr 192.0.2.20 tcp dport 8443 accept'));
assert.equal(script.applied,false);
assert.equal(script.candidateCount,1);
assert.deepEqual(script,compileLabScript(preview));
assert.throws(()=>compileLabScript({...preview,applied:true}),/invalid_preview/);
assert.throws(()=>compileLabScript({...preview,proposedBackend:{attachedToKernel:true}}),/invalid_preview/);
assert.throws(()=>compileLabScript({...preview,candidate:[{...preview.candidate[0],
 sourceAddress:'192.0.2.2; flush ruleset'}]}),/invalid_ip/);
assert.throws(()=>compileLabScript({...preview,candidate:[{...preview.candidate[0],
 destinationPort:0}]}),/invalid_rule/);
const notConfigured=await checkLab(preview,{mockPlatform:true,namespace:'invalid/slash'});
assert.equal(notConfigured.status,'unavailable');
const stats=async(path)=>({dev:4,ino:path.includes('/proc/')?111:222});
const shared=await checkLab(preview,{mockPlatform:true,namespace:'lab_a',namespaceDir:'/tmp/operator-netns-fixture',
 nftBinary:'/usr/sbin/nft',ipBinary:'/usr/sbin/ip',
 stat:async()=>({dev:4,ino:111}),runner:()=>{throw Error('should never run');}});
assert.equal(shared.reason,'sandbox_matches_process_namespace');
const calls=[];
const tested=await checkLab(preview,{mockPlatform:true,namespace:'lab_a',namespaceDir:'/tmp/operator-netns-fixture',
 nftBinary:'/usr/sbin/nft',ipBinary:'/usr/sbin/ip',stat:stats,
 runner:async(command,args)=>{calls.push({command,args,
  script:await readFile(args.at(-1),'utf8')});
  return {ok:true,code:'syntax_valid'};}});
assert.equal(calls.length,1);
assert.equal(calls[0].command,'/usr/sbin/ip');
assert.deepEqual(calls[0].args.slice(0,-1),
 ['netns','exec','lab_a','/usr/sbin/nft','--check','--file']);
assert.equal(calls[0].script,script.script);
assert(calls[0].args.at(-1).endsWith('/rules.nft'));
await assert.rejects(access(calls[0].args.at(-1)),{code:'ENOENT'});
assert.equal(tested.status,'syntax_checked');
assert.equal(tested.syntaxVerified,true);
assert.equal(tested.canApply,false);
assert.equal(tested.applied,false);
const rejected=await checkLab(preview,{mockPlatform:true,namespace:'lab_a',namespaceDir:'/tmp/operator-netns-fixture',
 nftBinary:'/usr/sbin/nft',ipBinary:'/usr/sbin/ip',stat:stats,
 runner:async()=>({ok:false,code:'syntax_rejected'})});
assert.equal(rejected.status,'failed');assert.equal(rejected.syntaxVerified,false);
assert.equal(rejected.applied,false);
console.log('NFTABLES_LAB_OK typed-only, separate namespace, --check, no kernel apply');
