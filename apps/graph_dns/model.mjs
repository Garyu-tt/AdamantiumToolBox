import {isIP} from 'node:net';
const types=new Set(['A','AAAA','CNAME','MX','TXT','NS','CAA','SRV','PTR','TLSA','DS','DNSKEY']);
const host=x=>typeof x==='string'&&x.length<=253&&/^[a-z0-9*_.-]+\.?$/i.test(x);
export const name=x=>String(x||'').trim().toLowerCase().replace(/\.$/,'');
export function inspect(input){
 if(!input||!Array.isArray(input.zones)||input.zones.length>500||!Array.isArray(input.records)||input.records.length>5000)throw Error('invalid_dataset');
 const issues=[],nodes=[],edges=[],zones=new Set();
 for(const z of input.zones){
  const zone=name(z.name);
  if(!host(zone)||!zone.includes('.')||zones.has(zone)){
   issues.push({code:'invalid_or_duplicate_zone',zone});continue;
  }
  zones.add(zone);nodes.push({id:'zone:'+zone,type:'zone',label:zone});
 }
 const rows=[],byName=new Map(),seen=new Set();
 for(const [i,r] of input.records.entries()){
  const zone=name(r.zone),label=name(r.name),type=String(r.type||'').toUpperCase();
  const fqdn=label==='@'?zone:label.endsWith('.'+zone)||label===zone?label:label+'.'+zone;
  if(!zones.has(zone)||!(label==='@'||host(label))||!types.has(type)||typeof r.value!=='string'||r.value.length>4096){
   issues.push({code:'invalid_record',index:i});continue;
  }
  if(!Number.isInteger(r.ttl)||r.ttl<30||r.ttl>604800){issues.push({code:'invalid_ttl',index:i});continue;}
  if((type==='A'||type==='AAAA')&&isIP(r.value)!==(type==='A'?4:6)){
   issues.push({code:'invalid_ip',index:i});continue;
  }
  if(['MX','CNAME','NS','PTR'].includes(type)&&!host(name(r.value))){issues.push({code:'invalid_target',index:i});continue;}
  if(type==='MX'&&(!Number.isInteger(r.priority)||r.priority<0||r.priority>65535)){
   issues.push({code:'invalid_mx_priority',index:i});continue;
  }
  const key=[fqdn,type,r.value,r.priority??''].join('|');
  if(seen.has(key)){issues.push({code:'duplicate_record',index:i});continue;}seen.add(key);
  const item={...r,sourceIndex:i,zone,fqdn,type,value:['MX','CNAME','NS','PTR'].includes(type)?name(r.value):r.value};
  rows.push(item);byName.set(fqdn,[...(byName.get(fqdn)||[]),item]);
  const id='rr:'+i;nodes.push({id,type:'record',label:type+' '+fqdn});
  edges.push({from:'zone:'+zone,to:id,type:'contains'});
 }
 return {issues,nodes,edges,rows,byName,zones};
}
