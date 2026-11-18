import {grow,integrate,retarget} from '../../brain.mjs';
export async function invoke(action,p,store){
 if(action==='genesis.brains.grow')return store.change(p.id,b=>grow(b,p));
 if(action==='genesis.brains.integrate')return store.change(p.id,b=>integrate(b,p));
 if(action==='genesis.brains.retarget')return store.change(p.id,b=>retarget(b,p));
 throw Error('action_not_found');
}
