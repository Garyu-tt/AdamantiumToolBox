import {strict as assert} from 'node:assert';
import {parseWireguardEvidence} from '../apps/wireguard_graph/parse.mjs';
import {captureWireguard} from '../apps/wireguard_graph/collect.mjs';
const key=n=>Buffer.alloc(32,n).toString('base64');
const a=key(1),b=key(2);
const now=2000000000;
const allowed='wg0 '+a+' 10.77.0.2/32,fd00::2/128\nwg0 '+b+' 10.77.0.2/32\n';
const times='wg0 '+a+' '+(now-20)+'\nwg0 '+b+' 0\n';
const parsed=parseWireguardEvidence({allowedIps:allowed,latestHandshakes:times,nowSeconds:now});
assert.equal(parsed.peers.length,2);
assert(parsed.issues.some(x=>x.code==='duplicate_allowed_prefix'));
assert(parsed.issues.some(x=>x.code==='no_observed_handshake'));
assert.equal(parsed.peerIdentityVerified,false);
assert.equal(parsed.canApply,false);
assert(!JSON.stringify(parsed).includes(a));
assert(!JSON.stringify(parsed).includes(b));
assert.deepEqual(parsed,parseWireguardEvidence({allowedIps:allowed,latestHandshakes:times,nowSeconds:now}));
assert(parseWireguardEvidence({allowedIps:'wg0 '+a+' 0.0.0.0/0',latestHandshakes:'',nowSeconds:now})
 .issues.some(x=>x.code==='wide_allowed_prefix'));
assert(parseWireguardEvidence({allowedIps:'wg0 '+a+' malicious',latestHandshakes:'',nowSeconds:now})
 .issues.some(x=>x.code==='invalid_allowed_prefix'));
assert(parseWireguardEvidence({allowedIps:'bad key 10.0.0.1/32',latestHandshakes:'',nowSeconds:now})
 .issues.some(x=>x.code==='malformed_allowed_ips'));
const invoked=[];
const snapshot=await captureWireguard({executable:'/operator/approved/wg',nowSeconds:now,
 run:async args=>{invoked.push(args.join(' '));
  return args.at(-1)==='allowed-ips'?allowed:times;}});
assert.deepEqual(invoked,['show all allowed-ips','show all latest-handshakes']);
assert.equal(snapshot.status,'observed');
assert.equal(snapshot.peers.length,2);
assert.equal((await captureWireguard({executable:''})).status,'unavailable');
assert.equal((await captureWireguard({executable:'/operator/approved/wg',
 run:async()=>{throw Error('sensitive command error')}})).issues[0].code,'wireguard_readonly_probe_failed');
console.log('GRAPH_WIREGUARD_OK public-only CLI, hashes, conflict, no private keys');
