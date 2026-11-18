import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'adamantium-ir-'));
process.env.LOCALAPPDATA=dir;
const {loadFrontend,saveFrontend}=await import('../core/frontend.mjs');
const {describe,semanticGraph}=await import('../core/semantic.mjs');
const {planChange,applyChange,rollbackChange,history}=await import('../core/change.mjs');
const back={version:1,nodes:[{id:'editor.list',type:'action',title:'List files'}],edges:[]};
const ref='component://f.button.files';
try{
 const empty=await loadFrontend();
 const frontend={version:1,nodes:[{id:'f.tab.home',kind:'tab',title:'Home'},
  {id:'f.button.files',kind:'button',title:'Files',x:4,y:5}],
 edges:[{from:'f.tab.home',to:'f.button.files',type:'contains'}]};
 let result=await saveFrontend({frontend,bridge:{version:1,edges:[]},etag:empty.etag});
 let data=await loadFrontend();
 assert.equal(describe(ref,data,back).properties.title,'Files');
 assert(semanticGraph(data,back).nodes.some(n=>n.ref===ref));
 let plan=await planChange({operation:'modify',target:ref,
  change:{property:'title',value:'Open files'},expected_etag:data.etag,
  constraints:{preserve_api:true,preserve_permissions:true,validate_dependents:true}},back);
 assert.equal(plan.diff.before,'Files');
 assert.equal(plan.affected[0],'f.tab.home');
 await assert.rejects(applyChange({...plan,plan_id:'bad'},back),/plan_tampered/);
 result=await applyChange(plan,back);
 assert.equal(result.result,'accepted');
 data=await loadFrontend();
 assert.equal(describe(ref,data,back).properties.title,'Open files');
 assert.equal((await history()).events.length,1);
 assert.equal((await history()).events[0].kind,'change');
 await assert.rejects(applyChange(plan,back),/stale_revision/);
 await assert.rejects(planChange({operation:'modify',target:ref,
  change:{property:'binding',value:'invented.command'},expected_etag:data.etag},back),/unavailable/);
 await assert.rejects(planChange({operation:'modify',target:ref,
  change:{property:'id',value:'evil'},expected_etag:data.etag},back),/readonly_property/);
 await assert.rejects(planChange({operation:'modify',target:ref,
  change:{property:'title',value:'Bad'},expected_etag:data.etag,
  constraints:{preserve_permissions:false}},back),/unsafe_constraint/);
 const commit=await rollbackChange(result.change_id,data.etag,back);
 assert.equal(commit.result,'rolled_back');
 data=await loadFrontend();assert.equal(describe(ref,data,back).properties.title,'Files');
 assert.equal(data.history.length,2);
 await assert.rejects(rollbackChange(result.change_id,data.etag,back),/not_latest_change/);
 const next={...data,frontend:structuredClone(data.frontend)};
 next.frontend.nodes.find(n=>n.id==='f.button.files').title='A';
 const other=structuredClone(next);
 other.frontend.nodes.find(n=>n.id==='f.button.files').title='B';
 const settled=await Promise.allSettled([saveFrontend(next),saveFrontend(other)]);
 assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(settled.filter(x=>x.status==='rejected').length,1);
 console.log('SEMANTIC_IR_OK describe graph plan apply audit rollback stale conflict');
}finally{await rm(dir,{recursive:true,force:true});}
