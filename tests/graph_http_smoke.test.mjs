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
 ['nftables_preview',39825,'nftables_preview.compile','nftables_preview.read',
 {targetNode:'host',topology:{nodes:[{id:'host',kind:'server',addresses:[]}],services:[],rules:[]}}],
 ['network_inventory',39826,'network_inventory.snapshot','network_inventory.read',{}],
 ['wireguard_graph',39827,'wireguard_graph.snapshot','wireguard_graph.read',{}],
 ['nftables_lab',39828,'nftables_lab.check','nftables_lab.read',
 {preview:{schema:'nftables-intent-preview-1',applied:false,safeToApply:false,
 proposedBackend:{attachedToKernel:false},candidate:[]}}],
 ['rollback_watchdog',39829,'rollback_watchdog.journal','rollback_watchdog.read',
 {schema:'rollback-watchdog-journal-1',leaseId:'lease-1',planDigest:'a'.repeat(64),
 deadlineSeconds:2000000000,events:[]}],
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
  assert(doc.nodes.some(x=>x.id===name+'.view'&&x.icon&&x.requires?.includes(permission)));
  assert(doc.nodes.every(x=>x.id.startsWith(name+'.')));
  const r=await fetch(origin+'/invoke',{method:'POST',headers:auth,
   body:JSON.stringify({action,params})});
  assert.equal(r.status,200,name+':invoke');
  const data=await r.json();assert(data.result);
  if(name==='rollback_watchdog'){
   assert(doc.nodes.some(x=>x.id==='rollback_watchdog.receipt'));
   assert(doc.nodes.some(x=>x.id==='rollback_watchdog.diagnose'));
   const missing=await fetch(origin+'/invoke',{method:'POST',headers:auth,
    body:JSON.stringify({action:'rollback_watchdog.receipt',params:{}})});
   assert.equal(missing.status,200);
   const check=(await missing.json()).result;
   assert.equal(check.signatureValid,false);
   assert.equal(check.readyToApply,false);
  }
  if(name==='nftables_lab'){
   assert(doc.nodes.some(x=>x.id==='nftables_lab.rollback_trial'));
   const res=await fetch(origin+'/invoke',{method:'POST',headers:auth,
    body:JSON.stringify({action:'nftables_lab.rollback_trial',params:{
     deadlineMs:100,advanceToMs:150,events:[
      {kind:'syntax_validated',atMs:0},{kind:'arm_rollback',atMs:10},
      {kind:'commit_simulated',atMs:20}]}})});
   assert.equal(res.status,200);
   const trial=(await res.json()).result;
   assert.equal(trial.state,'rolled_back');
   assert.equal(trial.kernelChanged,false);
  }
  if(name==='nftables_preview'){
   assert(doc.nodes.some(x=>x.id==='nftables_preview.transaction'));
   const plan=await fetch(origin+'/invoke',{method:'POST',headers:auth,
    body:JSON.stringify({action:'nftables_preview.transaction',params})});
   assert.equal(plan.status,200);
   const result=(await plan.json()).result;
   assert.equal(result.applied,false);
   assert(result.graph.nodes.every(x=>x.status==='blocked'));
  }
 }finally{proc.kill('SIGTERM');}
}
console.log('GRAPH_HTTP_OK authenticated MAS graphs and read-only actions');
