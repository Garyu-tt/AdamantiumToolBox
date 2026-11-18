export async function mount(host,api){
 const el=(tag,text,parent=host)=>{const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 el('h2','Genesis · Brain Incubator');
 el('p','CPU-first: experimental rate-neuron backend. Not a biological brain emulator.');
 const controls=el('section'),output=el('pre','Выберите операцию и параметры.');
 const graph=api.graph();
 const actions=graph.nodes.filter(n=>n.type==='action'&&n.id.startsWith('genesis.'));
 if(!actions.length){el('p','Нет разрешённых операций Genesis.',controls);return;}
 const selector=el('select',undefined,controls);
 for(const action of actions){const opt=el('option',action.title,selector);opt.value=action.id;}
 const form=el('div',undefined,controls),run=el('button','Выполнить',controls);
 const info=el('section');
 function renderFields(){
  form.replaceChildren();
  const action=actions.find(a=>a.id===selector.value);
  for(const field of action.inputs||[]){
   const wrapper=el('label',field.label||field.name,form);
   const input=el(field.type==='json'?'textarea':'input',undefined,wrapper);
   input.dataset.field=field.name;input.dataset.type=field.type||'text';
   if(field.type==='number'){input.type='number';input.step='any';}
   input.value=field.default===undefined?'':String(field.default);
  }
 }
 function visual(result){
  info.replaceChildren();
  if(!Array.isArray(result?.cells))return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 500 140');svg.setAttribute('width','100%');
  for(const [i,n] of result.cells.slice(0,50).entries()){
   const x=15+(i%25)*19,y=25+Math.floor(i/25)*56;
   const c=document.createElementNS(svg.namespaceURI,'circle');
   c.setAttribute('cx',x);c.setAttribute('cy',y);
   c.setAttribute('r',String(3+Math.abs(n.activity)*6));
   c.setAttribute('fill','currentColor');c.setAttribute('opacity',n.phase==='shadow'?'0.25':'0.8');
   svg.append(c);
  }
  info.append(svg);el('small','Нейроны (до 50); полупрозрачные — теневые.',info);
 }
 selector.onchange=renderFields;
 run.onclick=async()=>{
  try{
   const params={};
   for(const input of form.querySelectorAll('[data-field]')){
    const value=input.value.trim();if(!value)continue;
    params[input.dataset.field]=input.dataset.type==='json'?JSON.parse(value):
     input.dataset.type==='number'?Number(value):value;
   }
   const result=await api.call(selector.value,params);
   output.textContent=JSON.stringify(result,null,2);visual(result);
  }catch(e){output.textContent='Ошибка: '+e.message;}
 };
 renderFields();
}
