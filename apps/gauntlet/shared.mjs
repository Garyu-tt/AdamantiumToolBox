import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {homedir} from 'node:os';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const bundleHash=files=>hash(JSON.stringify(Object.entries(files).sort(([a],[b])=>a<b?-1:a>b?1:0)));
export const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const validTask=value=>typeof value==='string'&&/^[a-zA-Z0-9_.-]{3,80}$/.test(value);
export const stateRoot=()=>process.env.GAUNTLET_STATE_DIR||
 join(process.env.LOCALAPPDATA||process.env.XDG_STATE_HOME||homedir(),'Adamantium Toolbox','gauntlet');
export const publicView=c=>({task_id:c.task_id,plugin_id:c.plugin_id,
 sha256:c.sha256,status:c.status,diagnostic:c.diagnostic||null,
 affected_components:c.affected_components||[],candidate:c.candidate||null,
 delivery:c.delivery||null,attempts:c.attempts,
 spent_usd:c.spent_usd,issues:c.issues||[],history:c.history||[]});
export function limits(){
 const attempts=Number(process.env.GAUNTLET_MAX_ATTEMPTS||3);
 const cost=Number(process.env.GAUNTLET_MAX_COST_USD||20);
 if(!Number.isInteger(attempts)||attempts<1||!Number.isFinite(cost)||cost<0)throw Error('bad_budget');
 return {attempts,cost};
}
