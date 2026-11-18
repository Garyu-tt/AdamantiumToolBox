import {strict as assert} from 'node:assert';
import {configured,endpoint,generate} from '../apps/claude/provider.mjs';
const saved={};for(const x of ['ANTHROPIC_API_KEY','ADA_CLAUDE_MODEL','ADA_CLAUDE_API_URL',
 'ADA_CLAUDE_THINKING_MODE','ADA_CLAUDE_THINKING_BUDGET','ADA_CLAUDE_MAX_TOKENS'])saved[x]=process.env[x];
try{
 delete process.env.ANTHROPIC_API_KEY;assert.equal(configured(),false);
 process.env.ANTHROPIC_API_KEY='fake-local-test-key';
 process.env.ADA_CLAUDE_MODEL='operator-selected-model';
 process.env.ADA_CLAUDE_API_URL='https://test.invalid/messages';
 process.env.ADA_CLAUDE_MAX_TOKENS='4096';
 process.env.ADA_CLAUDE_THINKING_MODE='enabled';
 process.env.ADA_CLAUDE_THINKING_BUDGET='2048';
 assert(configured());assert.equal(endpoint(),'https://test.invalid/messages');
 const result=await generate({prompt:'Hello'},undefined,async(url,request)=>{
  assert.equal(url,'https://test.invalid/messages');
  const body=JSON.parse(request.body);
  assert.equal(body.model,'operator-selected-model');assert.equal(body.thinking.budget_tokens,2048);
  assert.equal(body.messages[0].content,'Hello');
  return new Response(JSON.stringify({content:[{type:'text',text:'World'}],model:body.model,
   usage:{input_tokens:2,output_tokens:4},stop_reason:'end_turn'}),{status:200});
 });
 assert.equal(result.content,'World');assert.equal(result.status,'completed');
 process.env.ADA_CLAUDE_API_URL='http://test.invalid/messages';assert.throws(endpoint,/https/);
}finally{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
console.log('CLAUDE_OK configuration, HTTPS, thinking, request, mock response');
