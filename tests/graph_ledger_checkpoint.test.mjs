import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {canonicalApproval} from '../apps/rollback_ledger/proof.mjs';
import {reserveLease,leasePath} from '../apps/rollback_ledger/store.mjs';
import {checkpointReservations} from '../apps/rollback_ledger/checkpoint.mjs';
const root=await mkdtemp(join(tmpdir(),'ledger-checkpoint-'));
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const trustedPublicKey=publicKey.export({format:'der',type:'spki'}).toString('base64');
const nowSeconds=1800000000,options={root,trustedPublicKey,nowSeconds};
const make=id=>{
 const base={schema:'rollback-watchdog-approval-1',leaseId:id,
  targetNode:'host',planDigest:'a'.repeat(64),baseRevision:'b'.repeat(64),
  issuedAt:nowSeconds,expiresAt:nowSeconds+180};
 const signature=sign(null,Buffer.from(canonicalApproval(base)),privateKey).toString('base64');
 return {receipt:{...base,signature},context:{expectedLeaseId:id,
  expectedTargetNode:base.targetNode,expectedPlanDigest:base.planDigest,
  expectedBaseRevision:base.baseRevision}};
};
try{
 assert.equal((await reserveLease(make('lease-1'),options)).status,'reserved');
 const first=await checkpointReservations(options);
 assert.equal(first.status,'observed');
 assert.equal(first.rows.length,1);
 assert.equal(first.rows[0].state,'verified_signed_approval');
 assert.equal(first.remoteAnchorVerified,false);
 assert.equal(first.readyToApply,false);
 const compared=await checkpointReservations({...options,expectedDigest:first.digest});
 assert.equal(compared.callerAnchorMatches,true);
 assert.equal(compared.externallyAnchored,false);
 assert.equal((await checkpointReservations({...options,
  expectedDigest:'b'.repeat(64)})).callerAnchorMatches,false);
 assert.equal((await checkpointReservations({root,nowSeconds})).status,'degraded');
 assert.equal((await checkpointReservations({...options})).digest,first.digest);
 await reserveLease(make('lease-2'),options);
 const added=await checkpointReservations({...options,expectedDigest:first.digest});
 assert.equal(added.status,'observed');
 assert.equal(added.callerAnchorMatches,false);
 const filename=join(leasePath(root,'lease-1'),'claim.json');
 const claim=JSON.parse(await readFile(filename,'utf8'));
 await writeFile(filename,JSON.stringify({...claim,planDigest:'f'.repeat(64)})+'\n');
 const corrupt=await checkpointReservations({...options,expectedDigest:added.digest});
 assert.equal(corrupt.status,'degraded');
 assert(corrupt.issues.some(x=>x.code==='unverified_checkpoint_entry'));
 assert.equal(corrupt.callerAnchorMatches,false);
 await writeFile(filename,JSON.stringify(claim)+'\n',{mode:0o600});
 await rm(leasePath(root,'lease-2'),{recursive:true,force:true});
 const erased=await checkpointReservations({...options,expectedDigest:added.digest});
 assert.equal(erased.status,'observed');
 assert.equal(erased.callerAnchorMatches,false);
 await mkdir(leasePath(root,'lease-partial'),{mode:0o700});
 const tombstone=await checkpointReservations(options);
 assert.equal(tombstone.status,'degraded');
 assert(tombstone.rows.some(x=>x.state==='untrusted_or_partial'));
 await assert.rejects(checkpointReservations({...options,expectedDigest:'wrong'}),
  /invalid_checkpoint_digest/);
 console.log('GRAPH_LEDGER_CHECKPOINT_OK snapshots, changed set, tamper, tombstone, missing trust');
}finally{await rm(root,{recursive:true,force:true});}
