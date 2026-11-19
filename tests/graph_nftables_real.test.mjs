import {strict as assert} from 'node:assert';
import {checkLab} from '../apps/nftables_lab/check.mjs';
import {compileLabScript} from '../apps/nftables_lab/compile.mjs';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compilePreview} from '../apps/nftables_preview/compile.mjs';
const expected=['ADA_NFT_LAB_NAMESPACE','ADA_NFT_LAB_NAMESPACE_ROOT',
 'ADA_NFT_LAB_NFT','ADA_NFT_LAB_IP'];
for(const key of expected)assert(process.env[key],key+' is required');
assert.equal(process.platform,'linux','Linux-only disposable namespace test');
const topology={nodes:[
 {id:'operator',kind:'client',addresses:['192.0.2.10','2001:db8::10']},
 {id:'target',kind:'server',addresses:['192.0.2.20','2001:db8::20']}],
 services:[
 {id:'secure-api',node:'target',protocol:'tcp',port:8443,
  addresses:['192.0.2.20','2001:db8::20']}],
 rules:[{id:'allow-api',from:'operator',to:'secure-api',effect:'allow',
  reason:'CI syntax test only'}]};
const preview=compilePreview({targetNode:'target',topology});
assert.equal(preview.candidate.length,2);
const result=await checkLab(preview);
if(result.status!=='syntax_checked'){
 const script=compileLabScript(preview).script;
 const scratch=await mkdtemp(join(tmpdir(),'ada-nft-ci-diag-'));
 try{
  const file=join(scratch,'fixture.nft');
  await writeFile(file,script,{mode:0o600,flag:'wx'});
  const diagnostic=spawnSync(process.env.ADA_NFT_LAB_IP,['netns','exec',
   process.env.ADA_NFT_LAB_NAMESPACE,process.env.ADA_NFT_LAB_NFT,
   '--check','--file',file],{encoding:'utf8',timeout:4000});
  console.error('SYNTHETIC_NFT_CHECK_DIAGNOSTIC',diagnostic.status,
   String(diagnostic.stderr||diagnostic.error||'').slice(0,1400));
  console.error('SYNTHETIC_NFT_SCRIPT',script);
 }finally{await rm(scratch,{recursive:true,force:true});}
}
assert.equal(result.status,'syntax_checked',JSON.stringify(result));
assert.equal(result.namespaceVerified,true);
assert.equal(result.syntaxVerified,true);
assert.equal(result.applied,false);
assert.equal(result.canApply,false);
assert.equal(result.rollbackArmed,false);
console.log('NFTABLES_REAL_CHECK_OK isolated nft --check IPv4/IPv6, no apply');
