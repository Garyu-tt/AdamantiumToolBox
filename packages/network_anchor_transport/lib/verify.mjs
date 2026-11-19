import {readFile,lstat} from 'node:fs/promises';
import {ORIGIN,sha,verifyWitness,verifyAttestation,validTrust} from './anchor-contract.mjs';
export {ORIGIN};
export async function witnessSnapshot(path,trust){
 const before=await lstat(path);
 if(!before.isFile()||before.isSymbolicLink()||(before.mode&0o077)||before.size>8*1024*1024)throw Error('unsafe_witness_log');
 const raw=await readFile(path,'utf8'),after=await lstat(path);
 if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('witness_log_raced');
 if(raw&&!raw.endsWith('\n'))throw Error('truncated_witness_log');
 const rows=[];let head=ORIGIN,seq=0;
 for(const line of raw?raw.slice(0,-1).split('\n'):[]){let row;
  try{row=JSON.parse(line);}catch{throw Error('corrupt_witness_log');}
  if(row?.seq!==seq+1||row.previous!==head||row.hash!==sha(JSON.stringify({seq:row.seq,previous:row.previous,record:row.record})))throw Error('corrupt_witness_chain');
  const entry={receipt:row.record,signature:row.signature,witnessRevision:row.hash};
  if(!verifyWitness(entry,trust)||entry.receipt.anchorSeq!==row.seq)throw Error('untrusted_witness_receipt');
  rows.push(entry);seq++;head=row.hash;
 }
 return {seq,head,rows};
}
export function verifyRemoteState(state,trust){
 validTrust(trust);
 if(state?.schema!=='network-anchor-transport-state-v1'||state.anchorId!==trust.anchor.id||state.witnessId!==trust.witness.id||
 !Number.isSafeInteger(state.count)||state.count<0||!Number.isSafeInteger(state.witnessSeq)||state.witnessSeq<0||
 !/^[0-9a-f]{64}$/.test(state.revision)||!/^[0-9a-f]{64}$/.test(state.witnessHead))throw Error('invalid_anchor_state');
 if(state.count===0){if(state.revision!==ORIGIN||state.witnessSeq!==0||state.witnessHead!==ORIGIN||state.latest!==null)throw Error('invalid_anchor_genesis');}
 else{const l=state.latest;
  if(!l?.attestation||l.revision!==state.revision||!verifyAttestation(l.attestation,l.signature,trust)||
   l.attestation.anchorSeq!==state.count||l.attestation.anchorHead!==state.revision||
   l.attestation.witnessSeq!==state.witnessSeq||l.attestation.witnessHead!==state.witnessHead)throw Error('invalid_anchor_proof');}
 return state;
}
export function verifyCommit(result,trust,last,previous){
 if(result?.enforcement!==false||!result.attestation||!verifyAttestation(result.attestation,result.signature,trust)||
 result.revision!==result.attestation.anchorHead||result.attestation.anchorSeq!==previous.count+1||
 result.attestation.witnessSeq!==last.receipt.anchorSeq||result.attestation.witnessHead!==last.witnessRevision||
 result.attestation.witnessId!==trust.witness.id||result.attestation.anchorId!==trust.anchor.id)throw Error('untrusted_anchor_commit');
 return {schema:'network-anchor-transport-proof-v1',revision:result.revision,
  witnessSeq:result.attestation.witnessSeq,witnessHead:result.attestation.witnessHead,
  attestation:result.attestation,signature:result.signature};
}
