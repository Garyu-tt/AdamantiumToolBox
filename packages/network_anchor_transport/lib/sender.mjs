import {witnessSnapshot,verifyRemoteState,verifyCommit,ORIGIN} from './verify.mjs';
import {client} from './mtls.mjs';
import {loadCache,compareCache,saveCache} from './cache.mjs';
async function candidate(cfg){
 const local=await witnessSnapshot(cfg.sender.witnessLog,cfg.trust),http=await client(cfg);
 const state=verifyRemoteState(await http.get(),cfg.trust);
 compareCache(await loadCache(cfg.sender.proofCache,cfg.trust),state);
 if(state.witnessSeq>local.seq)return {state:'witness_rollback_detected',local,remote:state};
 if(state.witnessSeq>0&&local.rows[state.witnessSeq-1]?.witnessRevision!==state.witnessHead)
  return {state:'witness_fork_detected',local,remote:state};
 if(state.witnessSeq===local.seq)return {state:'in_sync',local,remote:state};
 const batch=local.rows.slice(state.witnessSeq,state.witnessSeq+16);
 if(!batch.length||batch[0].receipt.anchorSeq!==state.witnessSeq+1)throw Error('missing_witness_segment');
 return {state:'pending',local,remote:state,batch,http};
}
export async function preview(cfg){const r=await candidate(cfg);
 return {state:r.state,sourceSeq:r.local.seq,anchorSeq:r.remote.witnessSeq,
  remaining:Math.max(0,r.local.seq-r.remote.witnessSeq),nextBatch:r.batch?.length||0,enforcement:false};}
export async function deliver(cfg){const r=await candidate(cfg);
 if(r.state.endsWith('_detected'))throw Error(r.state);
 if(r.state==='in_sync')return {state:'in_sync',witnessSeq:r.remote.witnessSeq,enforcement:false};
 let result;
 try{result=await r.http.post({schema:'network-anchor-transport-transfer-v1',batch:r.batch,
  expectedRevision:r.remote.revision});}
 catch(e){return {state:'delivery_unconfirmed',mayHaveCommitted:true,requiresReadback:true,
  automaticRetry:false,error:String(e.message).slice(0,80),enforcement:false};}
 const tip=r.batch.at(-1);verifyCommit(result,cfg.trust,tip,r.remote);
 const newState=verifyRemoteState({schema:'network-anchor-transport-state-v1',
  anchorId:cfg.trust.anchor.id,witnessId:cfg.trust.witness.id,
  revision:result.revision,count:result.attestation.anchorSeq,witnessSeq:result.attestation.witnessSeq,
  witnessHead:result.attestation.witnessHead,
  latest:{attestation:result.attestation,signature:result.signature,revision:result.revision}},cfg.trust);
 await saveCache(cfg.sender.proofCache,newState,cfg.trust);
 return {state:'delivered_verified',count:r.batch.length,witnessSeq:newState.witnessSeq,
  anchorRevision:newState.revision,enforcement:false};
}
