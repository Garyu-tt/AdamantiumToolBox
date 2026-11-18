export async function mount(host){
 const heading=document.createElement('h2');heading.textContent='Leonardo CPU Icons';host.append(heading);
 const text=document.createElement('p');text.textContent='Самостоятельный CPU-провайдер иконок. Доступен через Leonardo API.';host.append(text);
}
