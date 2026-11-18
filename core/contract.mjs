const id=/^[a-z][a-z0-9_-]{1,39}$/;
const semver=/^\d+\.\d+\.\d+$/;
export function validateManifest(m){
 if(!m||m.mas!=='1.0'||!id.test(m.id)||!semver.test(m.version))return false;
 if(!m.name||typeof m.name!=='string'||m.name.length>80)return false;
 if(!Number.isInteger(m.service?.port)||m.service.port<1024||m.service.port>65535)return false;
 if(m.service.protocol!=='mas-http-1'||m.lifecycle!=='independent')return false;
 if(m.service.invokeTimeoutMs!==undefined&&(!Number.isInteger(m.service.invokeTimeoutMs)||m.service.invokeTimeoutMs<1000||m.service.invokeTimeoutMs>20000))return false;
 if(!m.icon||!id.test(m.icon)||!Array.isArray(m.permissions))return false;
 if(!m.permissions.every(x=>typeof x==='string'&&/^[a-z0-9_-]+\.[a-z0-9_-]+$/.test(x)))return false;
 if(!m.ui||m.ui.standard!=='mas-ui-1'||!['embedded-and-standalone'].includes(m.ui.mode))return false;
 if(!m.auth||m.auth.mode!=='host-delegated')return false;
 if(!m.events||m.events.schema!=='mas-event-1')return false;
 if(!m.data||m.data.refs!=='mas-ref-1')return false;
 if(!m.updates||m.updates.strategy!=='semver'||!Array.isArray(m.updates.migrations))return false;
 if(m.connections!==undefined){
  if(!Array.isArray(m.connections)||m.connections.length>40)return false;
  for(const c of m.connections){
   if(typeof c.from!=='string'||!c.from.startsWith(m.id+'.'))return false;
   if(typeof c.to!=='string'||!/^([a-z0-9_-]+\.)+[a-z0-9_-]+$/.test(c.to))return false;
   if(!['related','opens','depends','consumes'].includes(c.type))return false;
  }
 }
 return true;
}
export function validateGraph(spec,manifest){
 if(!spec||spec.app!==manifest.id||spec.version!==1||!Array.isArray(spec.nodes)||!Array.isArray(spec.edges))return false;
 const ids=new Set();
 for(const n of spec.nodes){
  if(typeof n.id!=='string'||!n.id.startsWith(manifest.id+'.')||ids.has(n.id))return false;
  if(!['view','action','resource','event'].includes(n.type)||!Array.isArray(n.requires))return false;
  if(!n.requires.every(c=>manifest.permissions.includes(c)))return false;
  if(n.type==='view'&&(!n.title||n.icon!==manifest.icon))return false;
  ids.add(n.id);
 }
 return spec.edges.every(e=>ids.has(e.from)&&ids.has(e.to)&&typeof e.type==='string');
}
