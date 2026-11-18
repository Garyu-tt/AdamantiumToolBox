import {authorizedAddon} from '../shared/authorize.mjs';
export const CAPABILITY='frankenstein.adapter.python';
export const authorized=(root,key,action,port)=>
 authorizedAddon(root,key,action,port,CAPABILITY,'python');
