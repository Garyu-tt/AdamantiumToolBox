import {step,train} from '../../brain.mjs';
export async function invoke(action,p,store){
 if(action==='genesis.brains.step')return store.change(p.id,b=>step(b,p));
 if(action==='genesis.brains.train')return store.change(p.id,b=>train(b,p));
 throw Error('action_not_found');
}
