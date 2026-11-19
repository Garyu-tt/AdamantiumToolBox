/**
 * Mechanicus R07 — an opt-in, server-only signed read snapshot issuer.
 * No socket, daemon, signing-key generation or task mutation is included.
 *
 * Production MUST inject an operator-approved Ed25519 signer, a persistent
 * atomic sequence allocator and an authenticated Core read callback.
 */
import {createHash,sign,KeyObject} from 'node:crypto';
import {collectTaskSnapshot} from './read_source.mjs';

export const SIGNED_SNAPSHOT_SCHEMA='mechanicus.orchestration-signed-snapshot/1';
const ID=/^[a-z][a-z0-9._:-]{0,127}$/;
const TTL_MS=120_000;
const MAX_SIZE=768*1024;
function checkId(value,name){
 if(typeof value!=='string'||!ID.test(value))throw new TypeError('Invalid '+name);
 return value;
}
const positive=value=>Number.isSafeInteger(value)&&value>=1;
export class TaskSnapshotPublisher{
 #key;#keyId;#streamId;#taskOwner;#reserveSequence;#ttl;
 constructor({signingKey,keyId,streamId,expectedTaskOwner,reserveSequence,ttlMs=TTL_MS}={}){
  if(!(signingKey instanceof KeyObject)||signingKey.type!=='private'||
   signingKey.asymmetricKeyType!=='ed25519')throw new TypeError('Explicit approved Ed25519 signer required');
  if(typeof reserveSequence!=='function')throw new TypeError('Atomic persistent sequence allocator required');
  if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>300000)throw new TypeError('Invalid TTL');
  this.#key=signingKey;
  this.#keyId=checkId(keyId,'signing key ID');
  this.#streamId=checkId(streamId,'stream ID');
  this.#taskOwner=checkId(expectedTaskOwner,'Task Pool source identity');
  this.#reserveSequence=reserveSequence;
  this.#ttl=ttlMs;
 }
 async publish({visibleCoreGraph,readAction,now=Date.now()}={}){
  if(!Number.isSafeInteger(now)||now<1)throw new TypeError('Invalid trusted publisher clock');
  const issuedAt=new Date(now).toISOString();
  // Do not burn an epoch or sign an empty-but-invented queue when source
  // cannot be read. Caller must distinguish unavailable from real [].
  const preview=await collectTaskSnapshot({
   visibleCoreGraph,expectedOwner:this.#taskOwner,readAction,
   revision:1,observedAt:issuedAt
  });
  if(preview.status!=='read-only')return Object.freeze({
   status:preview.status,envelope:null,partial:true,authorizedExecution:false
  });
  // The injected allocator MUST be CAS/durable and never issue the same
  // number twice across restarts, concurrent processes or ambiguous failures.
  const sequence=await this.#reserveSequence({
   streamId:this.#streamId,issuerProviderId:this.#taskOwner
  });
  if(!positive(sequence))throw new TypeError('Invalid reserved sequence');
  const snapshot={...preview.snapshot,revision:sequence};
  const payload={
   schema:SIGNED_SNAPSHOT_SCHEMA,streamId:this.#streamId,
   sequence,revision:sequence,issuerProviderId:this.#taskOwner,
   issuedAt,expiresAt:new Date(now+this.#ttl).toISOString(),snapshot
  };
  const body=Buffer.from(JSON.stringify(payload),'utf8');
  if(body.length>MAX_SIZE)throw new RangeError('Signed snapshot too large');
  const signature=sign(null,body,this.#key);
  const envelope=Object.freeze({
   keyId:this.#keyId,algorithm:'Ed25519',
   payloadBase64:body.toString('base64'),
   signatureBase64:signature.toString('base64')
  });
  return Object.freeze({
   status:'signed-read-only',envelope,partial:true,
   taskCount:preview.taskCount,sequence,
   digest:createHash('sha256').update(body).digest('hex'),
   authorizedExecution:false,graphMutationAuthorized:false
  });
 }
}
