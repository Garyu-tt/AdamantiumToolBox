import {resolve,join,parse,isAbsolute} from 'node:path';
import {createPrivateKey,createPublicKey} from 'node:crypto';
import {ZERO,sha,checkAnchorIdentity,checkAnchorReceipts,verifyPublicAnchor} from './proof.mjs';
import {fail,allowed,ident,required,regular} from './file-io.mjs';
import {attestInStore} from './signer.mjs';
export function openFactoryAnchor({root,anchorPin,sourcePin,ledgerId,
 allowSigning=false}={}){
 if(!isAbsolute(required(root,'root')))fail('factory_anchor_absolute_root_required');
 const folder=resolve(root);
 if(folder===parse(folder).root)fail('factory_anchor_root_forbidden');
 if(!allowed.test(anchorPin||'')||!allowed.test(sourcePin||'')||
   !ident.test(ledgerId||''))fail('factory_anchor_trust_not_provisioned');
 return new FactoryAnchorStore({folder,anchorPin,sourcePin,ledgerId,allowSigning});
}
class FactoryAnchorStore{
 constructor({folder,anchorPin,sourcePin,ledgerId,allowSigning}){
  this.root=folder;this.anchorPin=anchorPin;this.sourcePin=sourcePin;
  this.ledgerId=ledgerId;this.allowSigning=allowSigning===true;
 }
 async load(){
  const root=this.root;
  const [identityJSON,pem,log]=await Promise.all([
   regular(join(root,'anchor-identity.json'),4096),
   regular(join(root,'anchor-public.pem'),4096),
   regular(join(root,'anchor.jsonl'),3*1024*1024)
  ]);
  let identity;
  try{identity=JSON.parse(identityJSON);}catch{fail('anchor_identity_invalid_json');}
  const key=checkAnchorIdentity(identity,pem,{
   anchorPin:this.anchorPin,sourcePin:this.sourcePin,ledgerId:this.ledgerId
  });
  const chain=checkAnchorReceipts(log,{identity,publicKey:key});
  return {identity,pem,log,chain,key};
 }
 async status(){
  const state=await this.load();
  if(this.allowSigning){
   const pem=await regular(join(this.root,'anchor-private.pem'),4096);
   const key=createPrivateKey(pem);
   if(key.asymmetricKeyType!=='ed25519'||
     sha(createPublicKey(key).export({type:'spki',format:'pem'}).toString())!==this.anchorPin)
    fail('factory_anchor_signing_key_not_ready');
  }
  return {
   schema:'adamantium.factory_anchor.status/1',
   configured:true,app:'factory_anchor',version:'0.1.0',
   anchorId:state.identity.anchorId,
   anchorKeyFingerprint:this.anchorPin,sourceKeyFingerprint:this.sourcePin,
   ledgerId:this.ledgerId,
   checkpoints:state.chain.receipts.length,
   latestReceiptHash:state.chain.latest?.receiptHash||ZERO,
   latestSourceSequence:state.chain.latest?.sourceSequence??null,
   signingConfigured:this.allowSigning,
   // A local process cannot attest its own independent operator identity.
   independentHostValidated:false,
   masApprovalGranted:false,productionPublished:false,enforcement:false
  };
 }
 async latest(){
  const state=await this.load();
  return {
   schema:'adamantium.factory_anchor.latest/1',
   attestation:state.chain.latest,
   anchorPublicPem:state.pem,
   anchorIdentity:state.identity,
   signingPrivateKeyExposed:false,
   grantsMAS:false,productionPublished:false
  };
 }
 async inspect({bundle}={}){
  const state=await this.load();
  try{
   return verifyPublicAnchor({
    bundle,anchorIdentity:state.identity,anchorPublicPem:state.pem,
    anchorJSONL:state.log,ledgerId:this.ledgerId,
    anchorPin:this.anchorPin,sourcePin:this.sourcePin
   });
  }catch(e){
   if(e?.code==='anchor_checkpoint_absent')
    return {schema:'adamantium.factory_anchor.verification/1',
     status:'unanchored',anchorReceiptHash:ZERO,
     masApprovalGranted:false,productionPublished:false,enforcement:false};
   throw e;
  }
 }
 async attest(params={}){return attestInStore(this,params);}
}
