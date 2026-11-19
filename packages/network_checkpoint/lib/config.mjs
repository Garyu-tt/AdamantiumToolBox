import {readFile,lstat} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {createPrivateKey,createPublicKey} from 'node:crypto';
import {pub} from './contract.mjs';
export async function sensitive(path,max=16384){if(typeof path!=='string'||!isAbsolute(path)||path.length>4000)throw Error('invalid_private_path');
 const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)||s.size>max)throw Error('unsafe_private_file');
 return readFile(path,'utf8');}
export function localTarget(url){try{const u=new URL(url);
 if(u.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.username||u.password||
 u.hash||u.search||u.pathname!=='/')throw Error('invalid_local_target');return u;}
 catch{throw Error('invalid_local_target');}}
export async function loadConfig(path){const cfg=JSON.parse(await sensitive(path,16384));
 if(cfg.schema!=='network-checkpoint-config-v1'||!['source','receiver'].includes(cfg.mode))throw Error('invalid_config');
 if(cfg.mode==='source'){
  const s=cfg.source,w=cfg.witness;
  if(!s||!w||!s.journalId||!s.keyId||!s.publicKey||!s.ledgerPath||!s.keyPath||
   !w.id||!w.publicKey||!w.url||!w.caFile||!w.clientCertFile||!w.clientKeyFile||!s.receiptPath||
   !/^[0-9a-f]{64}$/.test(w.serverSpkiSha256||''))throw Error('invalid_source_config');
  if(!(await import('node:path')).isAbsolute(s.receiptPath))throw Error('invalid_receipt_path');
  const key=createPrivateKey(await sensitive(s.keyPath));if(key.asymmetricKeyType!=='ed25519'||!pub(key).equals(pub(s.publicKey)))throw Error('source_key_mismatch');
  if(pub(s.publicKey).equals(pub(w.publicKey)))throw Error('identities_not_independent');
  const u=new URL(w.url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('unsafe_remote_url');
  await sensitive(w.clientKeyFile);return cfg;
 }
 const s=cfg.receiver;
 if(!s||!Number.isInteger(s.listenPort)||s.listenPort<1024||s.listenPort>65535||
  typeof s.listenHost!=='string'||!s.serverCertFile||!s.serverKeyFile||!s.caFile||
  !/^[0-9a-f]{64}$/.test(s.clientSpkiSha256||'')||!s.journalId||!s.localWitnessUrl)
  throw Error('invalid_receiver_config');
 localTarget(s.localWitnessUrl);await sensitive(s.serverKeyFile);return cfg;
}
