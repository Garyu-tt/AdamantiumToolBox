import {strict as assert} from 'node:assert';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {bundleHash,hash} from '../apps/gauntlet/shared.mjs';
import {inspect} from '../apps/gauntlet/inspect.mjs';
import {submit,accept} from '../apps/gauntlet/pipeline.mjs';
const root=await mkdtemp(join(tmpdir(),'gauntlet-failure-'));
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const manifest={mas:'1.0',id:'specimen',name:'Specimen',version:'0.1.0',
 icon:'graph',lifecycle:'independent',service:{protocol:'mas-http-1',port:8999},
 ui:{standard:'mas-ui-1',mode:'embedded-and-standalone'},
 auth:{mode:'host-delegated'},permissions:['specimen.read'],
 events:{schema:'mas-event-1'},data:{refs:'mas-ref-1'},
 updates:{strategy:'semver',migrations:[]}};
const files={'manifest.json':JSON.stringify(manifest),
 'service.mjs':'export const ok=true;\n','view.js':'export const view=true;\n'};
const make=(task_id,fileset=files)=>({task_id,plugin_id:'specimen',
 author_id:'claude',files:fileset,sha256:bundleHash(fileset)});
const names=['syntax','build','dependencies','isolation','unit','integration',
 'contract','security','regression','no_hardcode','conflicts'];
const ev=(name,status='PASS')=>{const log=name+' real fixture '+status;
 return {name,status,log,log_sha256:hash(log),command:'qa-fixture '+name,
  exit_code:status==='PASS'?0:1,signal:null,duration_ms:10};};
const signReport=report=>({task_id:report.task_id,report,
 signature:sign(null,Buffer.from(JSON.stringify(report)),privateKey).toString('base64')});
const base=task_id=>({schema:'gauntlet-test-report-1',task_id,sha256:make(task_id).sha256,
 run_id:'isolated-fixture-1',runner_id:'qa-independent',cost_usd:1,
 dynamic_ui_supported:false,dynamic_skip_reason:'fixture has no live bindings',
 tests:names.map(name=>ev(name))});
try{
 let input=make('qa-failed-case');
 assert(inspect({...input,author_id:''}).issues.includes('invalid_author_id'));
 assert(inspect(input,[{id:'other',service:{port:8999}}]).issues.includes('port_conflict:other'));
 const badFiles={...files,'service.mjs':"fetch('https://bad.example/api');"};
 assert(inspect(make('hardcoding-test',badFiles)).issues.some(x=>x.startsWith('hardcoded_environment')));
 const depFiles={...files,'service.mjs':"import foo from '../other/service.mjs';"};
 assert(inspect(make('dependency-test',depFiles)).issues.some(x=>x.startsWith('implicit_dependency')));
 let state=await submit(root,input);assert.equal(state.status,'BUILDING');
 let report=base(input.task_id);report.tests=report.tests.map(x=>x.name==='unit'?ev('unit','FAIL'):x);
 state=await accept(root,signReport(report),publicKey);
 assert.equal(state.status,'BLOCKED');assert(state.issues.includes('test_failed:unit'));
 const name=(await readdir(join(root,'diagnostics')))[0];
 const doc=JSON.parse(await readFile(join(root,'diagnostics',name),'utf8'));
 assert.equal(name,hash(JSON.stringify(doc))+'.json');
 assert(doc.qa_evidence);
 const evidence=JSON.parse(await readFile(join(root,'qa-evidence',doc.qa_evidence),'utf8'));
 assert.equal(evidence.report.tests.find(x=>x.name==='unit').status,'FAIL');
 input=make('qa-missing-tests');await submit(root,input);
 report=base(input.task_id);report.tests=report.tests.filter(x=>x.name!=='regression');
 state=await accept(root,signReport(report),publicKey);
 assert(state.issues.includes('missing_test:regression'));
 input=make('qa-dynamic');await submit(root,input);
 report=base(input.task_id);report.dynamic_ui_supported=true;delete report.dynamic_skip_reason;
 state=await accept(root,signReport(report),publicKey);
 assert(state.issues.includes('missing_test:ui_live'));
 input=make('qa-forged-pass');await submit(root,input);
 report=base(input.task_id);
 report.tests[0]={...report.tests[0],exit_code:1};
 await assert.rejects(accept(root,signReport(report),publicKey),/invalid_test_evidence/);
 input=make('qa-contract');await submit(root,input);
 report=base(input.task_id);report.changed_contracts=['mas.graph'];
 state=await accept(root,signReport(report),publicKey);
 assert(state.issues.includes('dependency_impact_unverified'));
 console.log('GAUNTLET_FAILURES_OK negative gates, SHA256 diagnostics and retained CI logs');
}finally{await rm(root,{recursive:true,force:true});}
