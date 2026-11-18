import {openStore} from '../../../../store.mjs';
export async function activate({dataDir}){
 const store=await openStore(dataDir);
 return {services:{'storage.graph.store':store},actions:{
  'database.status':()=>store.status(),
  'database.query':p=>store.query(p),
  'database.history':p=>store.history(p),
  'database.transact':p=>store.transact(p)
 }};
}
