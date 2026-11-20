/**
 * Math Lab R01 — host-delegated MAS UI. No direct fetch, no secrets, no raw
 * HTML injection. Existing Core graph controls which actions are available.
 */
export async function mount(host,api){
 const el=(tag,parent,content)=>{
  const node=document.createElement(tag);
  if(content!==undefined)node.textContent=content;
  parent.append(node);return node;
 };
 const style=el('link',host);
 style.rel='stylesheet';
 style.href=new URL('./view.css',import.meta.url).href;
 const root=el('section',host);root.className='math-lab';
 el('h2',root,'Mechanicus Math Lab');
 el('p',root,'Математический исследовательский отдел: гипотезы, эксперименты, измерение MDL, проверка. Первый полигон — точное сжатие.');
 const status=el('p',root);status.setAttribute('role','status');
 const permitted=()=>{
  const graph=typeof api.graph==='function'?api.graph():{nodes:[]};
  return new Set((graph.nodes||[]).filter(n=>n.type==='action').map(n=>n.id));
 };
 const allowed=permitted();
 const disciplines=el('details',root);
 el('summary',disciplines,'Направления исследования и научные роли');
 const list=el('ul',disciplines);
 if(allowed.has('math_lab.catalog')){
  try{
   const catalog=await api.call('math_lab.catalog',{});
   for(const title of catalog.disciplines||[])el('li',list,title);
   el('p',disciplines,'Приоритет: compression · далее ALT, GENESIS, Noosphere, графовый мозг.');
   el('p',disciplines,'Роли: '+(catalog.researchRoles||[]).join(' · '));
  }catch{el('p',disciplines,'Каталог исследовательских направлений недоступен.');}
 }else el('p',disciplines,'Нет подтверждённого разрешения math_lab.read.');
 const planning=el('details',root);
 el('summary',planning,'Научный граф исследования');
 const planForm=el('form',planning);
 const researchIdLabel=el('label',planForm,'Идентификатор гипотезы');
 const researchId=el('input',researchIdLabel);researchId.value='roots001';
 const claimLabel=el('label',planForm,'Проверяемая гипотеза');
 const claim=el('input',claimLabel);claim.value='Входные блоки с точными степенями могут иметь короткие обратимые описания';
 const planButton=el('button',planForm,'Сформировать научный DAG');
 planButton.type='submit';
 planButton.disabled=!allowed.has('math_lab.plan');
 const planOutput=el('pre',planning,'Нет предложенного плана');
 planForm.onsubmit=async event=>{
  event.preventDefault();
  if(!allowed.has('math_lab.plan'))return;
  planButton.disabled=true;
  try{
   const result=await api.call('math_lab.plan',{
    schema:'mechanicus.math-hypothesis/1',
    id:researchId.value.trim().toLowerCase(),
    title:'Исследование точного сжатия корнями',
    target:'compression',discipline:'number-theory',
    method:'root-transform',
    datasetId:'unassigned.demo',
    claim:claim.value.trim(),
    sourceRefs:[]
   });
   planOutput.textContent=JSON.stringify({
    planId:result.planId,sha256:result.digest,
    status:result.proposedOnly?'proposed':'unknown',
    independentQACompleted:result.independentQACompleted,
    nodes:result.nodes.map(n=>({
     id:n.id,role:n.role,phase:n.phase,
     predecessors:n.dependsOn,
     needsEvidence:n.evidenceRequired,
     requiresApproval:n.requiresOperatorApproval===true
    }))
   },null,2);
  }catch(error){planOutput.textContent='План отклонён: '+String(error.message).slice(0,180);}
  finally{planButton.disabled=false;}
 };
 const form=el('form',root);
 el('h3',form,'Эксперимент RootTransform');
 el('label',form,'Двоичный блок (hex, максимум 2048 байт)');
 const input=el('textarea',form);input.rows=4;input.placeholder='Введите hex-байты. Входной блок не сохраняется в Lab.';
 const controls=el('div',form);controls.className='math-lab-controls';
 const sample=el('button',controls,'Пример: 10^1000');
 sample.type='button';
 sample.onclick=()=>{
  let hex=(10n**1000n).toString(16);
  if(hex.length%2)hex='0'+hex;
  input.value=hex;
 };
 const degreeLabel=el('label',controls,'Проверяемые степени');
 const degree=el('input',degreeLabel);degree.value='2,3,4,8,16,1000';
 const modelLabel=el('label',controls,'Стоимость модели, байты');
 const modelCost=el('input',modelLabel);modelCost.type='number';modelCost.min='0';modelCost.max='1000000';modelCost.value='0';
 const button=el('button',form,'Запустить точный эксперимент');
 button.type='submit';
 const output=el('pre',root,'Нет результатов');
 const hasRun=allowed.has('math_lab.experiment');
 button.disabled=!hasRun;
 if(!hasRun)status.textContent='math_lab.experiment недоступен по разрешениям. Просмотр каталога не даёт права запуска.';
 else status.textContent='Тестовый режим, ограниченный CPU. Это не приёмка в production.';
 form.onsubmit=async event=>{
  event.preventDefault();
  if(!hasRun)return;
  button.disabled=true;status.textContent='Выполняется ограниченный математический тест…';
  try{
   const degrees=degree.value.split(',').map(s=>Number(s.trim()));
   if(!degrees.length||degrees.length>16||degrees.some(k=>!Number.isSafeInteger(k)||k<2)){
    throw Error('Укажите до 16 целых степеней, начиная со второй.');
   }
   const result=await api.call('math_lab.experiment',{
    datasetId:'interactive.lab',
    inputHex:input.value.trim().toLowerCase(),
    degrees,maxDepth:2,maxEvaluations:40,
    rootModelBytes:Number(modelCost.value),zlibModelBytes:0
   });
   const selected=(result.candidates||[]).find(c=>c.method===result.selected);
   output.textContent=JSON.stringify({
    digest:result.experimentDigest,
    originalBytes:result.originalBytes,
    entropyBitsPerByte:result.entropyBitsPerByte,
    method:result.selected,totalBytes:result.selectedTotalBytes,
    savingsBytes:result.savingsBytes,
    candidates:result.candidates,
    evaluations:result.search?.evaluated,
    exactRoundtrip:result.verification?.exactRootRoundtrip,
    independentAudit:result.verification?.independentAudit
   },null,2);
   status.textContent='Эксперимент завершён. Декодер проверен, независимая QA ещё не проведена.';
  }catch(error){
   status.textContent='Исследование не выполнено: '+String(error.message).slice(0,180);
  }finally{button.disabled=false;}
 };
 return {dispose:()=>{form.onsubmit=null;planForm.onsubmit=null;sample.onclick=null;}};
}
