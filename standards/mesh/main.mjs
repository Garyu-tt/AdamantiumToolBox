import {join} from 'node:path';
import {syncOnce} from './worker.mjs';
const home=process.env.LOCALAPPDATA;
if(!home)throw Error('Missing local state directory');
const root=join(home,'Adamantium Toolbox');
let busy=false;
async function poll(){
 if(busy)return;busy=true;
 try{await syncOnce(root);}
 catch(e){console.error('MESH_SYNC_ERROR '+String(e.message).slice(0,120));}
 finally{busy=false;}
}
await poll();
setInterval(poll,12000);
