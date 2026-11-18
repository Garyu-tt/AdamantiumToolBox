import test from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../apps/mcp_bridge/config.mjs';
test('node registry denies unapproved or insecure endpoints',async()=>{
 const base={schema:'adamantium.bridge.nodes.v1',nodes:[]};
 assert.deepEqual(validate(base),[]);
 assert.throws(()=>validate({...base,nodes:[{id:'node_x',approved:false,urls:['https://x.example/'],tokenEnv:'ADA_TOKEN',allow:[]}]}),/unapproved_node/);
 assert.throws(()=>validate({...base,nodes:[{id:'node_x',approved:true,urls:['http://10.0.0.2/'],tokenEnv:'ADA_TOKEN',allow:[]}]}),/https_required/);
 assert.throws(()=>validate({...base,nodes:[{id:'node_x',approved:true,urls:['https://x.example/secret'],tokenEnv:'ADA_TOKEN',allow:[]}]}),/unsafe_endpoint/);
});
