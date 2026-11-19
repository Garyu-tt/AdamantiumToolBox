import {readFile,lstat} from 'node:fs/promises';
import {checkpoint,signCheckpoint,verifyLedger,stateCheck,ORIGIN} from './contract.mjs';
import {sensitive} from './config.mjs';
import {client} from './tls.mjs';
import {readCache,saveCache,compareCache} from './cache.mjs';
async function snapshot(path){const before=await lstat(path);
 if(!before.isFile()||before.isSymbolicLink()||(before.mode&0o077)||before.size>8*1024*1024)throw Error('unsafe_ledger');
 const raw=await readFile(path,'utf8'),after=await lstat(path);
 if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('ledger_changed_during_read');
 return verifyLedger(raw);
}
async function next(cfg){const snap=await snapshot(cfg.source.ledgerPath),tls=await client(cfg);
 const state=stateCheck((await tls.get()),{witnessId:cfg.witness.id,journalId:cfg.source.journalId,publicKey:cfg.witness.publicKey});
 compareCache(await readCache(cfg.source.receiptPath,cfg.witness),state);
 if(state.ledgerSeq>snap.seq)return {kind:'rollback_detected',snap,state};
 if(state.ledgerSeq>0&&snap.rows[state.ledgerSeq-1]?.hash!==state.ledgerHead)return {kind:'fork_detected',snap,state};
 if(state.ledgerSeq===snap.seq)return {kind:'in_sync',snap,state};
 const segment=snap.rows.slice(state.ledgerSeq,state.ledgerSeq+32);
 const last=segment.at(-1);if(!last)throw Error('missing_segment');
 const point=checkpoint(cfg.source.journalId,cfg.source.keyId,last.seq,last.hash,new Date().toISOString());
 return {kind:'pending',snap,state,segment,checkpoint:point,tls};
}
export async function preview(cfg){const r=await next(cfg);
 return {state:r.kind,sourceSeq:r.snap.seq,witnessedSeq:r.state.ledgerSeq,remaining:Math.max(0,r.snap.seq-r.state.ledgerSeq),
  nextBatch:r.segment?.length||0,enforcement:false};}
export async function deliver(cfg){const r=await next(cfg);
 if(r.kind==='rollback_detected'||r.kind==='fork_detected')throw Error(r.kind);
 if(r.kind==='in_sync')return {state:'in_sync',witnessedSeq:r.state.ledgerSeq,enforcement:false};
 const signature=signCheckpoint(r.checkpoint,await sensitive(cfg.source.keyPath),cfg.source.publicKey);
 try{const result=await r.tls.post({schema:'network-checkpoint-transfer-v1',checkpoint:r.checkpoint,signature,
  segment:r.segment,expectedRevision:r.state.witnessRevision});
  const {witnessReceipt}=await import('./contract.mjs');
  const proof=witnessReceipt(result,r.checkpoint,signature,cfg.witness.id,cfg.witness.publicKey);
  await saveCache(cfg.source.receiptPath,result,cfg.witness);
  return {state:'delivered_verified',...proof,batch:r.segment.length,enforcement:false};
 }catch(e){return {state:'delivery_unconfirmed',mayHaveCommitted:true,error:String(e.message).slice(0,80),
  requiresReadback:true,automaticRetry:false,enforcement:false};}
}
