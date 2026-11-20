import {timingSafeEqual} from 'node:crypto';
export const matching=(secret,v)=>typeof v==='string'&&
 Buffer.byteLength(v)===Buffer.byteLength(secret)&&
 timingSafeEqual(Buffer.from(v),Buffer.from(secret));
export const respond=(res,status,data)=>{
 res.writeHead(status,{
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'",
  'X-Frame-Options':'DENY'
 });
 res.end(JSON.stringify(data));
};
export const readBody=(req)=>new Promise((ok,bad)=>{
 let length=0,done=false;const chunks=[];
 req.on('data',chunk=>{
  if(done)return;
  length+=chunk.length;
  if(length>262144){
   done=true;bad(Error('body_too_large'));req.destroy();
  }else chunks.push(chunk);
 });
 req.on('end',()=>{
  if(done)return;
  try{ok(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
  catch{bad(Error('invalid_json'));}
 });
 req.on('error',bad);
});
