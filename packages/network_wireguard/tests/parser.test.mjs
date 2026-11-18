import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {parseWireGuardDump} from '../lib/parser.mjs';
import {readWireGuard} from '../lib/reader.mjs';
const k=()=>randomBytes(32).toString('base64');
const a=k(),b=k(),priv=k(),psk=k();
const fixture=()=>['wg-test\t'+priv+'\t'+a+'\t51820\toff',
  'wg-test\t'+b+'\t'+psk+'\t203.0.113.33:51820\t10.0.0.2/32,2001:db8::1/128\t1234\t9223372036854775808\t37\t25'].join('\n')+'\n';
test('redacts secrets, remote endpoint, raw public keys',()=>{
 const s=parseWireGuardDump(fixture()),raw=JSON.stringify(s);
 assert.equal(s.interfaceCount,1);assert.equal(s.peerCount,1);
 for(const value of [priv,psk,a,b,'203.0.113.33'])assert(!raw.includes(value),'sensitive content leaked');
 assert.equal(s.interfaces[0].peers[0].endpointConfigured,true);
 assert.equal(s.interfaces[0].peers[0].transferRxBytes,'9223372036854775808');
 assert.deepEqual(s.interfaces[0].peers[0].allowedIPs,['10.0.0.2/32','2001:db8::1/128']);
});
test('empty dump is supported',()=>assert.deepEqual(parseWireGuardDump(''),{interfaces:[],interfaceCount:0,peerCount:0}));
test('rejects malformed and ambiguous peer rows',()=>{
 assert.throws(()=>parseWireGuardDump(fixture()+'\tbad\n'),/invalid_dump/);
 assert.throws(()=>parseWireGuardDump(fixture()+fixture().split('\n')[1]+'\n'),/invalid_dump/);
 assert.throws(()=>parseWireGuardDump('wg0\t'+priv+'\t'+a+'\tinvalid\toff'),/invalid_dump/);
});
test('allows multiple interfaces with independent peers',()=>{
 const source=['wg0\t'+priv+'\t'+a+'\t0\toff','wg1\t'+priv+'\t'+b+'\t51820\t0x1'].join('\n');
 const r=parseWireGuardDump(source);assert.equal(r.interfaceCount,2);assert.equal(r.peerCount,0);
});
test('reader uses exactly one read-only command and never echoes secret errors',async()=>{
 let args;const runner=async(...a)=>{args=a;return {stdout:fixture()}};
 const ok=await readWireGuard({runner,binary:'/operator/wg'});
 assert.deepEqual(args[1],['show','all','dump']);assert.equal(args[2].shell,false);assert(ok.available);
 const bad=await readWireGuard({runner:async()=>{const e=Error('secret-token');e.code='EACCES';throw e;}});
 assert.equal(bad.reason,'permission_denied');assert(!JSON.stringify(bad).includes('secret-token'));
});
