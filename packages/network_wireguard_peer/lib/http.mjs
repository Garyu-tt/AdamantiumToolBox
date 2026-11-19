const send=(res,status,object)=>{res.writeHead(status,{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(object));};
function jsonBody(req){return new Promise((resolve,reject)=>{
 let size=0;const chunks=[];req.on('data',v=>{size+=v.length;if(size>8192){reject(Error('body_too_large'));req.destroy();}else chunks.push(v)});
 req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{reject(Error('bad_json'))}});
 req.on('error',reject);
});}
export {send,jsonBody};
