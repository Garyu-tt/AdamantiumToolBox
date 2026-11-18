import {strict as assert} from 'node:assert';
import {availableViews,visibleTree,flatten,findItem} from '../apps/desktop/model.js';
import {readFile} from 'node:fs/promises';
import {validateManifest,validateGraph} from '../core/contract.mjs';
const manifest=JSON.parse(await readFile(new URL('../apps/desktop/manifest.json',import.meta.url),'utf8'));
assert(validateManifest(manifest));
const spec={app:'desktop',version:1,nodes:[{
 id:'desktop.view',type:'view',title:'Desktop Workspace',icon:'workbench',
 surface:'workspace',requires:[]
}],edges:[]};
assert(validateGraph(spec,manifest));
assert(!validateGraph({...spec,nodes:[{...spec.nodes[0],surface:'untrusted'}]},manifest));
assert(!validateGraph({...spec,nodes:[{...spec.nodes[0],type:'action'}]},manifest));
const views=[
 {type:'view',id:'editor.view',title:'Редактор'},
 {type:'view',id:'studio.view',title:'Studio'},
 {type:'view',id:'desktop.view',surface:'workspace'}
];
const tree={children:[
 {type:'folder',name:'Tools',children:[
  {type:'app',name:'Редактор',view:'editor.view'},
  {type:'app',name:'Удалённый',view:'missing.view'}]},
 {type:'folder',name:'Пустая',children:[{type:'app',name:'Desktop',view:'desktop.view'}]},
 {type:'app',name:'Studio',view:'studio.view'}
]};
const filtered=visibleTree(tree,views);
assert.equal(filtered.length,2);
assert.equal(filtered[0].children.length,1);
assert.equal(filtered[0].children[0].name,'Редактор');
assert.equal(flatten(filtered).length,2);
assert.equal(findItem(filtered,'editor.view').path,'Tools/Редактор');
assert.equal(findItem(filtered,'desktop.view'),null);
assert.equal(availableViews(views).size,2);
assert.deepEqual(visibleTree({children:[]},[]),[]);
console.log('DESKTOP_OK manifest surface isolation LinkFS filtering shortcuts');
