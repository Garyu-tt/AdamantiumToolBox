import {strict as assert} from 'node:assert';
import {checkLab} from '../apps/nftables_lab/check.mjs';
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
assert.equal(result.status,'syntax_checked',JSON.stringify(result));
assert.equal(result.namespaceVerified,true);
assert.equal(result.syntaxVerified,true);
assert.equal(result.applied,false);
assert.equal(result.canApply,false);
assert.equal(result.rollbackArmed,false);
console.log('NFTABLES_REAL_CHECK_OK isolated nft --check IPv4/IPv6, no apply');
