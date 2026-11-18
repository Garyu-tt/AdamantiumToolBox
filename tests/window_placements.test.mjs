import {strict as assert} from 'node:assert';
import {readPlacement,savePlacement} from '../shell/window_placements.js';
const disk=new Map();
globalThis.localStorage={
 getItem:key=>disk.get(key)||null,
 setItem:(key,data)=>disk.set(key,data)
};
const rect={x:55,y:80,width:620,height:390};
assert(savePlacement('app:editor.view',rect));
assert.deepEqual(readPlacement('app:editor.view'),rect);
assert(!savePlacement('folder:random',rect));
assert(!savePlacement('app:editor.view',{...rect,width:-100}));
assert.equal(readPlacement('__proto__'),null);
assert(savePlacement('system:graphs',{x:0,y:0,width:1200,height:800}));
assert.equal(readPlacement('system:graphs').width,1200);
disk.set('mas.window.placement.v1','{broken}');
assert.equal(readPlacement('app:editor.view'),null);
console.log('WINDOW_PLACEMENTS_OK persisted safe window geometry');
