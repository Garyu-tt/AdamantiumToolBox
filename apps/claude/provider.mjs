export function configured(){return Boolean(process.env.ANTHROPIC_API_KEY&&process.env.ADA_CLAUDE_MODEL&&process.env.ADA_CLAUDE_API_URL);}
export function endpoint(){
 if(!configured())throw Error('claude_not_configured');
 const u=new URL(process.env.ADA_CLAUDE_API_URL);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('claude_endpoint_requires_https');
 return u.href;
}
export async function generate(p,signal=undefined,fetcher=fetch){
 if(typeof p.prompt!=='string'||!p.prompt.trim()||p.prompt.length>100000)throw Error('invalid_prompt');
 if(p.system!==undefined&&(typeof p.system!=='string'||p.system.length>20000))throw Error('invalid_system');
 const maxTokens=Number(process.env.ADA_CLAUDE_MAX_TOKENS||8192);
 if(!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>128000)throw Error('invalid_max_tokens');
 const message={model:process.env.ADA_CLAUDE_MODEL,max_tokens:maxTokens,
  messages:[{role:'user',content:p.prompt}]};
 if(p.system)message.system=p.system;
 const thinking=process.env.ADA_CLAUDE_THINKING_MODE;
 if(thinking==='adaptive')message.thinking={type:'adaptive'};
 else if(thinking==='enabled'){
  const budget=Number(process.env.ADA_CLAUDE_THINKING_BUDGET||16384);
  if(!Number.isInteger(budget)||budget<1024||budget>=maxTokens)throw Error('invalid_thinking_budget');
  message.thinking={type:'enabled',budget_tokens:budget};
 }else if(thinking&&thinking!=='off')throw Error('invalid_thinking_mode');
 const timeout=Number(process.env.ADA_CLAUDE_TIMEOUT_MS||600000);
 if(!Number.isInteger(timeout)||timeout<1000||timeout>3600000)throw Error('invalid_timeout');
 const response=await fetcher(endpoint(),{method:'POST',headers:{'Content-Type':'application/json',
  'x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
  body:JSON.stringify(message),signal:AbortSignal.any([AbortSignal.timeout(timeout),signal||new AbortController().signal])});
 if(!response.ok)throw Error('claude_upstream_'+response.status);
 const data=await response.json();
 if(!Array.isArray(data.content))throw Error('invalid_provider_response');
 return {status:'completed',content:data.content.filter(x=>x.type==='text').map(x=>x.text).join('\n'),
  model:data.model,usage:data.usage,stopReason:data.stop_reason};
}
