const slug=/^[a-z][a-z0-9_-]{0,39}$/;
const semver=/^\d+\.\d+\.\d+$/;
const capability=/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/;
export const validSlug=value=>typeof value==='string'&&slug.test(value);
export const validRelativePath=value=>
 typeof value==='string'&&value.length>0&&value.length<=240&&
 !value.includes('\\')&&!value.includes('\0')&&
 value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&/^[a-zA-Z0-9_.-]+$/.test(part));
export function validateFrankAddon(m,language,id){
 if(!m||m.schema!=='frank-addon-1'||m.id!==id||m.language!==language||
  !validSlug(language)||!validSlug(id)||!semver.test(m.version)||
  typeof m.name!=='string'||!m.name||m.name.length>80||
  !validRelativePath(m.entry)||!capability.test(m.adapter)||
  !Array.isArray(m.permissions)||m.permissions.length>64||
  !m.permissions.every(value=>typeof value==='string'&&capability.test(value))||
  m.lifecycle!=='independent')return false;
 if(m.actions!==undefined){
  if(!Array.isArray(m.actions)||m.actions.length>64)return false;
  const ids=new Set();
  for(const action of m.actions){
   if(!action||!validSlug(action.id)||ids.has(action.id)||
    typeof action.title!=='string'||!action.title||action.title.length>80)return false;
   ids.add(action.id);
  }
 }
 return true;
}
