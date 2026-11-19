import { examples } from './demo';
import { mountRete } from './rete_view';
import { verifiedShape } from './projection';
import { parseLocalGraph } from './local_import';
import type { Graph } from './types';
import './style.css';

const viewport = document.querySelector<HTMLElement>('#graph');
const status = document.querySelector<HTMLElement>('#status');
const chooser = document.querySelector<HTMLSelectElement>('#scenario');
const uploader = document.querySelector<HTMLInputElement>('#load-graph');
if (!viewport || !status || !chooser || !uploader) throw Error('missing_editor_mount');

// A loaded JSON file is a local visualization candidate, never a runtime action.
// The editor can be closed, refreshed or replaced without affecting the IR host.
let current: {destroy():void} | null = null;
let transition = Promise.resolve();
function displayGraph(candidate:unknown,label:string){
 // Fail closed BEFORE destroying the current valid viewport.
 const graph:Graph=verifiedShape(candidate);
 transition=transition.then(async()=>{
   current?.destroy();
   current=null;
   viewport.replaceChildren();
   const mounted=await mountRete(viewport,graph,draft=>{
     status.textContent='DRAFT proposal based on revision '+
       draft.baseRevision+' — not executed or saved.';
   });
   current=mounted;
   status.textContent=label+' · '+graph.id+' · '+graph.nodes.length+
     ' nodes · '+graph.edges.length+' typed edges · preview only';
 }).catch(()=>{
   status.textContent='Graph renderer failed. No graph execution or write attempted.';
 });
}
chooser.addEventListener('change',()=>{
 try{
   const selected=examples[chooser.value];
   if(!selected)throw Error('unknown_graph_scenario');
   displayGraph(selected,'Bundled sample');
 }catch{
   status.textContent='Graph rejected. No execution or write attempted.';
 }
});
uploader.addEventListener('change',async()=>{
 const file=uploader.files?.[0];
 uploader.value='';
 if(!file)return;
 try{
   const graph=await parseLocalGraph(file,verifiedShape);
   displayGraph(graph,'Local JSON · '+file.name.slice(0,100));
 }catch{
   // Do not destroy the previous valid graph on malformed, oversized or
   // schema-invalid input. No file leaves this browser session.
   status.textContent='Local JSON rejected (size, syntax or G0 schema). Previous view unchanged.';
 }
});
const sample=examples[chooser.value];
if(sample)displayGraph(sample,'Bundled sample');
else status.textContent='Unknown startup sample. No graph executed.';
window.addEventListener('pagehide',()=>current?.destroy(),{once:true});
