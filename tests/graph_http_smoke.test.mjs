import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const key='test-only-internal-key-0123456789';
const suites=[['graph_dns',39821,'graph_dns.audit','graph_dns.read',
 {zones:[{name:'example.test'}],records:[]}],
 ['graph_firewall',39824,'graph_firewall.inspect','graph_firewall.read',
 {nodes:[],services:[],rules:[]}],
 ['noosphere',39822,'noosphere.inspect','noosphere.read',{records:[]}]];
for(const [name,port,action,permission,params] of suites){
 const proc=spawn(process.execPath,[resolve(root,'apps',name,'service.mjs')],{
  env:{...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:key,ADA_CAPS:permission},stdio:'ignore'});
 const origin='http://127.0.0.1:'+port;
 try{
  let ready=false;
  for(let i=0;i<80;i++){
   try{const resp=await fetch(origin+'/health');ready=resp.ok;if(ready)break;}
   catch{await new Promise(ok=>setTimeout(ok,30));}
  }
  assert(ready,name+':health_timeout');
  const denied=await fetch(origin+'/graph');assert.equal(denied.status,401);
  const auth={'X-Internal-Key':key,'Content-Type':'application/json'};
  const doc=await (await fetch(origin+'/graph',{headers:auth})).json();
  assert(doc.nodes.some(x=>x.id===action));
  const r=await fetch(origin+'/invoke',{method:'POST',headers:auth,
   body:JSON.stringify({action,params})});
  assert.equal(r.status,200,name+':invoke');
  const data=await r.json();assert(data.result);
 }finally{proc.kill('SIGTERM');}
}
console.log('GRAPH_HTTP_OK authenticated MAS graphs and read-only actions');
