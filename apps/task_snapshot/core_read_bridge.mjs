/**
 * R08: optional, read-only bridge between an authenticated MAS Core session
 * and the R07 Task Pool signed snapshot publisher.
 *
 * Not a network client or MCP replacement. Session creation, the pinned
 * Ed25519 Mesh proof, HTTPS transport and Core permission filtering belong
 * exclusively to the approved operator connector. No invented node/URL.
 */
const SHA256=/^[0-9a-f]{64}$/;
const ID=/^[a-z][a-z0-9._:-]{0,127}$/;
const MAX_AGE_MS=30_000,MAX_FUTURE_SKEW_MS=5_000;
function reject(message){throw new TypeError('R08 trusted Core read: '+message);}
function identity(id,label){
 if(typeof id!=='string'||!ID.test(id))reject('invalid '+label);
 return id;
}
const sameObject=(v)=>v!==null&&typeof v==='object'&&!Array.isArray(v);

/**
 * A Core session MUST have independently verified the operator-pinned Mesh
 * peer identity. This function checks the returned attestation, but is NOT
 * a substitute for the transport's cryptographic signature verification.
 */
export function assertCoreReadAttestation(attestation,expected,{now=Date.now()}={}){
 if(!sameObject(attestation))reject('missing attestation');
 if(!sameObject(expected))reject('missing pinned expectation');
 for(const key of ['nodeId','peerFingerprint','policySha256']){
  if(typeof expected[key]!=='string'||!expected[key])reject('unpinned '+key);
 }
 identity(expected.nodeId,'expected node');
 identity(attestation.nodeId,'attested node');
 if(!SHA256.test(expected.peerFingerprint)||!SHA256.test(expected.policySha256)){
  reject('invalid pinned SHA256 fingerprint/policy');
 }
 if(attestation.authenticated!==true||attestation.identityVerified!==true){
  reject('Mesh identity not independently authenticated');
 }
 if(attestation.nodeId!==expected.nodeId||
    attestation.peerFingerprint!==expected.peerFingerprint||
    attestation.policySha256!==expected.policySha256){
  reject('node identity or authorized policy mismatch');
 }
 // Read-only standby is explicitly diagnostic, not a substitute Core with
 // permission to invoke Task Pool actions.
 if(attestation.status!=='reachable'||attestation.canInvoke!==true){
  reject('source is not reachable/invocable under pinned policy');
 }
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(attestation.verifiedAt)||
    attestation.verifiedAt>now+MAX_FUTURE_SKEW_MS||
    now-attestation.verifiedAt>MAX_AGE_MS){
  reject('stale/future Mesh attestation');
 }
 return Object.freeze({nodeId:attestation.nodeId,verifiedAt:attestation.verifiedAt,
   policySha256:attestation.policySha256,readAuthorized:true});
}

/**
 * Creates a single-call read pipeline; only the operator-approved connector
 * knows how to obtain a trusted session:
 *
 * session.attest(): {authenticated,identityVerified,nodeId,
 *                    peerFingerprint,policySha256,status,canInvoke,verifiedAt}
 * session.readGraph(): Core GET /api/graph value {version:1,nodes,edges}
 * session.invokeRead(action,{limit:200}): Core result {result:[task rows]}
 * session.close(): dispose the network connection, not a server process.
 */
export class VerifiedTaskSnapshotBridge{
 #createSession;#publisher;#node;#owner;#busy=false;
 constructor({createSession,publisher,expectedCore,expectedTaskOwner}={}){
  if(typeof createSession!=='function')reject('authorized session factory required');
  if(!sameObject(publisher)||typeof publisher.publish!=='function'){
   reject('R07 publisher required');
  }
  identity(expectedTaskOwner,'expected task owner');
  // The operator must explicitly pin every peer datum, not just an IP.
  assertCoreReadAttestation({
    authenticated:true,identityVerified:true,nodeId:expectedCore?.nodeId,
    peerFingerprint:expectedCore?.peerFingerprint,
    policySha256:expectedCore?.policySha256,status:'reachable',
    canInvoke:true,verifiedAt:0
  },expectedCore,{now:0});
  this.#createSession=createSession;
  this.#publisher=publisher;
  this.#node=Object.freeze({...expectedCore});
  this.#owner=expectedTaskOwner;
 }
 async publish({now=Date.now()}={}){
  if(this.#busy)reject('concurrent snapshots require a single publisher');
  if(!Number.isSafeInteger(now)||now<1)reject('invalid trusted clock');
  this.#busy=true;
  let session;
  try{
    session=await this.#createSession();
    if(!sameObject(session)||
       typeof session.attest!=='function'||
       typeof session.readGraph!=='function'||
       typeof session.invokeRead!=='function'||
       typeof session.close!=='function'){
      reject('missing approved Core session interface');
    }
    const validate=async()=>assertCoreReadAttestation(
      await session.attest(),this.#node,{now}
    );
    const peer=await validate();
    const graph=await session.readGraph();
    if(!sameObject(graph)||graph.version!==1||!Array.isArray(graph.nodes)||
       !Array.isArray(graph.edges)||graph.nodes.length>4096||graph.edges.length>32768){
      reject('untrusted or invalid permission-filtered Core graph');
    }
    // The graph identifies available actions; it does NOT grant rights to
    // call any other action. Every invocation still goes through MAS Core.
    const readAction=async(action,params)=>{
      if(action!==this.#owner+'.list'||!sameObject(params)||
         params.limit!==200||Object.keys(params).length!==1){
        reject('attempt to invoke a non-list or unbounded action');
      }
      await validate();
      const response=await session.invokeRead(action,Object.freeze({limit:200}));
      if(!sameObject(response)||!Array.isArray(response.result)){
        reject('invalid Core read response envelope');
      }
      return response.result;
    };
    const result=await this.#publisher.publish({
      visibleCoreGraph:graph,readAction,now
    });
    if(!sameObject(result)||!['signed-read-only','source-not-visible','source-read-failed'].includes(result.status)){
      reject('unexpected publisher state');
    }
    return Object.freeze({
      status:result.status,
      nodeId:peer.nodeId,
      sourceOwner:this.#owner,
      partial:true,
      signed:result.status==='signed-read-only',
      sequence:result.sequence??null,
      envelope:result.envelope??null,
      // Safe for local observability; no URL, cookie, bearer, secret or
      // application write handle escapes this boundary.
      authorizedExecution:false,
      graphMutationAuthorized:false
    });
  } finally {
    this.#busy=false;
    if(session&&typeof session.close==='function')await session.close();
  }
 }
}
