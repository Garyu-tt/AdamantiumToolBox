import {createPublicKey, verify} from 'node:crypto';

// Policy verification is READ-ONLY. No routing or firewall change is authorized by this result.
// An approval signs exactly this canonical payload, anchored in a locally pinned trust store.
export const SIDES = Object.freeze(['source', 'destination']);
const fields = Object.freeze(['source', 'destination', 'principal', 'protocol', 'port']);
const defined = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;
const active = (record, now) => defined(record?.expiresAt) && Number.isFinite(Date.parse(record.expiresAt)) && Date.parse(record.expiresAt) > now;
const baseEqual = (a, b) => fields.every((k) => a?.[k] === b[k]);
export const validFlow = (flow) => flow && typeof flow === 'object' &&
  defined(flow.source) && defined(flow.destination) && flow.source !== flow.destination &&
  defined(flow.principal) && ['tcp', 'udp', 'icmp'].includes(flow.protocol) &&
  Number.isInteger(flow.port) && flow.port >= 0 && flow.port <= 65535 &&
  (flow.protocol === 'icmp' ? flow.port === 0 : flow.port >= 1);
export function approvalPayload(a) {
  // All relevant fields and expiration are bound by the Ed25519 signature.
  return Buffer.from(JSON.stringify({schema:'network-fabric-approval-v1',side:a.side,
    source:a.source,destination:a.destination,principal:a.principal,
    protocol:a.protocol,port:a.port,revision:a.revision,
    keyId:a.keyId,expiresAt:a.expiresAt}), 'utf8');
}
export function verifyApproval(a, trust, now) {
  if (!a || !SIDES.includes(a.side) || !defined(a.revision) || !active(a, now) ||
      !defined(a.keyId) || typeof a.signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(a.signature)) return false;
  const pinned=trust?.[a.side];
  if (!pinned || !defined(pinned.keyId) || pinned.keyId !== a.keyId || !defined(pinned.publicKey)) return false;
  try {
    const key=createPublicKey(pinned.publicKey);
    return key.asymmetricKeyType === 'ed25519' &&
      verify(null, approvalPayload(a), key, Buffer.from(a.signature, 'base64'));
  } catch {return false;}
}
function independentPins(trust) {
  try {
    const a=trust?.source?.publicKey, b=trust?.destination?.publicKey;
    if (typeof a!=='string' || typeof b!=='string') return true; // missing pins fail in verifyApproval
    const source=createPublicKey(a),destination=createPublicKey(b);
    if(source.asymmetricKeyType!=='ed25519'||destination.asymmetricKeyType!=='ed25519')return false;
    return !source.export({type:'spki',format:'der'}).equals(destination.export({type:'spki',format:'der'}));
  } catch { return false; }
}
export function evaluateAccess({flow, policies, approvals, trust, now=Date.now()}) {
  const errors=[];
  if (!validFlow(flow)) return {allowed:false,reasons:['invalid_flow'],simulationOnly:true};
  if (!Array.isArray(policies) || !Array.isArray(approvals) || !Number.isFinite(now) ||
      !trust || typeof trust !== 'object') return {allowed:false,reasons:['invalid_policy_state'],simulationOnly:true};
  if (!independentPins(trust)) return {allowed:false,reasons:['bilateral_identity_not_independent'],simulationOnly:true};
  for (const side of SIDES) {
    const match=policies.filter(p => p?.side === side && baseEqual(p,flow) && active(p,now));
    if(match.some(p=>p.effect==='deny')) {errors.push(side+'_explicit_deny');continue;}
    const grants=match.filter(p=>p.effect==='allow' && defined(p.revision));
    if(grants.length!==1) {errors.push(side+(grants.length?'_ambiguous_allow':'_no_allow'));continue;}
    const accepted=approvals.filter(a=>a?.side===side && baseEqual(a,flow) &&
      a.revision===grants[0].revision && verifyApproval(a,trust,now));
    if(accepted.length!==1) errors.push(side+'_approval_unverified_or_ambiguous');
  }
  return {allowed:errors.length===0,reasons:errors,simulationOnly:true};
}
