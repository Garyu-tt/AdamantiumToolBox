export function windowLayoutUI(button,manager,config){
 const create=(tag,text,container)=>{const item=document.createElement(tag);
  if(text!==undefined)item.textContent=text;container.append(item);return item;};
 const panel=create('section',undefined,document.body);
 panel.className='layout-panel';panel.hidden=true;
 panel.setAttribute('aria-label','Расположение окон');
 const title=create('strong','Расположение окон',panel);
 const info=create('p','',panel);info.className='mas-note';
 const layoutLabel=create('label','Схема',panel);
 const schemes=create('select',undefined,layoutLabel);
 for(const item of config.layouts){
  const option=create('option',item.label,schemes);option.value=item.id;
 }
 const ratioLabel=create('label','Размер главного окна',panel);
 const slider=create('input',undefined,ratioLabel);
 slider.type='range';slider.min=String(config.ratio.min*100);
 slider.max=String(config.ratio.max*100);
 slider.step=String(config.ratio.step*100);
 slider.value=String(config.ratio.default*100);
 const percent=create('output',slider.value+'%',ratioLabel);
 const controls=create('div',undefined,panel);controls.className='mas-toolbar';
 const apply=create('button','Разместить',controls);
 const reset=create('button','Свободно',controls);
 const close=create('button','Закрыть',controls);
 const update=()=>{
  const count=manager.list().filter(item=>!item.minimized).length;
  info.textContent='Открыто окон: '+count+' · В сетку: до '+config.maxTiled;
  apply.disabled=count===0||count>config.maxTiled;
 };
 const applyLayout=()=>{
  try{manager.tile(schemes.value,Number(slider.value)/100);info.textContent='Окна распределены';}
  catch(e){info.textContent=e.message;}
 };
 slider.oninput=()=>{percent.value=slider.value+'%';
  if(manager.settings().layout)applyLayout();
 };
 schemes.onchange=()=>{if(manager.settings().layout)applyLayout();};
 apply.onclick=applyLayout;
 reset.onclick=()=>{manager.restoreAll();update();};
 close.onclick=()=>{panel.hidden=true;button.setAttribute('aria-expanded','false');};
 button.setAttribute('aria-haspopup','true');button.setAttribute('aria-expanded','false');
 button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));update();};
 document.addEventListener('pointerdown',e=>{
  if(!panel.hidden&&!panel.contains(e.target)&&!button.contains(e.target)){
   panel.hidden=true;button.setAttribute('aria-expanded','false');
  }
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){
  panel.hidden=true;button.setAttribute('aria-expanded','false');button.focus();
 }});
 return {update};
}
