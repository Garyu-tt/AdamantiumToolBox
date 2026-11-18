import {readFile,stat} from 'node:fs/promises';
const MAX=262144;
export async function loadState(filename){
 if(!filename)throw Error('not_configured');
 const s=await stat(filename);if(!s.isFile()||s.size>MAX)throw Error('invalid_state_file');
 const data=JSON.parse(await readFile(filename,'utf8'));
 if(data?.schema!=='network-fabric-state-v1'||!Array.isArray(data.policies)||
 !Array.isArray(data.approvals)||!data.trust||typeof data.trust!=='object'||
 typeof data.revision!=='string'||data.revision.length>128)throw Error('invalid_state_schema');
 return {revision:data.revision,policies:data.policies,approvals:data.approvals,trust:data.trust};
}
