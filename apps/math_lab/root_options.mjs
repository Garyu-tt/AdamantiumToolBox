/** Research RootTransform search limits. */
const MAX_INPUT_BYTES=8192;
const DEFAULT_DEGREES=Object.freeze([2,3,4,5,6,7,8,10,12,16,24,32,64,128,256,512,1000,1024,2048,4096]);
function normalizedDegrees(degrees){
 if(!Array.isArray(degrees)||degrees.length>64)throw new TypeError('invalid degrees');
 const set=new Set();
 for(const k of degrees){
  if(!Number.isSafeInteger(k)||k<2||k>32768)throw new TypeError('unsupported root degree');
  set.add(k);
 }
 return [...set].sort((a,b)=>a-b);
}
export function optionsOf({degrees=DEFAULT_DEGREES,maxDepth=2,maxEvaluations=80,maxInputBytes=MAX_INPUT_BYTES}={}){
 if(!Number.isInteger(maxDepth)||maxDepth<0||maxDepth>3)throw new TypeError('invalid search depth');
 if(!Number.isInteger(maxEvaluations)||maxEvaluations<1||maxEvaluations>300)throw new TypeError('invalid search budget');
 if(!Number.isInteger(maxInputBytes)||maxInputBytes<1||maxInputBytes>MAX_INPUT_BYTES)throw new TypeError('invalid input limit');
 return {degrees:normalizedDegrees(degrees),maxDepth,maxEvaluations,maxInputBytes};
}
