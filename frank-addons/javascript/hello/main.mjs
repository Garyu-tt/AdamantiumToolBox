import {total} from './modules/numbers.mjs';
export async function handle(action,params){
 if(action==='echo')return {echo:params};
 if(action==='sum')return {sum:total(params?.numbers)};
 throw Error('unknown_action');
}
