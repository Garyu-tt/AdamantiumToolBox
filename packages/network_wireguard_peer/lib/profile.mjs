import {isIP} from 'node:net';
import {publicKey} from './contract.mjs';

const cidr=/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/;
const endpointRE=/^([A-Za-z0-9.-]{1,253}|\[[a-fA-F0-9:]{2,45}\]):([1-9][0-9]{0,4})$/;
const validCidr=value=>{
 const m=cidr.exec(value);
 if(!m||isIP(m[1])!==4)throw Error('invalid_profile_route');
 return value;
};
export function profileSettings(env=process.env){
 const serverPublicKey=publicKey(env.NETWORK_WG_SERVER_PUBLIC_KEY||'');
 const endpoint=env.NETWORK_WG_SERVER_ENDPOINT||'';
 const match=endpointRE.exec(endpoint);
 if(!match||Number(match[2])>65535||match[1].includes('..'))throw Error('invalid_profile_endpoint');
 const allowedIPs=(env.NETWORK_WG_CLIENT_ROUTES||'').split(',').filter(Boolean);
 if(!allowedIPs.length||allowedIPs.length>16)throw Error('invalid_profile_routes');
 for(const route of allowedIPs)validCidr(route);
 const dns=env.NETWORK_WG_CLIENT_DNS||'';
 if(dns&&isIP(dns)!==4)throw Error('invalid_profile_dns');
 return {serverPublicKey,endpoint,allowedIPs,dns};
}
export function createClientTemplate({clientPublicKey,address,peers,settings}){
 publicKey(clientPublicKey);
 if(typeof address!=='string'||!cidr.test(address)||!address.endsWith('/32'))throw Error('invalid_profile_address');
 validCidr(address);
 if(!Array.isArray(peers))throw Error('invalid_profile_state');
 const peer=peers.find(p=>p.publicKey===clientPublicKey);
 if(!peer||peer.allowedIPs?.length!==1||peer.allowedIPs[0]!==address)throw Error('peer_not_enrolled');
 const s=settings;
 if(!s||!Array.isArray(s.allowedIPs)||!s.allowedIPs.length)throw Error('profile_unconfigured');
 const lines=[
  '[Interface]','PrivateKey = __LOCAL_PRIVATE_KEY__',
  'Address = '+address,
  ...(s.dns?['DNS = '+s.dns]:[]),
  '','[Peer]',
  'PublicKey = '+s.serverPublicKey,
  'Endpoint = '+s.endpoint,
  'AllowedIPs = '+s.allowedIPs.join(', '),
  'PersistentKeepalive = 25'
 ];
 return {schema:'network-wireguard-local-client-profile-v1',
  template:lines.join('\n')+'\n',privateKeySource:'client_only',
  secretIncluded:false,serverPublicKey:s.serverPublicKey,peerAddress:address};
}
