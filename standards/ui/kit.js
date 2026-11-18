/** MAS UI Kit 1: apps receive the same accessible controls and theme tokens. */
export function element(tag,parent,attrs={}){
 const node=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){
  if(key==='text')node.textContent=value;
  else if(key==='className')node.className=value;
  else node.setAttribute(key,String(value));
 }
 parent.append(node);return node;
}
export function button(parent,label,click,cls=''){
 const n=element('button',parent,{text:label,className:'mas-button '+cls});
 n.type='button';n.onclick=click;return n;
}
export function input(parent,label,value,change){
 const row=element('label',parent,{className:'mas-field'});
 element('span',row,{text:label});
 const n=element('input',row,{type:'text',value});
 n.onchange=()=>change(n.value);return n;
}
export function select(parent,label,value,items,change){
 const row=element('label',parent,{className:'mas-field'});
 element('span',row,{text:label});
 const n=element('select',row);
 for(const {value:v,title} of items){
  const o=element('option',n,{text:title,value:v});o.selected=v===value;
 }
 n.onchange=()=>change(n.value);return n;
}
export function event(kind,subject,ref,payload={}){
 if(!/^[a-z0-9._-]+$/.test(kind))throw Error('invalid_event_kind');
 return {schema:'mas-event-1',id:crypto.randomUUID(),kind,subject,ref,time:new Date().toISOString(),payload};
}
