const id=/^[0-9a-f-]{36}$/i;
const worker=/^[a-z0-9][a-z0-9_.-]{0,63}$/i;
export const requireId=value=>{
 if(typeof value!=='string'||!id.test(value))throw Error('invalid_task_id');
 return value;
};
export const actor=value=>{
 if(typeof value!=='string'||!worker.test(value))throw Error('invalid_worker_id');
 return value;
};
export const validCaps=value=>Array.isArray(value)&&value.length<=32&&
 value.every(x=>typeof x==='string'&&/^[a-z][a-z0-9_.-]{1,79}$/.test(x))&&
 new Set(value).size===value.length;
export const validLease=value=>typeof value==='string'&&id.test(value);
