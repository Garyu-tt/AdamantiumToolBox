import {validateGenome} from '../../brain.mjs';
export async function invoke(action,params){
 if(action==='genesis.genome.validate')return validateGenome(params.genome||{});
 throw Error('action_not_found');
}
