import {strict as assert} from 'node:assert';
import {renderGraph} from '../apps/graph_manager/canvas.js';
const node=(tag)=>({tag,children:[],attrs:{},textContent:'',
 setAttribute(k,v){this.attrs[k]=v;},append(child){this.children.push(child);},
 replaceChildren(){this.children=[];}});
const before=globalThis.document;
globalThis.document={createElementNS:(ns,tag)=>node(tag)};
try{
 const host=node('main'),selected=[];
 const graph={nodes:[{id:'p.task',kind:'task',title:'Blocker',status:'blocked'},
  {id:'p.view',kind:'capability',title:'View',status:'unknown'}],
  edges:[{from:'p.view',to:'p.task',type:'depends'}]};
 renderGraph(host,graph,'',id=>selected.push(id));
 const svg=host.children[0];
 assert(svg.attrs.viewBox.startsWith('0 0 1075 '),'last_layer_clipped');
 assert(svg.children.some(x=>x.tag==='line'),'graph_edges_not_rendered');
 const blocked=svg.children.find(x=>x.attrs.class?.includes('gm-blocked'));
 assert(blocked);
 blocked.onclick();assert.deepEqual(selected,['p.task']);
 let prevented=false;blocked.onkeydown({key:'Enter',preventDefault(){prevented=true;}});
 assert(prevented);assert.equal(selected.length,2);
 renderGraph(host,{nodes:[],edges:[]},'',()=>{});
 assert.equal(host.children[0].tag,'svg');
 console.log('GRAPH_MANAGER_CANVAS_OK clipped layers keyboard activation edges');
}finally{globalThis.document=before;}