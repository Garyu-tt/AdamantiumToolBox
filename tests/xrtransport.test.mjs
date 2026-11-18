import {strict as assert} from 'node:assert';
import {createServer} from 'node:http';
import {parseDevices,parsePackages} from '../apps/xrtransport/adb.mjs';
import {probe} from '../apps/xrtransport/adapters/alvr/probe.mjs';
import {adapters} from '../apps/xrtransport/providers.mjs';
assert.deepEqual(parseDevices('List of devices attached\nS123 device model:XR\n'),
 [{serial:'S123',status:'device',description:'model:XR'}]);
assert.deepEqual(parsePackages('package:com.a\npackage:com.b\npackage:com.a\n'),
 ['com.a','com.b']);
assert.deepEqual((await adapters()).map(x=>x.id),['alvr','wivrn']);
const server=createServer((req,res)=>{
 assert.equal(req.headers['x-alvr'],'1');
 if(req.url==='/api/version'){res.writeHead(200);res.end('"20.12.1"');}
 else {res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
 const result=await probe({endpoint:'http://127.0.0.1:'+server.address().port+'/'});
 assert.equal(result.state,'server_observed');
 assert.equal(result.streaming,'unverified');
 const blocked=await probe({endpoint:'http://169.254.169.254/'});
 assert.equal(blocked.state,'invalid_local_endpoint');
 console.log('XRTRANSPORT_PROVIDER_OK');
}finally{await new Promise(r=>server.close(r));}
