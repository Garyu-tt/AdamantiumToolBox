export function total(numbers){
 if(!Array.isArray(numbers)||numbers.length>100||
  !numbers.every(x=>typeof x==='number'&&Number.isFinite(x)))
  throw Error('invalid_numbers');
 return numbers.reduce((a,b)=>a+b,0);
}
