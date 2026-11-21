import {summary} from '../../brain.mjs';
export async function invoke(action,p,store){
 if(action==='genesis.brains.list')return store.list();
 if(action==='genesis.brains.create')return summary(await store.create(p.genome||{}),true);
 if(action==='genesis.brains.inspect')return summary(await store.load(p.id),true);
 throw Error('action_not_found');
}
