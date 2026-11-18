import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
export function configuration(){
 const command=process.env.ADA_NS_MCP_COMMAND;
 if(!command)return null;
 if(typeof command!=='string'||command.length>1024)throw Error('invalid_mcp_command');
 let args=[];try{args=JSON.parse(process.env.ADA_NS_MCP_ARGS||'[]');}
 catch{throw Error('invalid_mcp_args');}
 if(!Array.isArray(args)||args.length>20||args.some(x=>typeof x!=='string'||x.length>1024))
  throw Error('invalid_mcp_args');
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>
  ['PATH','HOME','USERPROFILE','SYSTEMROOT','TEMP','TMP','TMPDIR','LANG','PYTHONPATH','VIRTUAL_ENV'].includes(k)||
  k.startsWith('NSL_')));
 return {command,args,env};
}
export async function request(name,params={},config=configuration()){
 if(!config)throw Error('mcp_not_configured');
 if(name&&!['memory_search','memory_read'].includes(name))throw Error('mcp_tool_denied');
 const child=spawn(config.command,config.args,{env:config.env,stdio:['pipe','pipe','ignore'],
  shell:false,windowsHide:true});
 let next=0,bytes=0,closed=false;const pending=new Map();
 const rejectAll=reason=>{closed=true;for(const [id,p] of pending){clearTimeout(p.timer);p.reject(reason);}
  pending.clear();};
 child.on('error',e=>rejectAll(Error('mcp_process_error')));
 child.on('exit',()=>rejectAll(Error('mcp_process_exited')));
 child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>2000000){
  rejectAll(Error('mcp_response_limit'));child.kill();}});
 const reader=createInterface({input:child.stdout,crlfDelay:Infinity});
 reader.on('line',line=>{try{
  const msg=JSON.parse(line),p=pending.get(msg.id);if(!p)return;
  pending.delete(msg.id);clearTimeout(p.timer);
  if(msg.error)p.reject(Error('mcp_rpc_error'));else p.resolve(msg.result);
 }catch{rejectAll(Error('mcp_invalid_json'));child.kill();}});
 function send(method,arguments_){
  if(closed)return Promise.reject(Error('mcp_closed'));
  const id=++next;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('mcp_timeout'));child.kill();},17000);
   pending.set(id,{resolve,reject,timer});
   child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params:arguments_})+'\n');
  });
 }
 try{
  await send('initialize',{protocolVersion:'2024-11-05',capabilities:{},
   clientInfo:{name:'adamantium-noosphere-lite',version:'0.1.0'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const found=await send('tools/list',{});
  const names=new Set((found.tools||[]).map(x=>x.name));
  if(!name)return {tools:[...names].filter(x=>['memory_search','memory_read'].includes(x))};
  if(!names.has(name))throw Error('mcp_tool_missing');
  const result=await send('tools/call',{name,arguments:params});
  if(result?.isError)throw Error('mcp_tool_failed');
  const text=(result?.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
  if(text.length>64000)throw Error('memory_result_too_large');
  if(result?.structuredContent!==undefined)return result.structuredContent;
  try{return JSON.parse(text);}catch{return {text};}
 }finally{reader.close();child.kill();for(const p of pending.values())clearTimeout(p.timer);
  pending.clear();}
}
