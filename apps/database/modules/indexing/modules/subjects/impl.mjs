export async function activate({use}){
 const store=use('storage.graph.store');
 return {actions:{'database.subjects':({namespace,at_seq,limit=100})=>{
  if(!Number.isInteger(limit)||limit<1||limit>500)throw Error('invalid_limit');
  const facts=store.query({namespace,at_seq,limit:500}).facts;
  const subjects=[...new Set(facts.map(f=>f.subject_uid))].slice(0,limit);
  return {subjects,partial:facts.length===500,source:'scan'};
 }}};
}
