import {createHash} from 'node:crypto';

// `wg show all dump` includes PRIVATE and PRESHARED keys; NEVER return raw input.
// Interface record: name,private,public,port,fwmark. Peer record: name,public,psk,endpoint,allowedIPs,handshake,rx,tx,keepalive.
const id = /^[A-Za-z0-9_.=-]{1,32}$/;
const key = /^[A-Za-z0-9+/]{43}=$/;
const integer = /^\d{1,20}$/;
const range = v => integer.test(v) && BigInt(v) <= 65535n;
const fingerprint = value => createHash('sha256').update(value).digest('hex').slice(0,20);
const num = v => {if (!integer.test(v)) throw Error('invalid_dump'); return BigInt(v);};
const limit = 1024*1024;
function allowedIPs(value){
 if(value==='(none)') return [];
 const ips=value.split(',');
 if(ips.length>256 || ips.some(ip=>ip.length>64||!/^([0-9a-fA-F:.]+\/\d{1,3})$/.test(ip)))throw Error('invalid_dump');
 return ips;
}
export function parseWireGuardDump(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>limit)throw Error('invalid_dump');
 const out=[],byName=new Map();
 const lines=raw.trim().length?raw.trimEnd().split(/\r?\n/):[];
 if(lines.length>5000)throw Error('invalid_dump');
 for(const line of lines){
  const c=line.split('\t');
  if(c.length===5){
   const [name,_privateKey,publicKey,listen,fwmark]=c;
   if(!id.test(name)||byName.has(name)||!range(listen)||!key.test(publicKey) ||
      !/^(off|0x[0-9a-fA-F]{1,8}|\d{1,10})$/.test(fwmark))throw Error('invalid_dump');
   const entry={id:name,listenPort:Number(listen),publicKeyFingerprint:fingerprint(publicKey),peerCount:0,peers:[]};
   out.push(entry);byName.set(name,entry);
  }else if(c.length===9){
   const [name,publicKey,_psk,endpoint,ips,handshake,rx,tx,keepalive]=c;
   if(!byName.has(name)||!key.test(publicKey)||endpoint.length>256 ||
      !(keepalive==='off'||range(keepalive)))throw Error('invalid_dump');
   const x=byName.get(name);
   const peer={id:fingerprint(publicKey),endpointConfigured:endpoint!=='(none)',
     allowedIPs:allowedIPs(ips),latestHandshakeSeconds:num(handshake).toString(),
     transferRxBytes:num(rx).toString(),transferTxBytes:num(tx).toString(),
     keepaliveSeconds:keepalive==='off'?null:Number(keepalive)};
   if(x.peers.some(p=>p.id===peer.id))throw Error('invalid_dump');
   x.peers.push(peer);x.peerCount++;
  }else throw Error('invalid_dump');
 }
 return {interfaces:out,interfaceCount:out.length,peerCount:out.reduce((n,i)=>n+i.peerCount,0)};
}
