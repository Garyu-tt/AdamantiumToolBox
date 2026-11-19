import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {validate} from '../packages/mcp_bridge/config.mjs';
const key=()=>generateKeyPairSync('ed25519').publicKey.export({format:'pem',type:'spki'});
test('node registry rejects insecure endpoints and malformed pins',()=>{
 const base={schema:'adamantium.bridge.nodes.v1',nodes:[]};
 assert.deepEqual(validate(base),[]);
 const node={id:'node_x',approved:true,urls:['https://x.example/'],tokenEnv:'ADA_TOKEN',allow:[]};
 assert.throws(()=>validate({...base,nodes:[{...node,approved:false}]}),/unapproved_node/);
 assert.throws(()=>validate({...base,nodes:[{...node,urls:['http://10.0.0.2/']}]}),/https_required/);
 assert.throws(()=>validate({...base,nodes:[{...node,urls:['https://x.example/secret']}]}),/unsafe_endpoint/);
 assert.throws(()=>validate({...base,nodes:[{...node,identity:{id:'wrong',publicKey:key()}}]}),/invalid_mesh_identity/);
 assert.throws(()=>validate({...base,nodes:[{...node,identity:{id:randomUUID(),publicKey:'fake'}}]}),/invalid_mesh_identity/);
 assert.equal(validate({...base,nodes:[node]})[0].identity,null);
 assert.equal(validate({...base,nodes:[{...node,identity:{id:randomUUID(),publicKey:key()}}]})[0].identity.publicKey.includes('PUBLIC KEY'),true);
});
