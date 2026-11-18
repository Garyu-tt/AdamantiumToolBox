import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
const digest=x=>createHash('sha256').update(x).digest('hex');
const literal=(x,f)=>typeof x==='string'&&isIP(x)===f&&
 !x.includes('%')&&x.length<=64;
const port=x=>Number.isInteger(x)&&x>0&&x<=65535;
export function compileLabScript(preview){
 if(!preview||preview.schema!=='nftables-intent-preview-1'||
    preview.applied!==false||preview.safeToApply!==false||
    preview.proposedBackend?.attachedToKernel!==false||
    !Array.isArray(preview.candidate)||preview.candidate.length>1024)
  throw Error('invalid_preview');
 const lines=new Set();
 for(const rule of preview.candidate){
  if(!rule||!['ip','ip6'].includes(rule.addressFamily)||
     !['tcp','udp'].includes(rule.protocol)||rule.verdict!=='accept'||
     !port(rule.destinationPort))throw Error('invalid_rule');
  const family=rule.addressFamily==='ip'?4:6;
  if(!literal(rule.sourceAddress,family)||!literal(rule.destinationAddress,family))
   throw Error('invalid_ip');
  lines.add([rule.addressFamily,rule.sourceAddress,rule.destinationAddress,
   rule.protocol,String(rule.destinationPort)].join(' '));
 }
 const ordered=[...lines].sort(),fingerprint=digest(ordered.join('\n'));
 const table='ada_lab_'+fingerprint.slice(0,12);
 const script=['add table inet '+table,'add chain inet '+table+' verify'];
 for(const item of ordered){
  const [family,source,dest,proto,dport]=item.split(' ');
  script.push('add rule inet '+table+' verify '+family+' saddr '+source+' '+
   family+' daddr '+dest+' '+proto+' dport '+dport+' accept');
 }
 const text=script.join('\n')+'\n';
 if(Buffer.byteLength(text)>131072)throw Error('script_limit');
 return {schema:'nftables-lab-script-1',script:text,sha256:digest(text),
  candidateCount:ordered.length,table,namespaceBound:false,applied:false};
}
