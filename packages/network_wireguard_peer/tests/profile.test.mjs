import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {profileSettings,createClientTemplate} from '../lib/profile.mjs';
const key=()=>randomBytes(32).toString('base64');
const client=key(),server=key(),address='10.223.44.8/32';
const config={
 NETWORK_WG_SERVER_PUBLIC_KEY:server,
 NETWORK_WG_SERVER_ENDPOINT:'vpn.example.net:51820',
 NETWORK_WG_CLIENT_ROUTES:'10.223.44.0/24,192.168.22.0/24',
 NETWORK_WG_CLIENT_DNS:'192.168.22.1'
};
test('profile requires trusted, explicit server config and exact enrolled peer',()=>{
 const settings=profileSettings(config);
 const output=createClientTemplate({clientPublicKey:client,address,
  peers:[{publicKey:client,allowedIPs:[address]}],settings});
 assert.equal(output.secretIncluded,false);
 assert.equal(output.privateKeySource,'client_only');
 assert(output.template.includes('PrivateKey = __LOCAL_PRIVATE_KEY__'));
 assert(output.template.includes('PublicKey = '+server));
 assert(output.template.includes('Endpoint = vpn.example.net:51820'));
 assert(output.template.includes('AllowedIPs = 10.223.44.0/24, 192.168.22.0/24'));
 assert(output.template.includes('Address = '+address));
 assert(!output.template.includes(client));
});
test('never generate profile for missing or mismatched enrollment',()=>{
 const settings=profileSettings(config);
 const make=(peers,addr=address)=>createClientTemplate({clientPublicKey:client,address:addr,peers,settings});
 assert.throws(()=>make([]),/peer_not_enrolled/);
 assert.throws(()=>make([{publicKey:client,allowedIPs:['10.223.44.9/32']}]),/peer_not_enrolled/);
 assert.throws(()=>make([{publicKey:client,allowedIPs:[address,'10.223.44.9/32']}]),/peer_not_enrolled/);
 assert.throws(()=>make([{publicKey:client,allowedIPs:[address]}],'10.223.44.8/0'),/invalid_profile_address/);
});
test('untrusted endpoints and routes cannot inject config directives',()=>{
 for(const val of ['vpn.example.net:0','vpn.example.net:99999','evil.net:51820\nPostUp = curl example.net','bad..host:51820']){
  assert.throws(()=>profileSettings({...config,NETWORK_WG_SERVER_ENDPOINT:val}),/invalid_profile_endpoint/);
 }
 for(const val of ['0.0.0.0/0\nPostUp','10.0.0.999/24','::/0']){
  assert.throws(()=>profileSettings({...config,NETWORK_WG_CLIENT_ROUTES:val}),/invalid_profile_route/);
 }
 assert.throws(()=>profileSettings({...config,NETWORK_WG_CLIENT_DNS:'1.1.1.1\nPostUp=a'}),/invalid_profile_dns/);
 assert.throws(()=>profileSettings({...config,NETWORK_WG_SERVER_PUBLIC_KEY:'bad'}),/invalid_public_key/);
});
