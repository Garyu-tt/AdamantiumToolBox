/** R03 operation-ID selector and paired Encode/Decode graph display. */
export async function mountOperationWorkbench({el,root,api,allowed,graphInput}){
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

 return {dispose:()=>{idPanel.onsubmit=null;if(executeButton)executeButton.onclick=null;}};
}
