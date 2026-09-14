export function rankSubmissions(entries){return [...entries].sort((a,b)=>b.likes-a.likes||a.createdAt-b.createdAt).map((x,i)=>({...x,rank:i+1}))}
