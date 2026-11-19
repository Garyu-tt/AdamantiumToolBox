import {strict as assert} from 'node:assert';
import {liveAVPanel} from '../apps/mikoshi_classroom/av_live_panel.js';
function mount(policy,permissions,receipts=true){
 const created=[];
 globalThis.document={createElement(tag){
  const element={tag,textContent:'',children:[],append(child){
   this.children.push(child);},onclick:null,disabled:false};
  created.push(element);return element;
 }};
 const host={append(){}},skills={
  vision:{skill:{actions:{analyze:'vision'}}},
  audio:{skill:{actions:{analyze:'audio'}}},
  sync:{skill:{actions:{align:'align'}}},
  memory:{skill:{actions:{remember:'remember',...(receipts?{receipt:'motifReceipt'}:{})}}},
  grounding:{skill:{actions:{associate:'associate',teach:'teach',
   ...(receipts?{receipt:'groundingReceipt'}:{})}}},
  policy:policy?{skill:{actions:policy}}:undefined};
 liveAVPanel(host,{call:async()=>{throw Error('unexpected_call');}},
  skills,new Set(permissions));
 const buttons=created.filter(e=>e.tag==='button').map(e=>e.textContent);
 return {buttons,labels:created.filter(e=>e.tag==='label').length};
}
const read=['vision','audio','align'],writes=['remember','teach',
 'motifReceipt','groundingReceipt'];
const absent=mount(null,[...read,...writes]);
assert(absent.buttons.some(x=>x.includes('Разрешить камеру')));
assert(absent.buttons.some(x=>x.includes('Выделить')));
assert(!absent.buttons.some(x=>x.includes('Сохранить')));
assert.equal(absent.labels,0,'no consent label for disabled storage');
const readonly=mount({status:'status',verify:'verify'},[
 ...read,...writes,'status','verify']);
assert(!readonly.buttons.some(x=>x.includes('Сохранить')));
const noWriteScope=mount({authorize:'authorize',verify:'verify'},[
 ...read,...writes,'verify']);
assert(!noWriteScope.buttons.some(x=>x.includes('Сохранить')));
const allowed=mount({authorize:'authorize',verify:'verify'},[
 ...read,...writes,'authorize','verify']);
assert(allowed.buttons.some(x=>x.includes('Сохранить')));
assert(allowed.buttons.some(x=>x.includes('Проверить сохранённые')));
const legacy=mount({authorize:'authorize',verify:'verify'},[
 ...read,...writes,'authorize','verify'],false);
assert(!legacy.buttons.some(x=>x.includes('Сохранить')),
 'unguarded legacy providers must never receive live AV lessons');
assert.equal(allowed.labels,1);
console.log('MIKOSHI_AV_GATE_VIEW_OK read-only permitted; writes require source policy');
