// Stateful HTTP fixtures exercise the real UI; database/provider guarantees live in backend tests.
// node scripts/test-project-qa-studio.mjs <playwright-index.mjs> <loopback-origin> <artifact-directory> [chromium-executable]
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath,origin,output]=process.argv.slice(2);
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Loopback rehearsal only.');
const {chromium}=await import(pathToFileURL(resolve(modulePath)).href);
const browser=await chromium.launch({headless:true,...(process.argv[5]?{executablePath:resolve(process.argv[5])}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await context.addCookies([{name:'alpha_client_csrf_dev',value:'a'.repeat(43),url:origin}]);
const page=await context.newPage(),faults=[],requests=[],rounds=[],receipts=new Map();let count=0;
page.setDefaultTimeout(10000);
page.on('pageerror',error=>faults.push(error.message));
const build={frontend:{repository:'org/frontend',branch:'uat',deploymentId:'deployment-a',commitSha:'a'.repeat(40),url:'https://deployment-a.vercel.app'},backends:[],verifiedAt:new Date().toISOString(),embeddable:true,reason:null};
await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.hostname.endsWith('.vercel.app'))return route.fulfill({contentType:'text/html',body:'<html><body style="font-family:sans-serif;padding:30px"><h1>Storefront UAT preview</h1><p>Review this application before client handoff.</p><button>Checkout</button></body></html>'});
  if(url.origin!==origin)return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  requests.push(url.pathname);const pm=url.pathname.startsWith('/api/tickets'),project=url.pathname.includes('/project-b/')?'project-b':'project-a';
  let body=null;try{body=request.postDataJSON();}catch{}
  const json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  const found=/\/rounds\/([^/]+)/.exec(url.pathname),round=rounds.find(item=>item.id===found?.[1]&&item.project===project);
  if(url.pathname.endsWith('/client-preview/clients'))return json({items:[{clientId:'client-a',displayName:'Client A'}]});
  if(url.pathname.endsWith('/targets'))return json({items:[{repository:'org/frontend'}]});
  if(url.pathname.endsWith('/preview'))return json({build});
  if(url.pathname.includes('/operations/')){const saved=receipts.get(url.pathname.split('/').at(-1));return saved?json(saved):route.fulfill({status:404,body:'{}'});}
  if(url.pathname.endsWith('/rounds')&&request.method()==='GET')return json({items:rounds.filter(item=>item.project===project&&(pm||item.status!=='draft')).slice().reverse(),nextBefore:null});
  if(url.pathname.endsWith('/rounds')&&request.method()==='POST'){
    const record={...body,id:`round-${++count}`,project,number:count,status:'draft',version:0,outcome:null,reviewed:false,build:structuredClone(build),
      preview:{branch:'uat',url:build.frontend.url,embeddable:true,reason:null},evidenceEnabled:true,evidence:[],triage:[],events:[],
      items:body.items.map((item,index)=>({...item,id:`item-${count}-${index}`,result:{status:'not_tested',notes:'',reproduction:'',device:''}}))};rounds.push(record);
    return json({roundId:record.id,version:0,operationId:body.operationId});
  }
  if(!round)return route.fulfill({status:404,body:'{}'});
  if(url.pathname.endsWith('/commands')){
    if(body.action==='ready')round.reviewed=true;
    if(body.action==='publish'){assert.equal(round.reviewed,true);for(const old of rounds)if(old!==round&&old.status==='published')old.status='superseded';round.status='published';}
    if(body.action==='withdraw')round.status='withdrawn';round.version++;round.events.push({action:body.action,author:'pm',createdAt:new Date().toISOString()});
    return json({roundId:round.id,version:round.version,operationId:body.operationId});
  }
  if(url.pathname.endsWith('/result')){const item=round.items.find(item=>url.pathname.includes(`/items/${item.id}/`));item.result={status:body.status,notes:body.notes,reproduction:body.reproduction,device:body.device};round.version++;
    return json({roundId:round.id,version:round.version,operationId:body.operationId});}
  if(url.pathname.endsWith('/submit')){round.status='submitted';round.outcome=round.items.some(item=>item.result.status==='failed')?'changes_requested':'passed';round.version++;
    return json({roundId:round.id,version:round.version,operationId:body.operationId});}
  if(url.pathname.endsWith('/triage')){round.triage.unshift({itemId:round.items[0].id,...body});return json({roundId:round.id,version:round.version,operationId:body.operationId});}
  if(url.pathname.endsWith('/evidence')){const metadata=JSON.parse(decodeURIComponent(request.headers()['x-alpha-ticket-document']));round.evidence.push({id:'evidence-a',itemId:round.items[0].id,filename:metadata.filename,contentType:'image/png',byteLength:70});return json({roundId:round.id,version:round.version,operationId:metadata.operationId});}
  if(url.pathname.endsWith('/content'))return route.fulfill({contentType:'application/octet-stream',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6l8AAAAASUVORK5CYII=','base64')});
  return json(round);
});
await mkdir(resolve(output),{recursive:true});
const shown=locator=>locator.waitFor({state:'visible'});
const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
try{
  await page.goto(`${origin}/scripts/qa-studio-rehearsal.html`);
  await page.getByLabel('What to test',{exact:true}).fill('Checkout acceptance');
  await page.getByLabel('Steps',{exact:true}).fill('Open cart and click Checkout.');
  await page.getByLabel('Expected result',{exact:true}).fill('Order confirmation appears.');
  await page.getByRole('button',{name:'Save internal review draft',exact:true}).click();
  const ready=page.getByRole('button',{name:'Mark reviewed and ready',exact:true});await shown(ready);assert.equal(await ready.isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'Hand off to client',exact:true}).count(),0);
  await page.getByLabel('I reviewed this UAT build').check();await ready.click();await page.getByRole('button',{name:'Hand off to client',exact:true}).click();
  await shown(page.getByText('Published',{exact:true}));await noOverflow();await page.screenshot({path:resolve(output,'pm-project-qa-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Rehearse client',exact:true}).click();
  await page.getByLabel('Result',{exact:true}).selectOption('failed');
  await page.getByLabel('Notes / what happened',{exact:true}).fill('Checkout remains on the cart.');
  await page.getByLabel('Steps to reproduce',{exact:true}).fill('Add a product, then click Checkout.');
  await page.getByRole('tab',{name:'Feedback',exact:true}).click();await page.getByPlaceholder('Message your project manager').fill('Draft project conversation');
  await page.getByRole('tab',{name:'Checklist',exact:true}).click();assert.equal(await page.getByLabel('Steps to reproduce',{exact:true}).inputValue(),'Add a product, then click Checkout.');
  assert.equal(await page.getByRole('button',{name:'Submit review',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Save result',exact:true}).click();await shown(page.getByText('Saved',{exact:true}));
  await page.getByLabel('Screenshot (PNG or JPEG, up to 3 MB)').setInputFiles({name:'evidence.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6l8AAAAASUVORK5CYII=','base64')});
  await page.getByRole('button',{name:'Attach screenshot',exact:true}).click();await page.getByRole('button',{name:'Screenshot: evidence.png',exact:true}).click();await shown(page.getByAltText('evidence.png'));
  await page.getByRole('button',{name:'Close screenshot',exact:true}).click();
  await page.getByRole('button',{name:'Submit review',exact:true}).click();await page.getByRole('button',{name:'Confirm submission',exact:true}).click();
  await shown(page.getByText(/This review is submitted/));await noOverflow();await page.screenshot({path:resolve(output,'client-project-qa-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Rehearse PM',exact:true}).click();await page.getByLabel('Internal triage note',{exact:true}).fill('Fix within agreed checkout scope.');
  await page.getByLabel('Link an existing issue in this project',{exact:true}).selectOption('issue-a');await page.getByRole('button',{name:'Save triage',exact:true}).click();await shown(page.getByText('Triage recorded',{exact:true}));
  await page.getByRole('button',{name:'Prepare new review / retest',exact:true}).click();await page.getByRole('button',{name:'Save internal review draft',exact:true}).click();
  await shown(page.getByRole('button',{name:'Mark reviewed and ready',exact:true}));
  await page.getByLabel('I reviewed this UAT build').check();await page.getByRole('button',{name:'Mark reviewed and ready',exact:true}).click();await page.getByRole('button',{name:'Hand off to client',exact:true}).click();
  await page.getByRole('button',{name:'Rehearse client',exact:true}).click();await shown(page.getByLabel('Result',{exact:true}));
  await page.setViewportSize({width:390,height:844});await noOverflow();await page.screenshot({path:resolve(output,'client-project-qa-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Preview',exact:true}).click();await shown(page.getByTitle('Project UAT application'));await noOverflow();
  await page.getByLabel('Rehearsal project').selectOption('project-b');await page.getByRole('button',{name:'Review',exact:true}).click();
  await shown(page.getByRole('heading',{name:'No review shared yet',exact:true}));assert.equal(await page.getByText('Checkout acceptance',{exact:true}).count(),0);
  assert.deepEqual(faults,[]);assert(requests.some(path=>path.includes('/project-b/uat/rounds')));
  const report={result:'passed',scope:'synthetic HTTP browser rehearsal',rounds:rounds.length,pmFirst:true,perProject:true,unsavedDraftsPreserved:true,evidence:true,triage:true,desktopAndMobile:true,pageErrors:0};
  await writeFile(resolve(output,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){
  await page.screenshot({path:resolve(output,'browser-failure.png'),fullPage:true});
  console.error(JSON.stringify({faults,requests,body:(await page.locator('body').innerText()).slice(-3000),rounds:rounds.map(({id,status})=>({id,status}))}));throw error;
}finally{await browser.close();}
