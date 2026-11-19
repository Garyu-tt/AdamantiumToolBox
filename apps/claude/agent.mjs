import {call} from './client.mjs';
import {exchange,generate} from './provider.mjs';
export function descriptors(graph,approved){
 const allow=new Set(approved);
 const matched=(graph?.nodes||[]).filter(n=>n.type==='action'&&allow.has(n.id)&&!n.id.startsWith('claude.'));
 const selected=matched.slice(0,32).sort((a,b)=>a.id.localeCompare(b.id));
 const index=new Map();
 const tools=selected.map((n,i)=>{
  const name='mas_capability_'+(i+1);index.set(name,n.id);
  return {name,description:'Invoke authorized Adamantium capability '+n.id,
   input_schema:{type:'object',properties:{params:{type:'object'}},required:['params'],additionalProperties:false}};
 });
 return {tools,index};
}
export async function discover(api=call){
 const allowed=(process.env.ADA_CLAUDE_ALLOWED_ACTIONS||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(!allowed.length)return {tools:[],index:new Map()};
 return descriptors(await api('/api/graph'),allowed);
}
export async function runAgent(p,signal,{api=call,complete=exchange,plain=generate}={}){
 if(typeof p.prompt!=='string'||!p.prompt.trim()||p.prompt.length>100000)throw Error('invalid_prompt');
 if(p.tools!==true)return plain(p,signal);
 const {tools,index}=await discover(api);
 if(!tools.length)throw Error('no_authorized_agent_tools');
 const maxTurns=Number(process.env.ADA_CLAUDE_AGENT_TURNS||8);
 const maxCalls=Number(process.env.ADA_CLAUDE_AGENT_CALLS||16);
 if(!Number.isInteger(maxTurns)||maxTurns<1||maxTurns>32||
  !Number.isInteger(maxCalls)||maxCalls<1||maxCalls>64)throw Error('invalid_agent_budget');
 const messages=[{role:'user',content:p.prompt}],calls=[];
 const usage={input_tokens:0,output_tokens:0};let model;
 for(let turn=0;turn<maxTurns;turn++){
  if(signal?.aborted)throw Error('cancelled');
  const response=await complete({messages,system:p.system,tools},signal);
  model=response.model;
  usage.input_tokens+=response.usage?.input_tokens||0;
  usage.output_tokens+=response.usage?.output_tokens||0;
  if(response.stop_reason!=='tool_use'){
   if(response.stop_reason==='max_tokens')throw Error('claude_output_truncated');
   return {status:'completed',content:response.content.filter(x=>x.type==='text').map(x=>x.text).join('\n'),
    model,usage,stopReason:response.stop_reason,toolCalls:calls};
  }
  const requests=response.content.filter(x=>x.type==='tool_use');
  if(!requests.length||calls.length+requests.length>maxCalls)throw Error('agent_tool_limit');
  messages.push({role:'assistant',content:response.content});
  const results=[];
  for(const tool of requests){
   if(signal?.aborted)throw Error('cancelled');
   const action=index.get(tool.name);
   let result,is_error=false;
   try{
    if(!action||!tool.input||typeof tool.input.params!=='object'||tool.input.params===null||
     Array.isArray(tool.input.params))throw Error('invalid_tool_request');
    result=await api('/api/invoke',{action,params:tool.input.params},signal);
   }catch(e){is_error=true;result={error:String(e.message).slice(0,140)};}
   calls.push({action:action||'unknown',status:is_error?'failed':'completed'});
   const data=JSON.stringify(result),content=data.length>12000?data.slice(0,12000)+' [truncated]':data;
   results.push({type:'tool_result',tool_use_id:tool.id,content,is_error});
  }
  messages.push({role:'user',content:results});
 }
 throw Error('agent_turn_limit');
}
