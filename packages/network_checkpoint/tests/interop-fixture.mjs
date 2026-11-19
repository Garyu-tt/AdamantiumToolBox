import {join,resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {sign} from 'node:crypto';
import {Journal} from '../../network_approval/lib/journal.mjs';
import {message,revokeMessage} from '../../network_approval/lib/contract.mjs';
import {setup,crypt,free,stop,spawnService,writeConfig,invoke,pub} from './fixture.mjs';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const approval=join(root,'packages/network_checkpoint/service.mjs');
const witness=join(root,'packages/network_witness/service.mjs');
export const key='checkpoint-test-internal-key-long';
const request=(expiresAt)=>({schema:'network-approval-request-v1',id:'ab'.repeat(16),
 flow:{source:'approval',destination:'destination',principal:'operator',protocol:'tcp',port:22},
 revision:'rev1',expiresAt});
export async function environment(){const f=await setup(),tls=await crypt();let ledger=null,receiver=null,source=null,w=null;
 const witnessPort=await free(),receiverPort=await free(),sourcePort=await free();
 const receiverConfig=join(f.dir,'receiver-config.json'),sourceConfig=join(f.dir,'source-config.json');
 try{
  ledger=await new Journal(f.ledgerPath,f.ledgerTrust).start();
  w=await spawnService(witness,{ADA_INTERNAL_KEY:key,ADA_CAPS:'network_witness.read,network_witness.write',
   NETWORK_WITNESS_LOG:f.witnessLog,NETWORK_WITNESS_TRUST:f.witnessTrustPath,NETWORK_WITNESS_KEY:f.witnessKey},witnessPort);
  await writeConfig(receiverConfig,{schema:'network-checkpoint-config-v1',mode:'receiver',receiver:{
   listenHost:'127.0.0.1',listenPort:receiverPort,serverCertFile:tls.serverCert,serverKeyFile:tls.serverKey,
   caFile:tls.caCert,clientSpkiSha256:tls.clientPin,journalId:'approval',witnessId:'remote_witness',
   localWitnessUrl:'http://127.0.0.1:'+witnessPort+'/'}});
  receiver=await spawnService(approval,{ADA_INTERNAL_KEY:key,ADA_CAPS:'network_checkpoint.read,network_checkpoint.receive,network_witness.read,network_witness.write',
   NETWORK_CHECKPOINT_CONFIG:receiverConfig},await free());
  await writeConfig(sourceConfig,{schema:'network-checkpoint-config-v1',mode:'source',source:{
   ledgerPath:f.ledgerPath,receiptPath:join(f.dir,'witness-receipt-cache.json'),keyPath:f.sourceKey,publicKey:pub(f.source),journalId:'approval',keyId:'approval-key'},witness:{
   id:'remote_witness',publicKey:pub(f.witness),url:'https://localhost:'+receiverPort+'/',serverSpkiSha256:tls.serverPin,
   caFile:tls.caCert,clientCertFile:tls.clientCert,clientKeyFile:tls.clientKey}});
  source=await spawnService(approval,{ADA_INTERNAL_KEY:key,ADA_CAPS:'network_checkpoint.read,network_checkpoint.deliver',
   NETWORK_CHECKPOINT_CONFIG:sourceConfig},sourcePort);
  return {f,tls,ledger,source,receiver,w,witnessPort,receiverPort,sourcePort,sourceConfig,
   stop:async()=>{await Promise.all([stop(source),stop(receiver),stop(w)]);await ledger?.close();await tls.remove();await f.remove();},
   grant:async()=>{const req=request(new Date(Date.now()+120000).toISOString());
    const proof={side:'source',keyId:'approval-key',signature:sign(null,message(req,'source'),f.source.privateKey).toString('base64')};
    const a=await ledger.mutate({expectedRevision:ledger.head,event:{type:'propose',at:new Date().toISOString(),request:req,proof}});
    return {req,a};},
   endorse:async req=>{const proof={side:'destination',keyId:'destination-key',
     signature:sign(null,message(req,'destination'),f.destination.privateKey).toString('base64')};
    return ledger.mutate({expectedRevision:ledger.head,event:{type:'endorse',at:new Date().toISOString(),id:req.id,proof}});},
   revoke:async req=>{const proof={side:'source',keyId:'approval-key',signature:sign(null,revokeMessage(req,'source','owner_withdrawal'),f.source.privateKey).toString('base64')};
    return ledger.mutate({expectedRevision:ledger.head,event:{type:'revoke',at:new Date().toISOString(),id:req.id,proof,reason:'owner_withdrawal'}});}
  };
 }catch(e){await Promise.all([stop(source),stop(receiver),stop(w)]);await ledger?.close();await tls.remove();await f.remove();throw e;}
}

