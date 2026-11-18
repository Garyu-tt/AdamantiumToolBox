const id=/^[a-z][a-z0-9_-]{1,39}$/;
const semver=/^\d+\.\d+\.\d+$/;
const capver=/^\d+\.\d+$/;
const capability=/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;
export function validateModule(m,dir){
 if(!m||m.mas!=='1.0'||m.kind!=='module'||m.id!==dir||!id.test(m.id)||!semver.test(m.version))return false;
 if(!['in-process','dedicated'].includes(m.isolation)||!['independent','container'].includes(m.lifecycle))return false;
 if(m.entry!==null&&m.entry!==undefined&&!/^[a-z][a-z0-9_-]*\.mjs$/.test(m.entry))return false;
 if(!Array.isArray(m.provides)||!Array.isArray(m.requires)||!Array.isArray(m.events))return false;
 if(!m.requires.every(x=>x&&typeof x.name==='string'&&capability.test(x.name)&&capver.test(x.version)))return false;
 if(!m.provides.every(x=>x&&typeof x.name==='string'&&capability.test(x.name)&&capver.test(x.version)&&
  (!x.action||(capability.test(x.action)&&['read','write'].includes(x.operation)&&
  typeof x.permission==='string'&&capability.test(x.permission)))&&
  (!x.permission||capability.test(x.permission))&&(x.action||x.operation===undefined)))return false;
 if(new Set(m.provides.map(x=>x.name)).size!==m.provides.length)return false;
 if(!m.events.every(x=>typeof x==='string'&&capability.test(x)))return false;
 if(m.settings!==undefined&&(typeof m.settings!=='object'||Array.isArray(m.settings)||m.settings===null))return false;
 return m.lifecycle==='container'||typeof m.entry==='string';
}
