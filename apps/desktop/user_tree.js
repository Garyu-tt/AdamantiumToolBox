import {customItems} from './state.js';
/** Compose user folders without changing the readonly LinkFS navigation. */
export function userFolder(state,id,views){
 const folder=state.items.find(x=>x.id===id&&x.kind==='folder');
 if(!folder)return null;
 function expand(parent,seen){
  return customItems(state,parent,views).map(item=>{
   if(item.type!=='folder')return item;
   if(seen.has(item.id))return {...item,children:[]};
   return {...item,children:expand(item.id,new Set([...seen,item.id]))};
  });
 }
 return {...folder,type:'folder',children:expand(id,new Set([id]))};
}
export function rootLinks(tree){
 return (tree||[]).map(item=>({
  ...item,id:'base:'+encodeURIComponent(item.type+':'+(item.view||item.name))
 }));
}
