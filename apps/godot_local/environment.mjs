const defaults=['PATH','HOME','USERPROFILE','SYSTEMROOT','WINDIR','TEMP','TMP','TMPDIR',
 'LANG','LC_ALL','XDG_RUNTIME_DIR','XDG_DATA_HOME','XDG_CONFIG_HOME'];
const blocked=/(^ADA_|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|PRIVATE|_KEY)/i;
export function engineEnv(){
 const additional=(process.env.ADA_GODOT_ENV_ALLOWLIST||'').split(',');
 const names=[...new Set([...defaults,...additional])];
 const all=Object.entries(process.env),result={};
 for(const requested of names){
  if(!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(requested)||blocked.test(requested))continue;
  const pair=all.find(([key])=>key.toUpperCase()===requested.toUpperCase());
  if(pair)result[pair[0]]=pair[1];
 }
 return result;
}
