import {strict as assert} from 'node:assert';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const sidecar=fileURLToPath(new URL('./legacy_stdio.mjs',import.meta.url));
const cli=process.argv[2];
if(!cli)throw Error('native_cli_path_required');
const KEY='test-secret-only-for-local-bridge-probe-12345';
let graph={version:1,nodes:[{id:'alpha.read',type:'resource',entry:'/private',secret:'not-for-ipc'}],edges:[],secret:'top-secret'};
let authorized=true;
const server=createServer((req,res)=>{
  const ok=req.method==='GET'&&req.url==='/api/graph'&&req.headers.authorization==='Bearer '+KEY&&authorized;
  res.writeHead(ok?200:401,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify(ok?graph:{error:'unauthorized',token:KEY}));
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const BASE='http://127.0.0.1:'+server.address().port+'/';
const frame=(op,id,payload=Buffer.alloc(0))=>{const x=Buffer.alloc(20+payload.length);
 x.write('MASL');x.writeUInt16BE(1,4);x.writeUInt16BE(op,6);
 x.writeBigUInt64BE(BigInt(id),8);x.writeUInt32BE(payload.length,16);payload.copy(x,20);return x;};
function start(env={}){
 return spawn(process.execPath,[sidecar],{env:{...process.env,MAS_LEGACY_CORE_URL:BASE,MAS_LEGACY_CORE_TOKEN:KEY,...env},stdio:['pipe','pipe','pipe']});
}
function collect(child){
 let queue=Buffer.alloc(0),wait=[];
 const backlog=[];
 child.stdout.on('data',part=>{queue=Buffer.concat([queue,part]);
  while(queue.length>=20){const n=queue.readUInt32BE(16);if(n>65536)throw Error('oversized_reply');
   if(queue.length<20+n)break;
   const msg=queue.subarray(0,20+n);queue=queue.subarray(20+n);
   const done=wait.shift();if(done)done(msg);else backlog.push(msg);
  }
 });
 return ()=>new Promise((resolve,reject)=>{
   if(backlog.length){resolve(backlog.shift());return;}
   const timer=setTimeout(()=>reject(Error('sidecar_timeout')),5000);
   wait.push(x=>{clearTimeout(timer);resolve(x);});
 });
}
try{
 const native=spawnSync(cli,['emit'],{encoding:'buffer'});
 assert.equal(native.status,0);assert.equal(native.stdout.length,20);
 assert.equal(native.stdout.readBigUInt64BE(8),42n);
 const child=start(),next=collect(child);
 child.stdin.write(native.stdout);
 const first=await next();
 assert.equal(first.readUInt16BE(6),2);assert.equal(first.readBigUInt64BE(8),42n);
 const crossed=spawnSync(cli,['read'],{input:first});assert.equal(crossed.status,0);
 const discovery=JSON.parse(crossed.stdout.toString());
 assert.equal(discovery.schema,'mas-legacy-discovery-1');
 assert.deepEqual(discovery.nodes,[{id:'alpha.read',type:'resource'}]);
 assert.equal(JSON.stringify(discovery).includes('secret'),false);
 graph={version:1,nodes:[{id:'beta.view',type:'view'}],edges:[]};
 child.stdin.write(frame(1,43));const second=await next();
 assert.deepEqual(JSON.parse(second.subarray(20).toString()).nodes,[{id:'beta.view',type:'view'}]);
 authorized=false;
 child.stdin.write(frame(1,44));const revoked=await next();
 assert.equal(revoked.readUInt16BE(6),3);
 assert.equal(revoked.subarray(20).toString(),'legacy_graph_unavailable');
 assert.equal(revoked.includes(Buffer.from(KEY)),false);
 child.stdin.end();await once(child,'close');
 const malformed=start(),bad=collect(malformed);
 malformed.stdin.write(frame(2,1));const rejected=await bad();
 assert.equal(rejected.readUInt16BE(6),3);
 malformed.stdin.end();await once(malformed,'close');
 const reused=start(),repeat=collect(reused);authorized=true;
 reused.stdin.write(frame(1,100));assert.equal((await repeat()).readUInt16BE(6),2);
 reused.stdin.write(frame(1,100));assert.equal((await repeat()).readUInt16BE(6),3);
 reused.stdin.end();await once(reused,'close');
 console.log('MAS_LEGACY_SIDECAR_R01_OK: C++ to Node to C++, graph refresh, no secret disclosure, deny/replay');
}finally{await new Promise(resolve=>server.close(resolve));}
