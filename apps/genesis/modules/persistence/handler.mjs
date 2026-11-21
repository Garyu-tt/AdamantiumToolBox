import {summary} from '../../brain.mjs';
export async function invoke(action,p,store){
 if(action==='genesis.brains.snapshot')return store.snapshot(p.id);
 if(action==='genesis.brains.fork')return summary(await store.fork(p.id,p.snapshotId),true);
 throw Error('action_not_found');
}
