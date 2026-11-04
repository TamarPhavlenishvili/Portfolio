'use strict';
const sessions=new Map(),waiting=new Map();
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 const data=event.data||{};
 if(data.type==='unlock'&&typeof data.token==='string'&&data.files){sessions.set(data.token,data.files);const jobs=waiting.get(data.token)||[];jobs.forEach(resolve=>resolve(data.files));waiting.delete(data.token);if(event.ports[0])event.ports[0].postMessage({ready:true});}
 if(data.type==='lock')sessions.delete(data.token);
});
async function getFiles(token){
 if(sessions.has(token))return sessions.get(token);
 const promise=new Promise(resolve=>{const jobs=waiting.get(token)||[];jobs.push(resolve);waiting.set(token,jobs);setTimeout(()=>resolve(null),8000)});
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});windows.forEach(client=>client.postMessage({type:'need-session',token}));
 return promise;
}
function bytes(base64){const raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),root=new URL(self.registration.scope).pathname,prefix=root+'_preview/';
 if(url.origin!==self.location.origin||!url.pathname.startsWith(prefix))return;
 event.respondWith((async()=>{
  const parts=url.pathname.slice(prefix.length).split('/'),token=parts.shift(),path=parts.join('/');
  const files=await getFiles(token),file=files&&files[path];
  if(!file)return new Response('This preview is locked. Reopen your private access link.',{status:401,headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}});
  const body=bytes(file.data),headers={'Content-Type':file.type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive','Accept-Ranges':'bytes'};
  const range=event.request.headers.get('Range');
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(match){let start=match[1]?Number(match[1]):Math.max(0,body.length-Number(match[2])),end=match[1]&&match[2]?Math.min(body.length-1,Number(match[2])):body.length-1;if(start> end||start>=body.length)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+body.length}});headers['Content-Range']='bytes '+start+'-'+end+'/'+body.length;headers['Content-Length']=String(end-start+1);return new Response(event.request.method==='HEAD'?null:body.slice(start,end+1),{status:206,headers})}}
  headers['Content-Length']=String(body.length);return new Response(event.request.method==='HEAD'?null:body,{status:200,headers});
 })());
});
