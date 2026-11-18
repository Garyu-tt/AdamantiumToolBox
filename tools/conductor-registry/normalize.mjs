const safeId=/^[a-z][a-z0-9_-]{1,39}$/;
const validVersion=/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;
const sortStrings=arr=>[...new Set(arr.filter(x=>typeof x==='string'))].sort();

export function normalize(scan,at){
 const records=[],errors=[];
 for(const item of scan.raw){
  if(item.invalid){errors.push({type:item.invalid,path:item.path});continue;}
  const m=item.data;
  if(!safeId.test(m.id)||!validVersion.test(m.version)||
     (item.kind==='frank'&&!safeId.test(m.language))){
   errors.push({type:'invalid_manifest_identity',path:item.path,hash:item.hash});continue;
  }
  const uid=item.kind==='mas'?`mas:${m.id}`:`frank:${m.language}:${m.id}`;
  const evidence={kind:scan.source.type,uri:scan.source.uri,ref:scan.source.ref,
   path:item.path,sha256:item.hash,observed_at:at};
  const permissions=sortStrings(Array.isArray(m.permissions)?m.permissions:[]);
  const depends=sortStrings(Array.isArray(m.dependencies)?m.dependencies:[]);
  const requirements=sortStrings(Array.isArray(m.requires)?m.requires:[]);
  const claims=sortStrings(Array.isArray(m.capabilities)?m.capabilities:[]);
  const record={uid,kind:item.kind,id:m.id,language:item.kind==='frank'?m.language:null,
   name:m.name||null,version:m.version,source_state:scan.source.type,
   runtime_state:'unknown',validation_state:'structural_only',manifest:evidence,
   declared:{permissions,dependencies:depends,requirements,capabilities:claims,
    port:item.kind==='mas'?(m.service?.port??null):null,
    adapter:item.kind==='frank'?(m.adapter??null):null,
    connections:Array.isArray(m.connections)?m.connections:[],
    modules:Array.isArray(m.modules)?m.modules:[]},
   field_sources:Object.fromEntries(['name','version','permissions','requires','capabilities',
    'dependencies','service','adapter','connections','modules'].filter(k=>m[k]!==undefined).map(k=>[k,evidence]))};
  records.push(record);
 }
 records.sort((a,b)=>a.uid.localeCompare(b.uid)||a.manifest.path.localeCompare(b.manifest.path));
 return {records,errors};
}