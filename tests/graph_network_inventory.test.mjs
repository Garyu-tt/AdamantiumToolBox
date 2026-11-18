import {strict as assert} from 'node:assert';
import {parseIpv4Routes,parseIpv6Routes} from '../apps/network_inventory/routes.mjs';
import {captureNetworkSnapshot} from '../apps/network_inventory/snapshot.mjs';
import {reconcileBindings} from '../apps/network_inventory/reconcile.mjs';
const v4='Iface Destination Gateway Flags RefCnt Use Metric Mask MTU Window IRTT\n'+
 'eth0 00000000 010200C0 0003 0 0 100 00000000 0 0 0\n'+
 'eth0 0002A8C0 00000000 0001 0 0 100 00FFFFFF 0 0 0\n';
const v6='00000000000000000000000000000000 00 '+
 '00000000000000000000000000000000 00 '+
 '00000000000000000000000000000000 00000064 00000000 00000000 00000001 eth0\n';
assert.equal(parseIpv4Routes(v4).routes.length,2);
assert.equal(parseIpv4Routes(v4).routes[0].gateway,'192.0.2.1');
assert.equal(parseIpv4Routes(v4).routes[1].destination,'192.168.2.0/24');
assert.equal(parseIpv6Routes(v6).routes.length,1);
assert.equal(parseIpv6Routes(v6).routes[0].destination,'0:0:0:0:0:0:0:0/0');
assert.equal(parseIpv6Routes(v6).routes[0].gateway,null);
assert.equal(parseIpv4Routes(v4+'oops\n').issues[0].code,'invalid_ipv4_route');
const fixtures={'/proc/net/route':v4,'/proc/net/ipv6_route':v6};
const snap=await captureNetworkSnapshot({platform:'linux',
 interfaces:{eth0:[{family:'IPv4',address:'192.0.2.8',cidr:'192.0.2.8/24',internal:false}]},
 readText:async p=>fixtures[p],now:()=> '2026-11-19T00:00:00.000Z'});
assert.equal(snap.routes.length,3);
assert.equal(snap.routeEvidence.v6,'procfs_partial');
assert.equal(snap.identityVerified,false);
assert.equal(snap.graph.nodes.find(x=>x.id==='local:unverified').attested,false);
assert.equal(snap.readOnly,true);
assert.deepEqual(snap,await captureNetworkSnapshot({platform:'linux',
 interfaces:{eth0:[{family:'IPv4',address:'192.0.2.8',cidr:'192.0.2.8/24',internal:false}]},
 readText:async p=>fixtures[p],now:()=> '2026-11-19T00:00:00.000Z'}));
const topology={nodes:[{id:'server',addresses:['192.0.2.8']}],
 services:[{id:'imap',node:'server',addresses:['192.0.2.8']}]};
const result=reconcileBindings({targetNode:'server',topology},snap);
assert.equal(result.checks.length,1);
assert.equal(result.checks[0].observedLocally,true);
assert.equal(result.nodeIdentityVerified,false);
assert.equal(result.canApply,false);
const bad={...topology,services:[{id:'imap',node:'server',addresses:['192.0.2.99']}]};
const mismatch=reconcileBindings({targetNode:'server',topology:bad},snap);
assert(mismatch.issues.some(x=>x.code==='service_address_not_observed'));
assert(mismatch.issues.some(x=>x.code==='service_address_not_declared'));
const partial=await captureNetworkSnapshot({platform:'win32',interfaces:{},now:()=> '2026-11-19T00:00:00.000Z'});
assert(partial.issues.some(x=>x.code==='routing_not_supported'));
assert(reconcileBindings({targetNode:'server',topology},partial).issues.some(x=>x.code==='routing_visibility_incomplete'));
assert.throws(()=>reconcileBindings({targetNode:'missing',topology},snap),/target_not_in_topology/);
assert.equal(parseIpv6Routes('broken\n').issues[0].code,'invalid_ipv6_route');
console.log('GRAPH_NETWORK_INVENTORY_OK Linux routes, gaps, local-only reconciliation');
