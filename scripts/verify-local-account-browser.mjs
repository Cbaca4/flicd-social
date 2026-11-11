// REAL FlicdApp + BoardStudio/StrictMode in Chrome; synthetic APIs/other surface seams.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir,writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
const scratch=resolve(process.env.TMPDIR||'node_modules/.cache','account-browser-'+Date.now());
const output=resolve(process.env.FLICD_ACCOUNT_EVIDENCE_DIR||'docs/evidence/account-browser-round2');await mkdir(scratch,{recursive:true});await mkdir(output,{recursive:true});
const apis=new Set(['supabase','dumpApi','mediaUpload','archiveApi','boardApi','interactionsApi','musicApi','messageApi','notificationsApi','mediaSessionApi']);
const components=new Set(['Auth','AppShell','Home','CreateChoose','Messages','Profile','ProfileStudio','EditProfile','Discovery','PublicProfile','Archive','SpaceSwitcher','Notifications','Boards']);
const api=resolve('tests/security/accountFixtureApi.js'),surfaces=resolve('tests/security/account-fixture.jsx');
let server,chrome,p;const checks=[],exceptions=[],diagnostics=[];
class CDP{
 constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const item=this.pending.get(m.id);if(item){clearTimeout(item.timer);this.pending.delete(m.id);m.error?item.no(new Error(JSON.stringify(m.error))):item.yes(m.result);}}else if(m.method==='Log.entryAdded')diagnostics.push(m.params.entry);else if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Fetch.requestPaused'){const url=new URL(m.params.request.url);void this.call(url.origin==='http://127.0.0.1:5180'||['data:','blob:','about:'].includes(url.protocol)?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(url.origin==='http://127.0.0.1:5180'||['data:','blob:','about:'].includes(url.protocol)?{}:{errorReason:'BlockedByClient'})});}};}
 static async connect(url){const ws=new WebSocket(url);await new Promise((a,b)=>{ws.onopen=a;ws.onerror=b;});return new CDP(ws);}
 call(method,params={}){const id=++this.id;return new Promise((yes,no)=>{const timer=setTimeout(()=>{this.pending.delete(id);no(new Error('CDP timeout '+method));},15000);this.pending.set(id,{yes,no,timer});this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(expression){const r=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
 async until(expression){for(let i=0;i<160;i++){if(await this.eval('Boolean('+expression+')'))return;await delay(50);}throw new Error('Timed out '+expression+' '+await this.eval("JSON.stringify({url:location.href,html:document.documentElement.outerHTML.slice(0,4000),api:Boolean(window.accountFixture),resources:performance.getEntriesByType('resource').map(x=>x.name)})"));}
 async click(label){const target=`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)})`;const point=await this.eval(`(()=>{const e=${target};if(!e)throw Error('missing button');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw Error('obscured');return{x,y};})()`);await this.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await this.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}
 async shot(name){const r=await this.call('Page.captureScreenshot',{format:'png'});await writeFile(resolve(output,name+'.png'),Buffer.from(r.data,'base64'));}
}
try{
 server=await createServer({configFile:false,envDir:resolve(scratch,'no-env'),server:{host:'127.0.0.1',port:5180,strictPort:true},plugins:[{name:'isolated-account-seams',enforce:'pre',resolveId(id){const name=id.split('/').at(-1).replace(/\.(jsx?|mjs)$/,'');if(apis.has(name))return api;if(name==='CaptureBuilders')return surfaces;if(components.has(name))return '\0account:'+name;},load(id){if(id.startsWith('\0account:'))return `import React from 'react';import {Surface,Viewer} from '/tests/security/account-fixture.jsx';export {Viewer};export default props=>React.createElement(Surface,{...props,kind:${JSON.stringify(id.slice(9))}});`;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.url!=='/')return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/',`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic account QA</title><style>header{display:flex;flex-wrap:wrap;gap:8px;padding:12px}button{min-height:40px}</style></head><body><div id="root"></div><script type="module" src="/tests/security/account-entry.jsx"></script></body></html>`));});}}]});await server.listen();
 chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9340','--user-data-dir='+scratch,'--disable-background-networking','--no-first-run','about:blank'],{stdio:'ignore'});
 let page;for(let i=0;i<100;i++){try{const targets=await(await fetch('http://127.0.0.1:9340/json/list')).json();page=targets.find(row=>row.type==='page'&&row.url==='about:blank');if(page)break;}catch{}await delay(100);}if(!page)throw Error('Owned Chrome page unavailable');p=await CDP.connect(page.webSocketDebuggerUrl);await p.call('Page.enable');await p.call('Runtime.enable');await p.call('Log.enable');await p.call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 for(const mobile of [false,true])for(const kind of ['board','lookup','dump','roll']){
  await p.call('Emulation.setDeviceMetricsOverride',{width:mobile?390:1280,height:mobile?844:900,deviceScaleFactor:1,mobile});await p.call('Page.navigate',{url:'http://127.0.0.1:5180/'});await p.until("document.querySelector('header')?.dataset.account==='A'&&document.querySelector('[data-testid=feed]')?.textContent==='feed-A'");
  const label=(mobile?'mobile':'desktop')+'-'+kind;
  if(kind==='board'){
   await p.click('profile');await p.until("document.querySelector('[data-testid=profile]')");await p.click('Board Studio');await p.until("document.querySelector('input[maxlength=\"60\"]')?.value==='A secret Board'");
   for(const [selector,text] of [['input[maxlength="60"]','A private draft'],['input[maxlength="180"]','A private description draft'],['input[placeholder="https://..."]','https://fixture.invalid/A-private-cover.png']]){
    await p.eval(`document.querySelector(${JSON.stringify(selector)}).select()`);await p.call('Input.insertText',{text});
    assert.equal(await p.eval(`document.querySelector(${JSON.stringify(selector)}).value`),text);
   }
   await p.eval("accountFixture.pause='board'");await p.click('Save changes');await p.until("accountFixture.held.length===1");
   // Native click outside the modal is intentionally not used to bypass its overlay.
   // Synthetic Auth emits an actual subscription event just as a cross-tab login.
   await p.eval("accountFixture.switch('B')");await p.until("document.querySelector('header')?.dataset.account==='B'&&!document.querySelector('[aria-label=\"Close Board Studio\"]')");await p.click('profile');await p.click('Board Studio');await p.until("document.querySelector('input[maxlength=\"60\"]')?.value==='B secret Board'");await p.eval("accountFixture.release('board')");await delay(100);
   assert.equal(await p.eval("document.querySelector('input[maxlength=\"60\"]')?.value"),'B secret Board');assert.equal(await p.eval("document.body.innerText.includes('Board customized')"),false);
   assert.equal(await p.eval("document.querySelector('input[maxlength=\"180\"]').value"),'B private description');
   assert.equal(await p.eval("document.querySelector('input[placeholder=\"https://...\"]').value"),'');
  }else{
   const pause=kind==='lookup'?'lookup':'create';await p.eval(`accountFixture.pause=${JSON.stringify(pause)}`);await p.click(kind==='lookup'?'notifications':'create-'+kind);await p.click(kind==='lookup'?'Open private notification':'Post draft');await p.until('accountFixture.held.length===1');await p.eval("accountFixture.switch('B');accountFixture.switch('A')");await p.until("document.querySelector('[data-testid=feed]')?.textContent==='feed-A'");await p.click('profile');await p.eval(`accountFixture.release(${JSON.stringify(pause)})`);await delay(100);
   assert.equal(await p.eval("Boolean(document.querySelector('[data-testid=viewer]'))"),false);assert.equal(await p.eval("document.querySelector('header').dataset.screen"),'profile');assert.equal(await p.eval("/Dump posted|Roll posted/.test(document.body.innerText)"),false);
  }
  await p.shot(label);checks.push({name:label,status:'PASS'});console.log('PASS: '+label);
 }
 assert.deepEqual(exceptions,[]);
 await writeFile(resolve(output,'results.json'),JSON.stringify({scope:'REAL FlicdApp/BoardStudio/StrictMode in Chrome, synthetic Auth/API and other child surfaces; no hosted system',checks,exceptions},null,2));
}catch(error){console.error(error.stack,JSON.stringify(diagnostics));process.exitCode=1;await p?.shot('failure').catch(()=>{});await writeFile(resolve(output,'results.json'),JSON.stringify({checks,exceptions,diagnostics,error:error.message},null,2));}
finally{if(p){await p.call('Browser.close').catch(()=>{});p.ws.close();}if(chrome&&chrome.exitCode===null){await delay(300);if(chrome.exitCode===null)chrome.kill();}await server?.close();}
