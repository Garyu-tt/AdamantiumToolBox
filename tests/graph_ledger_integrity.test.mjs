import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,writeFile,chmod,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {canonicalApproval} from '../apps/rollback_ledger/proof.mjs';
import {reserveLease,inspectLease,leasePath} from '../apps/rollback_ledger/store.mjs';
import {auditReservations} from '../apps/rollback_ledger/audit.mjs';
const root=await mkdtemp(join(tmpdir(),'ledger-integrity-'));
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const trustedPublicKey=publicKey.export({format:'der',type:'spki'}).toString('base64');
const nowSeconds=1800000000;
const base={schema:'rollback-watchdog-approval-1',leaseId:'lease-integrity',
 targetNode:'host',planDigest:'a'.repeat(64),baseRevision:'b'.repeat(64),
 issuedAt:nowSeconds,expiresAt:nowSeconds+180};
const signature=sign(null,Buffer.from(canonicalApproval(base)),privateKey).toString('base64');
const context={expectedLeaseId:base.leaseId,expectedTargetNode:base.targetNode,
 expectedPlanDigest:base.planDigest,expectedBaseRevision:base.baseRevision};
const options={root,trustedPublicKey,nowSeconds},path=join(leasePath(root,base.leaseId),'claim.json');
const reset=async data=>{await writeFile(path,JSON.stringify(data)+'\n',{mode:0o600});await chmod(path,0o600);};
try{
 const receipt={...base,signature};
 assert.equal((await reserveLease({receipt,context},options)).status,'reserved');
 const canonical=JSON.parse(await readFile(path,'utf8'));
 const verified=await inspectLease(base.leaseId,options);
 assert.equal(verified.status,'reserved');
 assert.equal(verified.signatureVerified,true);
 assert.equal(verified.readyToApply,false);
 for(const mutated of [
  {...canonical,planDigest:'c'.repeat(64)},
  {...canonical,targetNode:'other'},
  {...canonical,reservedAt:nowSeconds+10000},
  {...canonical,keyFingerprint:'d'.repeat(64)},
  {...canonical,signature:Buffer.alloc(64,1).toString('base64')}
 ]){
  await reset(mutated);
  const bad=await inspectLease(base.leaseId,options);
  assert.equal(bad.status,'indeterminate');
  assert.equal(bad.readyToApply,false);
  const audit=await auditReservations(options);
  assert.equal(audit.allLeasesRecovered,false);
  assert(audit.issues.some(x=>x.code==='unreadable_or_partial_lease'));
 }
 await reset(canonical);
 assert.equal((await inspectLease(base.leaseId,options)).signatureVerified,true);
 assert.equal((await inspectLease(base.leaseId,{root,nowSeconds})).status,'indeterminate');
 await chmod(path,0o644);
 assert.equal((await inspectLease(base.leaseId,options)).status,'indeterminate');
 await chmod(path,0o600);
 await rm(path);
 await symlink('/dev/null',path);
 assert.equal((await inspectLease(base.leaseId,options)).status,'indeterminate');
 const symlinkAudit=await auditReservations(options);
 assert.equal(symlinkAudit.allLeasesRecovered,false);
 assert(symlinkAudit.issues.some(x=>x.code==='unreadable_or_partial_lease'));
 assert.equal((await reserveLease({receipt,context},options)).status,'already_consumed');
 console.log('GRAPH_LEDGER_INTEGRITY_OK signed reread, tamper, mode, symlink, replay');
}finally{await rm(root,{recursive:true,force:true});}
