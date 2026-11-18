const e=(tag,text,parent)=>{
 const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;
};
export async function showCodeMap(host,rpc){
 e('p','L0: проект · L1: контракты · L2: полный файл',host);
 const layout=e('div',undefined,host);layout.className='codemap-layout';
 const list=e('div',undefined,layout),detail=e('div',undefined,layout);
 list.className='codemap-list';detail.className='codemap-detail';
 const map=await rpc('/api/codemap?level=0');
 e('small',map.files.length+' файлов · хеши SHA256',list);
 for(const entry of map.files){
  const b=e('button',entry.file,list);b.className='codemap-file';
  b.onclick=async()=>{
   detail.replaceChildren();e('h3',entry.file,detail);
   const l1=await rpc('/api/codemap?level=1&file='+encodeURIComponent(entry.file)+'&sha='+entry.sha256);
   e('small',l1.language+' · '+l1.lines+' строк · '+l1.sha256,detail);
   const pre=e('pre',JSON.stringify({imports:l1.imports,symbols:l1.symbols,calls:l1.calls},null,2),detail);
   pre.className='codemap-meta';
   const button=e('button','Открыть полный исходник (L2)',detail);
   button.onclick=async()=>{
    const l2=await rpc('/api/codemap?level=2&file='+encodeURIComponent(entry.file)+'&sha='+entry.sha256);
    const source=e('pre',l2.source,detail);source.className='codemap-source';
    button.disabled=true;
   };
  };
 }
}
