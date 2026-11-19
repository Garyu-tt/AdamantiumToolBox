export async function mount(host,api){
 const add=(tag,text)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;host.append(el);return el;};
 add('h2','nftables Lab');
 add('p','Нет изменений ядра: проверка синтаксиса и симулятор аварийного отката.');
 const input=add('textarea');input.rows=10;input.style.width='100%';
 input.placeholder='Вставьте JSON из nftables_preview.compile';
 const check=add('button','Проверить синтаксис в отдельном netns');
 const checkResult=add('pre');checkResult.style.whiteSpace='pre-wrap';
 check.disabled=!api.graph().nodes.some(n=>n.id==='nftables_lab.check');
 check.onclick=async()=>{try{const x=await api.call('nftables_lab.check',
  {preview:JSON.parse(input.value)});
  checkResult.textContent=JSON.stringify(x,null,2);
 }catch(e){checkResult.textContent='Ошибка: '+e.message;}};
 add('h3','Учебная проверка watchdog');
 const scenario=add('textarea');scenario.rows=8;scenario.style.width='100%';
 scenario.value=JSON.stringify({deadlineMs:200,advanceToMs:250,events:[
  {kind:'syntax_validated',atMs:0},{kind:'arm_rollback',atMs:10},
  {kind:'commit_simulated',atMs:20},{kind:'management_probe_ok',atMs:30}]},null,2);
 const trial=add('button','Симулировать откат');
 const trialResult=add('pre');trialResult.style.whiteSpace='pre-wrap';
 trial.disabled=!api.graph().nodes.some(n=>n.id==='nftables_lab.rollback_trial');
 trial.onclick=async()=>{try{const x=await api.call('nftables_lab.rollback_trial',
  JSON.parse(scenario.value));trialResult.textContent=JSON.stringify(x,null,2);
 }catch(e){trialResult.textContent='Ошибка: '+e.message;}};
}
