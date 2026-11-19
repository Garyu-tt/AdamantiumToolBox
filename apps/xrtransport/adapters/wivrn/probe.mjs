import {readFile,readdir} from 'node:fs/promises';
export async function probe(config,descriptor){
 if(process.platform!=='linux')return {state:'unsupported_platform'};
 const expected=new Set((descriptor.processNames||[]).filter(x=>
  typeof x==='string'&&x.length>0&&x.length<=32));
 if(!expected.size)return {state:'invalid_adapter_descriptor'};
 let entries;
 try{entries=await readdir('/proc',{withFileTypes:true});}
 catch{return {state:'process_table_unavailable'};}
 let count=0;
 for(const item of entries){
  if(!item.isDirectory()||!/^\d+$/.test(item.name)||++count>10000)continue;
  try{
   const name=(await readFile('/proc/'+item.name+'/comm','utf8')).trim();
   if(expected.has(name))return {state:'process_observed',process:name,
    observed_at:new Date().toISOString(),streaming:'unverified'};
  }catch{}
 }
 return {state:'not_running'};
}
