import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolveComposition} from '../sdk/composition/resolver.mjs';
const specs=await Promise.all(['genesis','dante'].map(async n=>JSON.parse(
 await readFile(fileURLToPath(new URL('../standards/composition/'+n+'.json',import.meta.url)),'utf8'))));
const nodes=c=>c.map((contract,i)=>({id:'provider'+i+'.run',type:'action',contract}));
const genesisReq=specs[0].requires.map(x=>x.contract);
const danteReq=specs[1].requires.filter(x=>x.slot!=='cognition').map(x=>x.contract);
test('recursive DAG: Genesis as a nested composite, not a model replacement',()=>{
 const p=resolveComposition('dante',specs,{nodes:nodes([...genesisReq,...danteReq])});
 assert.equal(p.discovered,true);assert.equal(p.runnable,false);
 const inner=p.tree.roles.find(x=>x.slot==='cognition');
 assert.equal(inner.status,'discovered');assert.equal(inner.child.id,'genesis');
 assert.equal(inner.child.roles.length,7);
 assert(inner.child.roles.some(x=>x.status==='missing'&&!x.required));
});
test('failure modes: fixture, ambiguity, missing',()=>{
 const all=nodes([...genesisReq,...danteReq]);
 assert.equal(resolveComposition('dante',specs,{nodes:all.filter(x=>x.contract!==genesisReq[0])}).discovered,false);
 assert.equal(resolveComposition('dante',specs,{nodes:all.map(x=>x.contract===genesisReq[0]?{...x,fixture:true}:x)}).discovered,false);
 assert.equal(resolveComposition('dante',specs,{nodes:[...all,{id:'extra.run',type:'action',contract:genesisReq[0]}]}).tree.roles.find(x=>x.slot==='cognition').status,'blocked');
});
test('cycles, limits, invalid specs and misleading metadata fail safely',()=>{
 const a={schema:'mas.composite.v1',id:'alpha',version:'0.1.0',exports:['alpha.entry.v1'],requires:[{slot:'next',contract:'beta.entry.v1'}],optional:[]};
 const b={schema:'mas.composite.v1',id:'beta',version:'0.1.0',exports:['beta.entry.v1'],requires:[{slot:'next',contract:'alpha.entry.v1'}],optional:[]};
 const p=resolveComposition('alpha',[a,b],{nodes:[]});
 assert.equal(p.discovered,false);assert.equal(p.tree.roles[0].child.roles[0].child.status,'cycle');
 assert.equal(resolveComposition('dante',specs,{nodes:nodes([...genesisReq,...danteReq])},{maxDepth:1}).discovered,false);
 assert.throws(()=>resolveComposition('alpha',[a,a],{nodes:[]}),/duplicate_composite_id/);
 assert.throws(()=>resolveComposition('dante',[{...specs[1],requires:[{slot:'x',contract:'__evil'}]}],{nodes:[]}),/invalid_composite_spec/);
 assert.equal(resolveComposition('genesis',specs,{nodes:[{id:'unknown.run',type:'view',contract:genesisReq[0]}]}).discovered,false);
});
