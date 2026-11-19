// Public, transport-independent response parser. No private source or credentials.
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const exact = (obj,keys) => object(obj) &&
 Object.keys(obj).sort().join('|') === [...keys].sort().join('|');
const id = v => typeof v === 'string' && /^[a-z][a-z0-9._-]{1,63}$/.test(v);
const semver = v => typeof v === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(v);
const sha = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const unavailable = () => Object.freeze({available:false});

export function normalizeSourceResult(kind,message) {
 const r = object(message) ? message.result : null;
 if (!object(r) || r.allowed !== true) return unavailable();
 if (kind === 'resolve') {
  if (!exact(r,['allowed','artifact']) || !exact(r.artifact,['id','version','sha256','bytes']))
   return unavailable();
  const a=r.artifact;
  if (!id(a.id) || !semver(a.version) || !sha(a.sha256) ||
      !Number.isSafeInteger(a.bytes) || a.bytes < 1 || a.bytes > 131072)
   return unavailable();
  return Object.freeze({available:true,id:a.id,version:a.version,
   sha256:a.sha256,bytes:a.bytes});
 }
 if (kind === 'stage') {
  if (!exact(r,['allowed','artifact_ref','bytes']) ||
      typeof r.artifact_ref !== 'string' || !r.artifact_ref.startsWith('sha256:') ||
      !sha(r.artifact_ref.slice(7)) ||
      !Number.isSafeInteger(r.bytes) || r.bytes < 1 || r.bytes > 131072)
   return unavailable();
  return Object.freeze({available:true,artifact_ref:r.artifact_ref,bytes:r.bytes});
 }
 return unavailable();
}
