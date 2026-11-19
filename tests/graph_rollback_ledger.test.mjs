import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {approvalPayload} from '../apps/rollback_watchdog/receipt.mjs';
import {reserveLease,inspectLease,leasePath} from '../apps/rollback_ledger/store.mjs';
import {auditReservations} from '../apps/rollback_ledger/audit.mjs';
const root=await mkdtemp(join(tmpdir(),'mas-ledger-'));
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const trustedPublicKey=publicKey.export({format:'der',type:'spki'}).toString('base64');
const nowSeconds=1800000000,hex=x=>x.repeat(64);
const make=(leaseId,planDigest=hex('a'))=>{
 const base={schema:'rollback-watchdog-approval-1',leaseId,targetNode:'host',
  planDigest,baseRevision:hex('b'),issuedAt:nowSeconds,expiresAt:nowSeconds+100};
 const signature=sign(null,Buffer.from(approvalPayload(base)),privateKey).toString('base64');
 return {receipt:{...base,signature},context:{expectedLeaseId:leaseId,
  expectedTargetNode:base.targetNode,expectedPlanDigest:planDigest,
  expectedBaseRevision:base.baseRevision}};
};
const options={root,trustedPublicKey,nowSeconds};
try{
 const input=make('lease-1');
 const first=await reserveLease(input,options);
 assert.equal(first.status,'reserved');
 assert.equal(first.localReplayConsumed,true);
 assert.equal(first.readyToApply,false);
 assert.equal((await reserveLease(input,options)).status,'already_consumed');
 const rotated=make('lease-1',hex('c'));
 assert.equal((await reserveLease(rotated,options)).status,'already_consumed');
 const retained=await inspectLease('lease-1',{...options,nowSeconds:nowSeconds+200});
 assert.equal(retained.status,'reserved');
 assert.equal(retained.signatureVerified,true);
 assert.equal(retained.filesystemIntegrityAttested,false);
 assert.equal(retained.expired,true);
 assert.equal(retained.requiresReview,true);
 const scan=await auditReservations({...options,nowSeconds:nowSeconds+200});
 assert.equal(scan.status,'scanned');
 assert.equal(scan.entries[0].state,'expired_needs_review');
 assert.equal(scan.allLeasesRecovered,true);
 assert.equal(scan.canApply,false);
 const corrupted=make('lease-2');
 corrupted.receipt.signature=Buffer.alloc(64,7).toString('base64');
 await assert.rejects(reserveLease(corrupted,options),/lease_signature_invalid/);
 assert.equal((await inspectLease('lease-2',options)).status,'unseen');
 const race=make('lease-race');
 const results=await Promise.all(Array.from({length:8},()=>reserveLease(race,options)));
 assert.equal(results.filter(x=>x.status==='reserved').length,1);
 assert.equal(results.filter(x=>x.status==='already_consumed').length,7);
 const lost=make('lease-crash');
 await mkdir(leasePath(root,'lease-crash'),{mode:0o700});
 assert.equal((await inspectLease('lease-crash',options)).status,'indeterminate');
 assert.equal((await reserveLease(lost,options)).status,'already_consumed');
 const recovered=await auditReservations(options);
 assert(recovered.issues.some(x=>x.code==='unreadable_or_partial_lease'));
 assert.equal(recovered.allLeasesRecovered,false);
 assert(recovered.entries.some(x=>x.state==='incomplete_or_untrusted'));
 await chmod(root,0o755);
 assert.equal((await reserveLease(make('lease-3'),options)).status,'unavailable');
 assert.equal((await auditReservations(options)).status,'unavailable');
 console.log('GRAPH_LEDGER_OK fsync reservation, race, replay, restart, crash tombstone');
}finally{await chmod(root,0o700);await rm(root,{recursive:true,force:true});}
