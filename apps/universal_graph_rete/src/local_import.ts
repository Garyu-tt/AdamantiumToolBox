// Files are read locally in the browser; never uploaded or treated as authority.
export const MAX_LOCAL_GRAPH_BYTES=8*1024*1024;
export async function parseLocalGraph<T>(
  file:{size:number; text():Promise<string>},
  verify:(candidate:unknown)=>T
):Promise<T>{
 if(!file||!Number.isSafeInteger(file.size)||file.size<0||
    file.size>MAX_LOCAL_GRAPH_BYTES)
  throw Error('local_graph_file_budget');
 if(typeof file.text!=='function')throw Error('invalid_local_graph_file');
 const raw=await file.text();
 if(new TextEncoder().encode(raw).length>MAX_LOCAL_GRAPH_BYTES)
  throw Error('local_graph_file_budget');
 // Parse data, then pass through the EXACT canonical G0 schema validator.
 return verify(JSON.parse(raw));
}
