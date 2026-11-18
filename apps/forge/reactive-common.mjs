// Forge R07 shared structural contracts. No host authority or persistent cursor.
export const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export const tok=x=>typeof x==='string'&&x.length>0&&x.length<=128;
export const ref=x=>tok(x)&&/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z][a-z0-9_-]{1,39})+$/.test(x);
export const problem=(code,reason,path,impact,remedy)=>({code,reason,
 evidence:{path},impact,remedies:[{action:remedy,safety:'external-authorization-required'}]});
export const reject=(issues)=>({ok:false,issues,authoritative:false,authorized:false,
 executed:false,ui_updated:false,cursor_committed:false,can_execute:false});
export const modes={
 'publication.committed':'publish',
 'capability.revoked':'revoke',
 'ui.mount.changed':'refresh'
};
export const intent=(op,port,target,more={})=>({operation:op,port,target,
 executable:false,authorized:false,...more});
