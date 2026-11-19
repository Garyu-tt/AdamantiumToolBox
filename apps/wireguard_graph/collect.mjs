import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {isAbsolute} from 'node:path';
import {parseWireguardEvidence} from './parse.mjs';
const invoke=promisify(execFile);
export async function captureWireguard(options={}){
 const executable=options.executable??process.env.ADA_WG_READONLY_CLI;
 const now=options.nowSeconds??Math.floor(Date.now()/1000);
 const unavailable=code=>({schema:'wireguard-graph-snapshot-1',
  status:'unavailable',issues:[{code,impact:'peer_inventory_missing',
   remediation:'configure a verified read-only WireGuard inventory provider'}],
  peers:[],graph:{nodes:[],edges:[]},peerIdentityVerified:false,
  meshAuthorizationVerified:false,routingVerified:false,canApply:false,readOnly:true});
 if(typeof executable!=='string'||!isAbsolute(executable))
  return unavailable('approved_wireguard_cli_not_configured');
 const run=options.run||((args)=>invoke(executable,args,{
  shell:false,timeout:3000,maxBuffer:262144,windowsHide:true}).then(x=>x.stdout));
 try{
  const allowedIps=await run(['show','all','allowed-ips']);
  const latestHandshakes=await run(['show','all','latest-handshakes']);
  const snapshot=parseWireguardEvidence({allowedIps,latestHandshakes,nowSeconds:now});
  return {...snapshot,status:'observed',scope:'local_wg_cli_context',
   evidence:['allowed-ips','latest-handshakes']};
 }catch{return unavailable('wireguard_readonly_probe_failed');}
}
