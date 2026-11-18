import {mkdtemp,mkdir,writeFile,rename,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {strict as assert} from 'node:assert';
import {linkTree} from '../core/linkfs.mjs';
const root=await mkdtemp(join(tmpdir(),'ada-linkfs-'));
const base=join(root,'interface'),dev=join(base,'Инструменты');
const backend={nodes:[{id:'editor.view',type:'view',icon:'editor'}]};
try{
 await mkdir(dev,{recursive:true});
 await mkdir(join(base,'Пустая папка'));
 await writeFile(join(dev,'Editor.appref.json'),JSON.stringify({
  schema:'mas-appref-1',app:'editor',view:'editor.view'}));
 await writeFile(join(dev,'Unavailable.appref.json'),JSON.stringify({
  schema:'mas-appref-1',app:'unknown',view:'unknown.view'}));
 let tree=await linkTree(root,backend);
 assert(tree.children.some(x=>x.name==='Пустая папка'&&x.children.length===0));
 assert.equal(tree.children.find(x=>x.name==='Инструменты').children.length,1);
 await rename(dev,join(base,'Переименованная папка'));
 tree=await linkTree(root,backend);
 assert(tree.children.some(x=>x.name==='Переименованная папка'));
 assert(!tree.children.some(x=>x.name==='Инструменты'));
 const isolated=await linkTree(root,{nodes:[]});
 assert.equal(isolated.children.find(x=>x.name==='Переименованная папка').children.length,0);
 console.log('LINKFS_OK folder-rename empty-folder app-filter');
}finally{await rm(root,{recursive:true,force:true});}
