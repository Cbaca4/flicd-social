// Real Chrome + real components + HTTP gateway + disposable PostgreSQL.
// Auth and Storage are explicit synthetic adapters, never hosted-provider evidence.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startBrowserFixture } from '../tests/security/browserFixture.mjs';
const scratch=resolve(process.env.TMPDIR||'node_modules/.cache','boards-browser-'+Date.now());
const output=resolve(process.env.FLICD_BROWSER_EVIDENCE_DIR||'docs/evidence/boards-local-browser-20261021');
await mkdir(scratch,{recursive:true});await mkdir(output,{recursive:true});
const checks=[],exceptions=[],blockedOrigins=new Set(),pages=[],cancellationObservations=[];
let fixture,chrome,browser;
class CDP {
 constructor(ws){this.ws=ws;this.pending=new Map();this.counter=0;this.handlers=[];ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}else for(const handler of this.handlers)handler(m);});}
 static async connect(url){const ws=new WebSocket(url);await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true});});return new CDP(ws);}
 call(method,params={}){const id=++this.counter;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP timeout: '+method));},20000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(expression){const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;}
 async until(expression){for(let i=0;i<200;i++){if(await this.eval('Boolean('+expression+')'))return;await delay(50);}throw new Error('Browser condition timed out: '+expression+'; '+await this.eval('document.body.innerText.slice(-1200)'));}
 async click(expression){await this.until('Boolean('+expression+')');const point=await this.eval(`(()=>{const e=${expression};e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Target obscured');if(e.disabled)throw new Error('Target disabled');return{x,y};})()`);await this.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await this.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
 button(text){return `Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(text)})`;}
 async text(text){return this.click(this.button(text));}
 async key(key){await this.call('Input.dispatchKeyEvent',{type:'keyDown',key,code:key});await this.call('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});}
 async shot(name){const result=await this.call('Page.captureScreenshot',{format:'png'});await writeFile(resolve(output,name+'.png'),Buffer.from(result.data,'base64'));}
 close(){this.ws.close();}
}
async function runCheck(name,fn){try{await fn();checks.push({name,status:'PASS'});console.log('PASS: '+name);}catch(error){checks.push({name,status:'FAIL',error:error.message});throw error;}}
async function page(actor='follower',mobile=false){
 const context=await browser.call('Target.createBrowserContext');const target=await browser.call('Target.createTarget',{url:'about:blank',browserContextId:context.browserContextId});
 const list=await(await fetch('http://127.0.0.1:9338/json/list')).json();const p=await CDP.connect(list.find(row=>row.id===target.targetId).webSocketDebuggerUrl);pages.push(p);p.holdClaims=false;p.held=[];p.dropAck=false;
 p.handlers.push(message=>{
  if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
  if(message.method==='Fetch.requestPaused'){
   const e=message.params;
   if(e.responseStatusCode!==undefined){if(p.dropAck&&e.request.url.endsWith('/media/once/claim')){p.dropAck=false;void p.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'Aborted'});}else void p.call('Fetch.continueRequest',{requestId:e.requestId});return;}
   const url=new URL(e.request.url);
   if(url.origin!==fixture.base&&!['blob:','data:','about:'].includes(url.protocol)){blockedOrigins.add(url.origin);void p.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});return;}
   if(p.holdClaims&&url.pathname==='/media/once/claim'){p.held.push(e.requestId);return;}
   void p.call('Fetch.continueRequest',{requestId:e.requestId});
  }
 });
 await p.call('Runtime.enable');await p.call('Page.enable');await p.call('Network.enable');
 await p.call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'},{urlPattern:'*/media/once/claim',requestStage:'Response'}]});
 await p.call('Emulation.setDeviceMetricsOverride',{width:mobile?390:1280,height:mobile?844:900,deviceScaleFactor:1,mobile});
 if(mobile)await p.call('Emulation.setTouchEmulationEnabled',{enabled:true});
 await p.call('Page.navigate',{url:fixture.base+'/?actor='+actor});
 await p.until("document.body.innerText.includes('Custom Boards')&&!document.body.innerText.includes('Loading Boards')");return p;
}
try {
 fixture=await startBrowserFixture({scratch});
 chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9338','--user-data-dir='+scratch,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});
 let version;
 for(let i=0;i<100;i++){try{version=await(await fetch('http://127.0.0.1:9338/json/version')).json();break;}catch{await delay(100);}}
 if(!version)throw new Error('Owned Chrome did not expose local CDP');
 browser=await CDP.connect(version.webSocketDebuggerUrl);
 const p=await page();
 const sourceCount=await fixture.db.sql('SELECT count(*) FROM storage.objects');
 await runCheck('desktop StrictMode My Photos uses private Blob media that actually decodes',async()=>{
  await p.text('My Photos');await p.until("document.querySelectorAll('article').length===1&&Array.from(document.images).some(e=>e.src.startsWith('blob:')&&e.naturalWidth>0)");await p.shot('desktop-my-photos');
 });
 await runCheck('Kept from Others groups an expired authorized photo by stable creator UUID',async()=>{
  await p.text('Kept from Others');await p.until("document.querySelector('section[data-creator-id=\"cccccccc-cccc-cccc-cccc-cccccccccccc\"] img')?.naturalWidth>0");await p.shot('desktop-creator-group');
 });
 await runCheck('existing Keep links to two custom Boards with one entitlement and zero new Storage objects',async()=>{
  await p.eval(`(()=>{const e=document.querySelector('article select');e.value=${JSON.stringify(fixture.secondBoard)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await p.text('Add to Board');
  await p.until("document.body.innerText.includes('2 Board memberships')");assert.equal(await fixture.db.sql(`SELECT count(*) FROM private.photo_keeps WHERE id='${fixture.foreign.id}'`),'1');assert.equal(await fixture.db.sql('SELECT count(*) FROM storage.objects'),sourceCount);
 });
 await runCheck('custom Board creation, customization and pinning work through owner RLS',async()=>{
  await p.text('Custom Boards');await p.text('New board');await p.click("document.querySelector('input[placeholder=\"Board name\"]')");await p.call('Input.insertText',{text:'Weekend'});await p.text('Create');
  const card="Array.from(document.querySelectorAll('.card')).find(e=>e.querySelector('strong')?.textContent==='Weekend')";
  await p.until('Boolean('+card+')');await p.click(`Array.from((${card}).querySelectorAll('button')).find(e=>e.textContent.trim()==='Customize')`);await p.text('Save changes');await p.until("!document.querySelector('.modal-backdrop')");
  await p.until('Boolean('+card+')');await p.click(`Array.from((${card}).querySelectorAll('button')).find(e=>e.textContent.trim()==='Pin')`);
  await p.until(`Boolean(Array.from((${card}).querySelectorAll('button')).find(e=>e.textContent.trim()==='Unpin'))`);
  assert.equal(await fixture.db.sql("SELECT count(*) FROM public.boards WHERE name='Weekend' AND pinned AND style_config<>'{}'::jsonb"),'1');
 });
 await runCheck('legacy Saves remain visible as preserved review records without media URLs',async()=>{
  await p.text('Legacy Saves');await p.until("document.body.innerText.includes('Unverified old Save')");assert.equal(await p.eval("document.querySelectorAll('article img').length"),0);await p.shot('desktop-legacy-review');
 });
 await runCheck('removing one Board membership retains the same photo in its other Board and creator group',async()=>{
  await p.text('Custom Boards');await p.click("Array.from(document.querySelectorAll('button')).find(e=>e.querySelector('strong')?.textContent==='Trips')");await p.click("document.querySelector('button[title=\"Remove item\"]:not([disabled])')");
  for(let i=0;i<100;i++){if(await fixture.db.sql(`SELECT count(*) FROM private.keep_board_memberships WHERE keep_id='${fixture.foreign.id}'`)==='1')break;await delay(50);}
  assert.equal(await fixture.db.sql(`SELECT count(*) FROM private.keep_board_memberships WHERE keep_id='${fixture.foreign.id}'`),'1');
  await p.click("document.querySelector('[aria-label=\"Back to Boards\"]')");await p.text('Kept from Others');await p.until("document.body.innerText.includes('1 Board memberships')");
 });
 await runCheck('block and unblock suspend then restore an existing expired Keep without deleting it',async()=>{
  await p.text('Account Safety');await p.text('Block account');await p.until("document.body.innerText.includes('Unblock account')");await p.text('Open Boards');await p.text('Kept from Others');await p.until("document.body.innerText.includes('Nothing saved here yet')");
  await p.text('Account Safety');await p.text('Unblock account');await p.until("document.body.innerText.includes('Block account')");await p.text('Open Boards');await p.text('Kept from Others');await p.until("document.querySelector('article img')?.naturalWidth>0");
 });
 await runCheck('lost claim acknowledgement consumes once, but only the SAME live page can recover',async()=>{
  await p.text('Open View Once');await p.until("document.querySelector('[role=dialog]')");
  const reveal="document.querySelector('button.view-once-reveal')";p.dropAck=true;await p.click(reveal);await p.until("document.querySelector('[role=alert]')");
  assert.equal(await fixture.db.sql(`SELECT count(*) FROM private.view_once_claims WHERE dump_id='${fixture.sources.once.id}'`),'1');
  await p.click(reveal);await p.until("Array.from(document.images).some(e=>e.src.startsWith('blob:')&&e.naturalWidth>0)");await p.shot('desktop-view-once-recovered');
  await p.click("document.querySelector('[aria-label=\"Like\"]')");assert.equal(await p.eval("document.querySelector('[aria-label=\"Unlike\"]')!==null"),true);
  await p.key('Escape');await p.until("!document.querySelector('[role=dialog]')");
 });
 await runCheck('refresh/new page preserves metadata/interactions but cannot establish another viewing session',async()=>{
  const again=await page();await again.text('Open View Once');await again.until("document.querySelector('[role=dialog]')");
  assert.equal(await again.eval("Boolean(document.querySelector('button.view-once-reveal'))"),false);assert.equal(await again.eval("document.querySelector('[aria-label=\"Like\"]')!==null"),true);await again.key('Escape');
 });
 await runCheck('simultaneous independent same-account browser pages have exactly one winner',async()=>{
  const a=await page(),b=await page('device2');await a.text('Open race View Once');await b.text('Open race View Once');a.holdClaims=true;b.holdClaims=true;
  const reveal="document.querySelector('button.view-once-reveal')";
  await Promise.all([a.click(reveal),b.click(reveal)]);for(let i=0;i<100&&(!a.held.length||!b.held.length);i++)await delay(50);assert.equal(a.held.length,1);assert.equal(b.held.length,1);
  await Promise.all([a.call('Fetch.continueRequest',{requestId:a.held[0]}),b.call('Fetch.continueRequest',{requestId:b.held[0]})]);a.holdClaims=false;b.holdClaims=false;
  for(let i=0;i<200;i++){if(fixture.network.filter(e=>e.route==='/media/once/claim').some(e=>e.status===409))break;await delay(50);}
  assert.equal(await fixture.db.sql(`SELECT count(*) FROM private.view_once_claims WHERE dump_id='${fixture.sources.raceOnce.id}'`),'1');
  let states;
  for(let i=0;i<200;i++){
   states=await Promise.all([a,b].map(p=>p.eval("({image:Array.from(document.images).some(e=>e.src.startsWith('blob:')&&e.naturalWidth>0),denied:Boolean(document.querySelector('[role=alert]'))})")));
   if(states.filter(s=>s.image).length===1&&states.filter(s=>s.denied).length===1)break;await delay(50);
  }
  assert.equal(states.filter(s=>s.image).length,1);assert.equal(states.filter(s=>s.denied).length,1);
  await a.key('Escape');await b.key('Escape');
 });
 await runCheck('a different eligible account can view that same post independently on mobile and swipe all frames',async()=>{
  const m=await page('owner',true);await m.text('Open race View Once');await m.click("document.querySelector('button.view-once-reveal')");
  await m.until("Array.from(document.images).some(e=>e.src.startsWith('blob:')&&e.naturalWidth>0)");
  await m.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:310,y:390}]});await m.call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:80,y:390}]});await m.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await m.until("document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')==='2'");
  await m.until("Math.abs(document.querySelectorAll('.post-media-slide')[1].getBoundingClientRect().left-document.querySelector('.post-media-viewport').getBoundingClientRect().left)<1");await m.shot('mobile-view-once-swipe');
  assert.equal(await fixture.db.sql(`SELECT count(*) FROM private.view_once_claims WHERE dump_id='${fixture.sources.raceOnce.id}'`),'2');await m.key('Escape');
 });
 await runCheck('mobile collection layout stays within viewport and an unorganized Keep can be removed independently',async()=>{
  const m=await page('follower',true);await m.text('My Photos');await m.until("document.querySelector('article img')?.naturalWidth>0");
  assert.equal(await m.eval('document.documentElement.scrollWidth<=innerWidth+1'),true);await m.shot('mobile-my-photos');await m.text('Remove Keep');await m.until("document.body.innerText.includes('Nothing saved here yet')");
  assert.equal(await fixture.db.sql(`SELECT count(*) FROM private.photo_keeps WHERE id='${fixture.ownKeep.id}'`),'0');assert.equal(await fixture.db.sql(`SELECT count(*) FROM private.photo_keeps WHERE id='${fixture.foreign.id}'`),'1');
 });
 await runCheck('own expired Archive saves the selected original position 7 rather than dense index 1',async()=>{
  await p.text('Open Archive');await p.until("document.querySelectorAll('.archive-card img').length===2&&Array.from(document.querySelectorAll('.archive-card img')).every(e=>e.naturalWidth>0)");
  await p.text('Save frame 2 to Board');await p.until("document.body.innerText.includes('Archived photo saved')");
  assert.equal(await fixture.db.sql(`SELECT count(*) FROM private.photo_keeps WHERE saver_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND source_item_id='${fixture.sources.own.items[1]}'`),'1');await p.shot('desktop-sparse-archive');await p.text('Open Boards');
 });
 await runCheck('owner Archive displays legitimate View Once management without any Keep shortcut',async()=>{
  const owner=await page('stranger');await owner.text('Open Archive');await owner.until("document.querySelectorAll('.archive-card').length>=2");
  assert.equal(await owner.eval("Array.from(document.querySelectorAll('.archive-card')).filter(e=>e.textContent.includes('View Once')).every(e=>!Array.from(e.querySelectorAll('button')).some(b=>b.textContent.includes('Save frame')))"),true);
 });
 for(const mobile of [false,true])for(const phase of ['identity','session'])for(const replacement of [false,true])await runCheck(`A3-R3-001 ${mobile?'mobile':'desktop'} Cancel blocks delayed ${phase} dispatch and preserves replacement=${replacement}`,async()=>{
  const q=await page('follower',mobile),inserts=[];
  q.handlers.push(message=>{
   if(message.method!=='Network.requestWillBeSent')return;
   const request=message.params.request;
   if(new URL(request.url).pathname!=='/fixture/boards'||request.method!=='POST')return;
   const body=JSON.parse(request.postData||'{}');if(body.action==='insert')inserts.push(body.value?.name);
  });
  const name=`Cancelled ${mobile?'mobile':'desktop'} ${phase} ${replacement}`,next='Replacement '+name;
  await q.text('New board');await q.click("document.querySelector('input[placeholder=\"Board name\"]')");await q.call('Input.insertText',{text:name});
  await q.eval(`fixtureAuth.pause=${JSON.stringify(phase)}`);await q.text('Create');await q.until('fixtureAuth.pending.length===1');
  await q.text('Cancel');
  if(replacement){
   await q.text('New board');await q.click("document.querySelector('input[placeholder=\"Board name\"]')");await q.call('Input.insertText',{text:next});
   await q.click("document.querySelector('textarea[placeholder=\"Description (optional)\"]')");await q.call('Input.insertText',{text:'Replacement description'});
  }
  // Drain released promise microtasks and commit two render frames. Network
  // observation asserts first dispatch, not merely an eventually missing row.
  await q.eval('(async()=>{fixtureAuth.release();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()');
  const cancelledRows=await fixture.db.sql(`SELECT count(*) FROM public.boards WHERE name='${name}'`);
  const liveDraft=await q.eval("document.querySelector('input[placeholder=\"Board name\"]')?.value??null");
  const observation={mobile,phase,replacement,cancelledRows,liveDraft,cancelledInsertRequests:inserts.filter(value=>value===name).length};
  cancellationObservations.push(observation);
  assert.equal(observation.cancelledInsertRequests,0);assert.equal(cancelledRows,'0');assert.equal(liveDraft,replacement?next:null);
  if(replacement){
   assert.equal(await q.eval("document.querySelector('textarea[placeholder=\"Description (optional)\"]').value"),'Replacement description');
   await q.shot(`cancel-${mobile?'mobile':'desktop'}-${phase}-replacement`);
   await q.text('Create');await q.until("!document.querySelector('input[placeholder=\"Board name\"]')");
   observation.replacementRows=await fixture.db.sql(`SELECT count(*) FROM public.boards WHERE name='${next}'`);
   assert.equal(observation.replacementRows,'1');assert.deepEqual(inserts,[next]);
  }else await q.shot(`cancel-${mobile?'mobile':'desktop'}-${phase}-closed`);
 });
 for(const mobile of [false,true])for(const transition of ['B','ABA'])await runCheck(`Round 3 ${mobile?'mobile':'desktop'} Board draft never reaches PostgreSQL after delayed identity and ${transition}`,async()=>{
  const q=await page('follower',mobile);await q.text('New board');await q.click("document.querySelector('input[placeholder=\"Board name\"]')");await q.call('Input.insertText',{text:'Round 3 A private draft'});
  await q.eval("fixtureAuth.pause='identity'");await q.text('Create');await q.until('fixtureAuth.pending.length===1');
  const switchTo=actor=>q.eval(`(()=>{const e=document.querySelector('[aria-label="Test account"]');e.value=${JSON.stringify(actor)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await switchTo('stranger');if(transition==='ABA')await switchTo('follower');
  await q.until("document.body.innerText.includes('Custom Boards')&&!document.body.innerText.includes('Loading Boards')");
  await q.eval('fixtureAuth.release()');await delay(150);
  assert.equal(await fixture.db.sql("SELECT count(*) FROM public.boards WHERE name='Round 3 A private draft'"),'0');
  assert.equal(await q.eval("Boolean(document.querySelector('input[placeholder=\"Board name\"]'))"),false);
  await q.shot(`round3-${mobile?'mobile':'desktop'}-board-${transition}`);
 });
 for(const transition of ['close','B','ABA'])await runCheck(`Round 3 obsolete Viewer claim never reaches the HTTP gateway during credential acquisition (${transition})`,async()=>{
  const q=await page();await q.text('Open pending View Once');await q.until("document.querySelector('button.view-once-reveal')");
  const count=fixture.network.filter(row=>row.route==='/media/once/claim').length;
  await q.eval("fixtureAuth.pause='session'");await q.click("document.querySelector('button.view-once-reveal')");await q.until('fixtureAuth.pending.length===1');
  if(transition==='close')await q.key('Escape');
  else{
   const switchTo=actor=>q.eval(`(()=>{const e=document.querySelector('[aria-label="Test account"]');e.value=${JSON.stringify(actor)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   await switchTo('stranger');if(transition==='ABA')await switchTo('follower');
  }
  await q.until("!document.querySelector('[role=dialog]')");await q.eval('fixtureAuth.release()');await delay(150);
  assert.equal(fixture.network.filter(row=>row.route==='/media/once/claim').length,count);
  assert.equal(await fixture.db.sql(`SELECT count(*) FROM private.view_once_claims WHERE dump_id='${fixture.sources.pendingOnce.id}'`),'0');
  await q.shot('round3-obsolete-claim-'+transition);
 });
 await runCheck('Round 3 unconsumed pending-page fixture still permits one valid accepted claim without refund on close',async()=>{
  const q=await page();await q.text('Open pending View Once');await q.click("document.querySelector('button.view-once-reveal')");
  await q.until("Array.from(document.images).some(e=>e.src.startsWith('blob:')&&e.naturalWidth>0)");await q.key('Escape');
  assert.equal(await fixture.db.sql(`SELECT count(*) FROM private.view_once_claims WHERE dump_id='${fixture.sources.pendingOnce.id}'`),'1');
 });
 await runCheck('original author deletion revokes new delivery before cleanup and refresh releases stale Blob URLs',async()=>{
  await p.text('Open Boards');await p.text('Kept from Others');await p.until("document.querySelector('article img')?.naturalWidth>0");const old=await p.eval("document.querySelector('article img').src");
  await fixture.db.sql(`DELETE FROM public.dumps WHERE id='${fixture.sources.ordinary.id}'`);
  assert.equal(await fixture.db.sql(`SELECT count(*) FROM private.photo_keeps WHERE id='${fixture.foreign.id}'`),'0');
  const status=await p.eval(`fetch('/media/keeps/frame',{method:'POST',headers:{Authorization:'Bearer fixture-follower','Content-Type':'application/json'},body:JSON.stringify({keepId:${JSON.stringify(fixture.foreign.id)}})}).then(r=>r.status)`);assert.equal(status,403);
  await p.text('Refresh Saves');await p.until("document.body.innerText.includes('Nothing saved here yet')");assert.equal(await p.eval(`fetch(${JSON.stringify(old)}).then(()=>true,()=>false)`),false);await p.shot('desktop-deletion-revocation');
 });
 await runCheck('no unexpected JavaScript runtime exceptions in desktop/mobile component flows',async()=>assert.deepEqual(exceptions,[]));
 await writeFile(resolve(output,'results.json'),JSON.stringify({scope:'real Chrome/components/HTTP/PostgreSQL, synthetic Auth/Storage, no hosted provider',browser:version.Browser,checks,cancellationObservations,network:fixture.network,blockedExternalOrigins:[...blockedOrigins],exceptions},null,2));
}catch(error){
 console.error(error.stack);process.exitCode=1;
 for(let i=0;i<pages.length;i++)await pages[i].shot('failure-'+i).catch(()=>{});
 await writeFile(resolve(output,'results.json'),JSON.stringify({scope:'local synthetic component QA',checks,cancellationObservations,error:error.message,exceptions},null,2));
}finally{
 for(const p of pages)p.close();
 if(browser){await browser.call('Browser.close').catch(()=>{});browser.close();}
 if(chrome&&chrome.exitCode===null){await Promise.race([once(chrome,'exit'),delay(5000)]);if(chrome.exitCode===null)chrome.kill();}
 await fixture?.stop();
}
