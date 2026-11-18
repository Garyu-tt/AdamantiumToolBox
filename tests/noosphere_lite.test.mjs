import {strict as assert} from 'node:assert';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from '../apps/noosphere_lite/mcp.mjs';
const home=await mkdtemp(join(tmpdir(),'mas-memory-mcp-'));
const mock=join(home,'mock.mjs');
const source=String.raw`let pending='';
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{
 pending+=chunk;let n;while((n=pending.indexOf('\n'))>=0){
  const line=pending.slice(0,n);pending=pending.slice(n);if(!line.trim())continue;
  const msg=JSON.parse(line);if(!msg.id)continue;
  const data=msg.method==='initialize'?{protocolVersion:'2024-11-05',capabilities:{tools:{}},
    serverInfo:{name:'test',version:'1'}}:msg.method==='tools/list'?{tools:[
    {name:'memory_search'},{name:'memory_read'},{name:'memory_add'}]}:
   msg.method==='tools/call'?{content:[{type:'text',text:JSON.stringify({
    name:msg.params.name,arguments:msg.params.arguments})}]}:{};
  process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result:data})+'\n');
 }
});
`;
try{
 await writeFile(mock,source);
 const config={command:process.execPath,args:[mock],env:{PATH:process.env.PATH||''}};
 const tools=await request(null,{},config);
 assert.deepEqual(tools.tools,['memory_search','memory_read']);
 const hit=await request('memory_search',{query:'mechanicus',limit:3},config);
 assert.equal(hit.name,'memory_search');assert.equal(hit.arguments.query,'mechanicus');
 const record=await request('memory_read',{memory_id:'abc'},config);
 assert.equal(record.name,'memory_read');assert.equal(record.arguments.memory_id,'abc');
 await assert.rejects(request('memory_add',{body:'should fail'},config),/mcp_tool_denied/);
 await assert.rejects(request('memory_search',{query:'x'},null),/mcp_not_configured/);
 console.log('NOOSPHERE_LITE_OK MCP initialize/list/call, read-only gateway, no live memory');
}finally{await rm(home,{recursive:true,force:true});}
