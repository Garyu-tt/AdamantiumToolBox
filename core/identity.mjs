import {join,resolve} from 'node:path';
import {sign,createPrivateKey} from 'node:crypto';
import {existingIdentity} from './node_identity.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const challengePattern=/^[0-9a-f]{48}$/;
function location(){
 if(process.env.ADA_MESH_IDENTITY_DIR)return resolve(process.env.ADA_MESH_IDENTITY_DIR);
 const base=process.env.LOCALAPPDATA;
 if(!base)throw Error('mesh_identity_location_unavailable');
 return join(base,'Adamantium Toolbox','mesh');
}
export async function signedIdentity(challenge){
 if(typeof challenge!=='string'||!challengePattern.test(challenge))throw Error('invalid_challenge');
 const owner=await existingIdentity(location());
 const message='adamantium.core.identity.v1\n'+owner.id+'\n'+challenge;
 return {schema:'adamantium.core.identity.v1',id:owner.id,challenge,
  signature:sign(null,Buffer.from(message),createPrivateKey(owner.privateKey)).toString('base64')};
}
export async function assertTargetNode(id){
 if(typeof id!=='string'||!uuid.test(id))throw Error('invalid_target_node');
 if((await existingIdentity(location())).id!==id)throw Error('node_identity_mismatch');
}
