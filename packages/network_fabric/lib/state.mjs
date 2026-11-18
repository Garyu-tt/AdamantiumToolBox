import {stat,readFile} from 'node:fs/promises';
import {sanitizeTopology} from './topology.mjs';
const MAX=262144;
// Only operator-provisioned local state can contain policies/approvals and pinned public keys.
// A missing state file yields an empty, deny-by-default graph.
export async function loadState(path) {
 if(!path)return {revision:'unconfigured',nodes:[],links:[],policies:[],approvals:[],trust:{}};
 const s=await stat(path);if(!s.isFile() || s.size>MAX)throw Error('state_invalid');
 const source=JSON.parse(await readFile(path,'utf8'));
 if(source?.schema!=='network-fabric-state-v1'||!Array.isArray(source.policies)||
    !Array.isArray(source.approvals)||!source.trust||typeof source.trust!=='object')throw Error('state_schema');
 // State reads validate topology before exposing anything.
 sanitizeTopology(source);
 return source;
}
