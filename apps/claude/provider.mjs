export function configured(){return Boolean(process.env.ANTHROPIC_API_KEY&&process.env.ADA_CLAUDE_MODEL&&process.env.ADA_CLAUDE_API_URL);}
export function endpoint(){
 if(!configured())throw Error('claude_not_configured');
 const u=new URL(process.env.ADA_CLAUDE_API_URL);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('claude_endpoint_requires_https');
 return u.href;
}
export async function exchange({messages,system,tools},signal=undefined,fetcher=fetch){
 if(!Array.isArray(messages)||!messages.length||messages.length>64)throw Error('invalid_messages');
 if(system!==undefined&&(typeof system!=='string'||system.length>20000))throw Error('invalid_system');
 const maxTokens=Number(process.env.ADA_CLAUDE_MAX_TOKENS||8192);
 if(!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>128000)throw Error('invalid_max_tokens');
 const request={model:process.env.ADA_CLAUDE_MODEL,max_tokens:maxTokens,messages};
 if(system)request.system=system;
 if(Array.isArray(tools)&&tools.length)request.tools=tools;
 const thinking=process.env.ADA_CLAUDE_THINKING_MODE;
 if(thinking==='adaptive')request.thinking={type:'adaptive'};
 else if(thinking==='enabled'){
  const budget=Number(process.env.ADA_CLAUDE_THINKING_BUDGET||16384);
  if(!Number.isInteger(budget)||budget<1024||budget>=maxTokens)throw Error('invalid_thinking_budget');
  request.thinking={type:'enabled',budget_tokens:budget};
 }else if(thinking&&thinking!=='off')throw Error('invalid_thinking_mode');
 const timeout=Number(process.env.ADA_CLAUDE_TIMEOUT_MS||600000);
 if(!Number.isInteger(timeout)||timeout<1000||timeout>3600000)throw Error('invalid_timeout');
 const response=await fetcher(endpoint(),{method:'POST',headers:{'Content-Type':'application/json',
  'x-api-key':process.env.ANTHROPIC_API_KEY,
  'anthropic-version':process.env.ADA_CLAUDE_API_VERSION||'2023-06-01'},
  body:JSON.stringify(request),signal:AbortSignal.any([AbortSignal.timeout(timeout),signal||new AbortController().signal])});
 if(!response.ok)throw Error('claude_upstream_'+response.status);
 const data=await response.json();
 if(!Array.isArray(data.content))throw Error('invalid_provider_response');
 return data;
}
export async function generate(p,signal=undefined,fetcher=fetch){
 if(typeof p.prompt!=='string'||!p.prompt.trim()||p.prompt.length>100000)throw Error('invalid_prompt');
 const data=await exchange({messages:[{role:'user',content:p.prompt}],system:p.system},signal,fetcher);
 return {status:'completed',content:data.content.filter(x=>x.type==='text').map(x=>x.text).join('\n'),
  model:data.model,usage:data.usage,stopReason:data.stop_reason};
}
