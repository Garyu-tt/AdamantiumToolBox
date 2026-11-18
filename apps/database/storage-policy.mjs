const cap=16*1024*1024;
export function parseStoragePolicy(raw){
 let candidate;
 if(raw===undefined||raw==='')candidate={schema:'mas-database-policy-1',
  tier:'edge',maxJournalBytes:cap,maxBackups:0,allowWrites:false};
 else{
  try{candidate=JSON.parse(raw);}
  catch{throw Error('invalid_storage_policy_json');}
 }
 if(candidate?.schema!=='mas-database-policy-1'||!['edge','server'].includes(candidate.tier)||
    !Number.isSafeInteger(candidate.maxJournalBytes)||
    candidate.maxJournalBytes<1048576||candidate.maxJournalBytes>1024*1024*1024*64||
    !Number.isInteger(candidate.maxBackups)||candidate.maxBackups<0||candidate.maxBackups>1||
    typeof candidate.allowWrites!=='boolean')throw Error('invalid_storage_policy');
 // Edge cannot silently grow into a full memory replica.
 if(candidate.tier==='edge'&&candidate.maxJournalBytes>64*1024*1024)throw Error('edge_quota_exceeded');
 return Object.freeze({...candidate});
}
