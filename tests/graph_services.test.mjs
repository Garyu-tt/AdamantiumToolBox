import {strict as assert} from 'node:assert';
import {isIP} from 'node:net';
import {audit,plan} from '../apps/graph_dns/audit.mjs';
import {inspectBatch} from '../apps/noosphere/migration.mjs';
import {digest} from '../apps/noosphere/validate.mjs';
import {compile} from '../apps/composite/compile.js';
const dataset={zones:[{name:'example.test'}],records:[
 {zone:'example.test',name:'@',type:'MX',value:'mail.example.test',priority:10,ttl:300},
 {zone:'example.test',name:'mail',type:'A',value:'192.0.2.10',ttl:300},
 {zone:'example.test',name:'www',type:'TXT',value:'CaseSensitive Payload',ttl:300}],
 bindings:[{hostname:'mail.example.test',ip:'192.0.2.20',role:'mail_in'}]};
const dns=audit(dataset);
assert.equal(dns.summary.zones,1);
assert(dns.issues.some(i=>i.code==='binding_ip_mismatch'));
assert(!dns.issues.some(i=>i.code==='mx_target_without_address'));
assert.equal(plan(dataset).applied,false);
assert(!dns.issues.some(i=>i.code==='invalid_record'));
assert.equal(isIP('192.0.2.10'),4);
const bad=audit({...dataset,records:[...dataset.records,
 {zone:'example.test',name:'www',type:'CNAME',value:'mail.example.test',ttl:300}]});
assert(bad.issues.some(i=>i.code==='cname_conflict'));
const t='2026-11-19T00:00:00Z',payload={text:'A'};
const good={id:'n1',kind:'note',recorded_at:t,observed_at:t,
 payload,refs:[],source:'snapshot:fixture',payload_sha256:digest(payload)};
const migrate=inspectBatch({records:[good,{...good,id:'n2',payload_sha256:'x'},good]});
assert.equal(migrate.manifest.accepted,1);
assert.equal(migrate.manifest.quarantined,2);
assert.equal(migrate.committed,false);
const graph={nodes:[{id:'graph_dns.audit',type:'action'}]};
const spec={schema:'mas-composite-1',groups:[{id:'manage',title:'Operations',items:[
 {action:'graph_dns.audit',label:'Audit DNS'},
 {action:'noosphere.inspect',label:'Audit memory'}]}]};
const comp=compile(spec,graph);
assert.equal(comp.groups[0].items.length,1);
assert.equal(comp.diagnostics.length,1);
assert.equal(comp.executesActions,false);
console.log('GRAPH_SERVICES_OK dns-plan/noosphere-quarantine/composition-filter');
