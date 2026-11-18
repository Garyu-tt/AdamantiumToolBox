import {strict as assert} from 'node:assert';
import {descriptors,runAgent} from '../apps/claude/agent.mjs';
const old=process.env.ADA_CLAUDE_ALLOWED_ACTIONS;
const graph={nodes:[{id:'memory.search',type:'action'},
 {id:'ops.inspect',type:'action'},{id:'claude.start',type:'action'},{id:'hidden.write',type:'action'}]};
const {tools,index}=descriptors(graph,['memory.search','ops.inspect','claude.start']);
assert.equal(tools.length,2);assert.equal([...index.values()].includes('claude.start'),false);
const name=[...index.entries()].find(([name,id])=>id==='memory.search')[0];
let turns=0,invocations=0;
process.env.ADA_CLAUDE_ALLOWED_ACTIONS='memory.search,ops.inspect,claude.start';
try{
 const result=await runAgent({prompt:'Find relevant memories',tools:true},undefined,{
  api:async(path,body)=>{
   if(path==='/api/graph')return graph;
   assert.equal(path,'/api/invoke');assert.equal(body.action,'memory.search');
   assert.equal(body.params.query,'project');invocations++;return {facts:['read-only context']};
  },
  complete:async({messages,tools:provided})=>{
   assert.equal(provided.length,2);turns++;
   if(turns===1)return {model:'test-claude',usage:{input_tokens:5,output_tokens:3},
    stop_reason:'tool_use',content:[{type:'thinking',thinking:'test',signature:'dummy'},
     {type:'tool_use',id:'tool_123',name,input:{params:{query:'project'}}}]};
   assert.equal(messages[1].content[0].signature,'dummy');
   assert.equal(messages[2].content[0].tool_use_id,'tool_123');
   assert.match(messages[2].content[0].content,/read-only context/);
   return {model:'test-claude',usage:{input_tokens:7,output_tokens:4},
    stop_reason:'end_turn',content:[{type:'text',text:'Memory retrieved.'}]};
  }
 });
 assert.equal(result.content,'Memory retrieved.');
 assert.equal(result.usage.input_tokens,12);assert.equal(invocations,1);
 assert.equal(result.toolCalls[0].action,'memory.search');
 process.env.ADA_CLAUDE_ALLOWED_ACTIONS='hidden.write';
 await assert.rejects(runAgent({prompt:'run',tools:true},undefined,{
  api:async(path)=>{if(path==='/api/graph')return {nodes:[]};throw Error('must_not_invoke');}
 }),/no_authorized_agent_tools/);
 console.log('CLAUDE_AGENT_OK graph discovery, allowlist, tool use, thinking preservation, usage');
}finally{if(old===undefined)delete process.env.ADA_CLAUDE_ALLOWED_ACTIONS;
 else process.env.ADA_CLAUDE_ALLOWED_ACTIONS=old;}
