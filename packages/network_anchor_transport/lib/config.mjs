import {readFile,lstat} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {validTrust} from './anchor-contract.mjs';
export async function privateRead(path,max=16384){
 if(typeof path!=='string'||!isAbsolute(path)||path.length>4000)throw Error('invalid_path');
 const st=await lstat(path);if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)||st.size>max)throw Error('unsafe_private_file');
 return readFile(path,'utf8');
}
export function loopback(url){try{const u=new URL(url);
 if(u.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(u.hostname)||u.pathname!=='/'||
 u.username||u.password||u.search||u.hash)throw Error();return u;
 }catch{throw Error('unsafe_local_anchor_url');}}
export async function load(path){const cfg=JSON.parse(await privateRead(path));
 if(cfg.schema!=='network-anchor-transport-config-v1'||!['sender','receiver'].includes(cfg.mode))throw Error('invalid_config');
 const trust=validTrust(JSON.parse(await privateRead(cfg.trustFile,32768)));cfg.trust=trust;
 if(cfg.mode==='sender'){
  const s=cfg.sender;if(!s||!s.witnessLog||!s.proofCache||!s.url||!s.caFile||!s.clientCertFile||!s.clientKeyFile||
   !/^[0-9a-f]{64}$/.test(s.serverSpkiSha256||''))throw Error('invalid_sender');
  const u=new URL(s.url);if(u.protocol!=='https:'||u.pathname!=='/'||u.username||u.password||u.hash||u.search)throw Error('unsafe_remote_url');
  await privateRead(s.clientKeyFile);return cfg;
 }
 const r=cfg.receiver;if(!r||typeof r.listenHost!=='string'||!Number.isInteger(r.listenPort)||r.listenPort<1024||r.listenPort>65535||
 !r.serverCertFile||!r.serverKeyFile||!r.caFile||!/^[0-9a-f]{64}$/.test(r.clientSpkiSha256||''))throw Error('invalid_receiver');
 loopback(r.localAnchorUrl);await privateRead(r.serverKeyFile);return cfg;
}
