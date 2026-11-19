import {validateValue} from './schema.mjs';
export async function invokeTyped({doc,spec},handlers,action,params={}){
 if(typeof action!=='string'||!spec.nodes.some(n=>n.type==='action'&&n.id===action))
  throw Error('capability_unavailable');
 let descriptor;
 const find=nodes=>{
  for(const m of nodes){
   for(const p of m.provides||[])if(p.id===action){descriptor=p;return;}
   find(m.children||[]);if(descriptor)return;
  }
 };
 find(doc.modules);
 if(!descriptor||!Object.hasOwn(handlers,action)||
  typeof handlers[action]!=='function')throw Error('capability_unavailable');
 if(!validateValue(descriptor.input,params))throw Error('input_invalid');
 let result;
 try{result=await handlers[action](params);}
 catch{throw Error('handler_failed');}
 if(!validateValue(descriptor.output,result))throw Error('output_invalid');
 return result;
}
