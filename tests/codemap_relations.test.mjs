import {strict as assert} from 'node:assert';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const script=join(root,'tools','codemap_graph.py');
const run=args=>JSON.parse(execFileSync('python',[script,...args],{
 cwd:root,encoding:'utf8',maxBuffer:4*1024*1024,windowsHide:true}));
const graph=run(['graph']);
assert.equal(graph.relations_schema,'mas-code-relations-1');
assert(graph.relations.some(x=>x.file==='apps/editor/manifest.json'&&
 x.type==='runtime'&&x.to==='apps/editor/service.mjs'));
assert(graph.relations.some(x=>x.file==='apps/editor/manifest.json'&&
 x.type==='connection'&&x.to==='capability://studio.view'));
assert(graph.relations.some(x=>x.type==='bridge_adapter'&&
 x.file==='frank-addons/javascript/hello/frank-addon.json'));
const target=graph.nodes.find(n=>n.file==='apps/editor/manifest.json');
const context=run(['context',target.file,target.sha256]);
assert.equal(context.revision,target.sha256);
assert(context.source.includes('"mas"'));
assert(context.relations.some(x=>x.type==='runtime'));
assert(context.relations.length<=48);
const tmp=mkdtempSync(join(tmpdir(),'mas-relations-'));
const put=(name,data)=>{mkdirSync(join(tmp,...name.split('/').slice(0,-1)),{recursive:true});
 writeFileSync(join(tmp,...name.split('/')),typeof data==='string'?data:JSON.stringify(data));};
try{
 const manifest='apps/widget/manifest.json',modules='apps/widget/modules.json';
 const service='apps/widget/service.mjs',entry='frank-addons/python/sample/main.py';
 const frank='frank-addons/python/sample/frank-addon.json';
 put(manifest,{mas:'1.0',id:'widget',connections:[
  {from:'widget.view',to:'leonardo.render',type:'related'}]});
 put(service,'export const running=true;');
 put(modules,{schema:'mas-modules-1',app:'widget',modules:[{
  id:'widget.root',provides:[{id:'widget.view'}],children:[{
  id:'widget.nested',consumes:[
   {id:'widget.view',optional:false},{id:'leonardo.render',optional:true}],
  provides:[{id:'widget.action'}]}]}]});
 put(entry,'print("ok")');
 put(frank,{schema:'frank-addon-1',id:'sample',language:'python',
  entry:'main.py',adapter:'frankenstein.adapter.python'});
 put('apps/broken/manifest.json',{mas:'1.0',id:'broken',connections:{bad:true}});
 const files=[manifest,modules,service,entry,frank,'apps/broken/manifest.json'];
 const py='import json,sys;from pathlib import Path;sys.path.insert(0,sys.argv[2]);'+
  'from codemap_relations import collect;'+
  'print(json.dumps(collect(Path(sys.argv[1]),set(sys.argv[3:]))))';
 const links=JSON.parse(execFileSync('python',['-c',py,tmp,join(root,'tools'),...files],
  {encoding:'utf8',windowsHide:true}));
 assert(links.some(x=>x.file===modules&&x.type==='contains'&&
  x.to==='module://widget.nested'));
 assert(links.some(x=>x.file===modules&&x.type==='provides'&&
  x.to==='capability://widget.action'));
 assert(links.some(x=>x.file===modules&&x.type==='consumes_optional'&&
  x.to==='capability://leonardo.render'));
 assert(links.some(x=>x.file===manifest&&x.type==='connection'&&
  x.from==='capability://widget.view'));
 assert(links.some(x=>x.file===frank&&x.type==='entry'&&x.to===entry));
 assert(!links.some(x=>x.file==='apps/broken/manifest.json'));
 console.log('CODEMAP_RELATIONS_OK MAS nested dependencies Frank bridge SHA context');
}finally{rmSync(tmp,{recursive:true,force:true});}
