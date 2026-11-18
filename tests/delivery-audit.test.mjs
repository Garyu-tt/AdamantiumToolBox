import {strict as assert} from 'node:assert';
import {auditSnapshot,proposePort} from '../standards/lifecycle/delivery-audit.mjs';

const read=['demo.read'],hash='a'.repeat(64);
const app=(id,port)=>({id,port,version:'0.3.1',hash,permissions:read,verified:true});
const graphIds=new Set(['noosphere.view','noosphere.status']);
{
 let requests=0;
 const result=await auditSnapshot({bundled:[{id:'graph-manager',port:8896}],
  selected:[app('noosphere',8896)],permissions:read,graphIds,probe:async()=>{requests++;return {app:'graph-manager'};}});
 assert.equal(result.allVerified,false);
 assert.equal(result.results[0].reason,'port_reserved');
 assert.equal(result.results[0].detail,'graph-manager');
 assert.equal(requests,0,'never accept unrelated healthy listener');
}
{
 const result=await auditSnapshot({bundled:[{id:'graph-manager',port:8896}],
  selected:[app('noosphere',9011)],permissions:read,graphIds,
  probe:async()=>({app:'noosphere',version:'0.3.1'})});
 assert.equal(result.allVerified,true);
 assert.equal(result.verifiedCount,1);
 assert.equal(result.results[0].hash,hash);
}
{
 const result=await auditSnapshot({selected:[app('noosphere',9011)],
  permissions:read,graphIds,probe:async()=>({app:'unrelated'})});
 assert.equal(result.results[0].reason,'health_wrong_app');
}
{
 const result=await auditSnapshot({selected:[app('noosphere',9011)],
  permissions:read,graphIds:new Set(),probe:async()=>({app:'noosphere'})});
 assert.equal(result.results[0].reason,'graph_missing');
}
{
 let called=0;
 const result=await auditSnapshot({selected:[app('noosphere',9011)],
  permissions:[],graphIds,probe:async()=>{called++;return {app:'noosphere'};}});
 assert.equal(result.results[0].reason,'missing_owner_permission');
 assert.equal(called,0);
}
{
 const result=await auditSnapshot({selected:[{...app('noosphere',9011),verified:false}],
  permissions:read,graphIds,probe:async()=>({app:'noosphere'})});
 assert.equal(result.results[0].reason,'signature_or_content_unverified');
}
{
 const result=await auditSnapshot({selected:[app('noosphere',9011)],
  permissions:read,graphIds:null,probe:async()=>({app:'noosphere'})});
 assert.equal(result.results[0].state,'partial');
 assert.equal(result.allVerified,false,'do not claim success without authorized graph');
}
{
 const tried=[];
 const port=await proposePort([9000,9001],async candidate=>{tried.push(candidate);return candidate!==9002;});
 assert.equal(port,9003);
 assert.deepEqual(tried,[9002,9003]);
}
console.log('DELIVERY_AUDIT_OK signed selected health-app graph permissions port-gates');
