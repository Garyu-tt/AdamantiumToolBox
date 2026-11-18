import {topology,capabilities,invoke} from './network.mjs';
const schema={type:'object',properties:{},additionalProperties:false};
const tools=[
 {name:'adamantium_nodes',description:'List discovered approved Adamantium nodes and availability; read-only.',inputSchema:schema,annotations:{readOnlyHint:true}},
 {name:'adamantium_capabilities',description:'Query current capability graph across nodes. Unknown or absent actions are not callable.',inputSchema:{type:'object',properties:{node_id:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'adamantium_invoke',description:'Call one approved action by exact node ID and discovered capability ID. May mutate state; requires approval.',inputSchema:{type:'object',properties:{node_id:{type:'string'},action:{type:'string'},params:{type:'object'}},required:['node_id','action'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:true}}
];
const versions=['2025-03-26','2025-06-18','2025-11-25'];
const error=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
export async function dispatch(p){
 if(!p||p.jsonrpc!=='2.0'||typeof p.method!=='string')return error(p?.id??null,-32600,'invalid_request');
 const id=p.id??null;
 if(p.method==='notifications/initialized')return null;
 if(id===null)return error(null,-32600,'id_required');
 const result=async()=>{
  if(p.method==='initialize'){const requested=p.params?.protocolVersion;
   return {protocolVersion:versions.includes(requested)?requested:versions.at(-1),capabilities:{tools:{}},serverInfo:{name:'adamantium-mcp-bridge',version:'0.1.0'}};}
  if(p.method==='ping')return {};
  if(p.method==='tools/list')return {tools};
  if(p.method==='tools/call'){
   const {name,arguments:a={}}=p.params||{};
   let value;if(name==='adamantium_nodes')value=await topology();
   else if(name==='adamantium_capabilities')value=await capabilities(a.node_id);
   else if(name==='adamantium_invoke')value=await invoke(a.node_id,a.action,a.params||{});
   else throw Error('unknown_tool');
   return {content:[{type:'text',text:JSON.stringify(value)}],isError:false};
  }
  throw Error('method_not_found');
 };
 try{return {jsonrpc:'2.0',id,result:await result()};}
 catch(e){return p.method==='tools/call'?{jsonrpc:'2.0',id,result:{content:[{type:'text',text:String(e.message).slice(0,160)}],isError:true}}:
  error(id,-32601,String(e.message).slice(0,160));}
}
