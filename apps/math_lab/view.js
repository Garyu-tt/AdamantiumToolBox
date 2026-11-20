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

 const graphForm=el('form',root);
 el('h3',graphForm,'Граф обратимых преобразований R02');
 el('p',graphForm,'Сравнение целого закодированного потока с исходными байтами, zlib и корнями. Результат не является независимой приёмкой.');
 const graphLabel=el('label',graphForm,'Байтовый блок (hex)');
 const graphInput=el('textarea',graphLabel);
 graphInput.rows=4;graphInput.maxLength=4096;
 graphInput.placeholder='Hex до 2048 байт';
 const graphActions=el('div',graphForm);graphActions.className='math-lab-controls';
 const useRootSample=el('button',graphActions,'Копировать пример из RootTransform');
 useRootSample.type='button';useRootSample.onclick=()=>{graphInput.value=input.value;};
 const graphButton=el('button',graphActions,'Исследовать цепочки преобразований');
 graphButton.type='submit';graphButton.disabled=!allowed.has('math_lab.search');
 const graphOutput=el('pre',root,'Нет результата поиска графа');
 graphForm.onsubmit=async event=>{
  event.preventDefault();
  if(!allowed.has('math_lab.search'))return;
  graphButton.disabled=true;
  try{
   const report=await api.call('math_lab.search',{
    datasetId:'interactive.graph',
    inputHex:graphInput.value.trim().toLowerCase(),
    maxDepth:2,maxStates:16,maxRootCalls:4,maxRootEvaluations:8
   });
   graphOutput.textContent=JSON.stringify({
    baseline:report.report?.candidates,
    selected:report.report?.selectedMethod,
    totalBytes:report.report?.selectedTotalBytes,
    savedBytes:report.report?.savingsBytes,
    selectedPath:report.report?.chosenSteps,
    states:report.report?.visitedStates,
    evaluatedEdges:report.report?.attemptedEdges,
    exactReferenceReproduction:report.referenceReproduction?.exactByteEquality??null,
    independentAgentReviewed:report.independentAgentReviewed,
    independentQACompleted:report.independentQACompleted
   },null,2);
   status.textContent='Поиск графа завершён. Отдельная организационная QA ещё не проводилась.';
  }catch(err){
   graphOutput.textContent='Ошибка поиска: '+String(err.message).slice(0,180);
  }finally{graphButton.disabled=false;}
 };

 const idWorkbench=el('details',root);
 el('summary',idWorkbench,'Реестр математических операций · Encode ↔ Decode (MLG3)');
 const idIntro=el('p',idWorkbench,'ID и обратные операции загружаются из MAS-каталога; графы строятся сервером по типизированному ABI.');
 const idPanel=el('form',idWorkbench);
 const selectionRow=el('div',idPanel);selectionRow.className='math-lab-controls';
 const stageSelectors=[];
 const selectWithOptions=(parent,label,rows,empty=false)=>{
  const wrap=el('label',parent,label);
  const select=el('select',wrap);
  if(empty){const option=el('option',select,'Пропустить шаг');option.value='';}
  for(const row of rows){
   const opt=el('option',select,'0x'+row.id.toString(16).padStart(4,'0')+' · '+row.key);
   opt.value=String(row.id);
  }
  return select;
 };
 const previewContainer=el('div',idWorkbench);
 const graphReceipt=el('pre',idWorkbench,'Нет выбранной цепочки');
 let currentPlan=null;
 let registry=null;
 let previewButton=null,executeButton=null;
 if(allowed.has('math_lab.operations')&&allowed.has('math_lab.graph')){
  try{
   registry=await api.call('math_lab.operations',{});
   if(registry.abi!=='mechanicus.math-operation-registry/1')
    throw Error('Несовместимая версия реестра');
   const forward=(registry.operations||[]).filter(x=>x.kind==='transform'&&x.direction==='encode');
   const codecs=(registry.operations||[]).filter(x=>x.kind==='codec'&&x.direction==='encode');
   if(!forward.length||!codecs.length)throw Error('Нет проверенных операций');
   for(let i=0;i<3;i++)stageSelectors.push(selectWithOptions(selectionRow,'Операция '+(i+1),forward,true));
   stageSelectors[0].value=String(forward[0].id);
   stageSelectors[1].value=String(forward[2]?.id??'');
   const codec=selectWithOptions(selectionRow,'Конечный кодек',codecs);
   const buttons=el('div',idPanel);buttons.className='math-lab-controls';
   previewButton=el('button',buttons,'Построить Encode/Decode графы');
   previewButton.type='submit';
   executeButton=el('button',buttons,'Кодировать выбранный блок и проверить');
   executeButton.type='button';
   executeButton.disabled=!allowed.has('math_lab.encode');
   const createPlan=()=>({
    operationIds:stageSelectors.map(x=>x.value).filter(Boolean).map(Number),
    codecId:Number(codec.value)
   });
   const lane=(graph,title)=>{
    const block=el('div',previewContainer);block.className='math-lab-graph-lane';
    el('h4',block,title);
    const rail=el('div',block);rail.className='math-lab-graph-rail';
    for(const node of graph.nodes){
     const cell=el('div',rail);cell.className='math-lab-graph-node';
     if(node.operationId===null)el('strong',cell,node.type==='input'?'INPUT':'OUTPUT');
     else{
      el('strong',cell,'0x'+node.operationId.toString(16).padStart(4,'0'));
      el('small',cell,node.key);
     }
     if(node!==graph.nodes.at(-1))el('span',rail,'→');
    }
   };
   const renderPair=pair=>{
    previewContainer.replaceChildren();
    lane(pair.encode,'ENCODE');
    lane(pair.decode,'DECODE');
   };
   const loadGraph=async()=>{
    const desired=createPlan();
    const pair=await api.call('math_lab.graph',desired);
    if(pair.registrySha256!==registry.sha256)throw Error('Версия реестра изменилась');
    currentPlan=desired;
    renderPair(pair);
    graphReceipt.textContent=JSON.stringify({
     registrySha256:pair.registrySha256,
     encodeIds:pair.encode.nodes.filter(n=>n.operationId!==null).map(n=>n.operationId),
     decodeIds:pair.decode.nodes.filter(n=>n.operationId!==null).map(n=>n.operationId),
     executionAuthorized:pair.executionAuthorized
    },null,2);
    return desired;
   };
   idPanel.onsubmit=async event=>{
    event.preventDefault();
    previewButton.disabled=true;
    try{await loadGraph();}
    catch(error){graphReceipt.textContent='Граф отклонён: '+String(error.message).slice(0,180);}
    finally{previewButton.disabled=false;}
   };
   executeButton.onclick=async()=>{
    executeButton.disabled=true;
    try{
     const desired=await loadGraph();
     const encoded=await api.call('math_lab.encode',{
      ...desired,inputHex:graphInput.value.trim().toLowerCase(),
      includeEncoded:true
     });
     const info={
      encodedBytes:encoded.encodedBytes,
      encodedSha256:encoded.encodedSha256,
      decodeGraph:encoded.graphs?.decode.nodes.map(n=>n.operationId).filter(x=>x!==null),
      verifiedBySeparatePermission:false
     };
     if(allowed.has('math_lab.decode')&&encoded.encodedHex){
      const verified=await api.call('math_lab.decode',{encodedHex:encoded.encodedHex});
      info.sourceSha256=verified.sourceSha256;
      info.checksumVerified=verified.checksumVerified;
      info.verifiedBySeparatePermission=true;
     }
     graphReceipt.textContent=JSON.stringify(info,null,2);
    }catch(error){graphReceipt.textContent='Операция отклонена: '+String(error.message).slice(0,180);}
    finally{executeButton.disabled=false;}
   };
  }catch(error){
   graphReceipt.textContent='Каталог недоступен: '+String(error.message).slice(0,180);
  }
 }else{
  graphReceipt.textContent='Нет подтверждённых MAS-разрешений на чтение каталога и построение графов.';
 }

  return {dispose:()=>{form.onsubmit=null;planForm.onsubmit=null;graphForm.onsubmit=null;sample.onclick=null;useRootSample.onclick=null;idPanel.onsubmit=null;if(executeButton)executeButton.onclick=null;}};
}
