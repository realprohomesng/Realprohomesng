import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createApp} from '../app.js';
import {sendPasswordReset} from '../config/password-reset.js';

test('Resend reset email uses the company sender, not stale environment senders',async t=>{
 const original={key:process.env.RESEND_API_KEY,from:process.env.PASSWORD_RESET_FROM,newsletter:process.env.NEWSLETTER_FROM};
 process.env.RESEND_API_KEY='test-only-key';process.env.PASSWORD_RESET_FROM='stale@example.com';process.env.NEWSLETTER_FROM='newsletter@example.com';
 t.after(()=>{for(const [name,value] of [['RESEND_API_KEY',original.key],['PASSWORD_RESET_FROM',original.from],['NEWSLETTER_FROM',original.newsletter]]){if(value===undefined)delete process.env[name];else process.env[name]=value}});
 const resetLink='https://www.realprohomesng.com/reset-password.html#test-token';
 let reject=false;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails');const payload=JSON.parse(options.body);
  assert.equal(payload.from,'RealProHomesNG <info@realprohomesng.com>');assert.deepEqual(payload.to,['recipient@example.com']);assert.ok(payload.text.includes(resetLink));
  return reject?new Response(JSON.stringify({name:'validation_error'}),{status:403}):new Response(JSON.stringify({id:'test-email-id'}),{status:200});
 });
 assert.deepEqual(await sendPasswordReset({email:'recipient@example.com',link:resetLink}),{status:'accepted',id:'test-email-id'});
 reject=true;await assert.rejects(sendPasswordReset({email:'recipient@example.com',link:resetLink}),e=>e.providerCode==='HTTP 403 (validation_error)');
});

// Test-only substitutes exercise the actual Express API without accessing cloud accounts.
class Collection{
 rows=new Map();
 matches(row,q){return Object.entries(q).every(([k,v])=>k==='$or'?v.some(x=>this.matches(row,x)):v&&typeof v==='object'?('$exists'in v?(k in row)===v.$exists:'$lt'in v?row[k]<v.$lt:'$gt'in v?row[k]>v.$gt:'$ne'in v?row[k]!==v.$ne:false):row[k]===v)}
 find(q={}){let rows=[...this.rows.values()].filter(x=>this.matches(x,q));return {sort(){rows.sort((a,b)=>String(b.created).localeCompare(a.created)||String(b._id).localeCompare(a._id));return this},skip(n){rows=rows.slice(n);return this},limit(n){rows=rows.slice(0,n);return this},async toArray(){return rows}}}
 async countDocuments(q={}){return [...this.rows.values()].filter(x=>this.matches(x,q)).length}
 async findOne(q,opts){const row=[...this.rows.values()].find(x=>this.matches(x,q));if(!row)return null;if(opts?.projection)return {purpose:row.purpose,amount:row.amount,status:row.status};return {...row}}
 async insertOne(row){if(this.rows.has(row._id))throw Object.assign(Error('duplicate'),{code:11000});this.rows.set(row._id,{...row})}
 async updateOne(q,change){const row=[...this.rows.values()].find(x=>this.matches(x,q));if(!row)return {matchedCount:0,modifiedCount:0};Object.assign(row,change.$set);for(const k of Object.keys(change.$unset||{}))delete row[k];for(const [k,v] of Object.entries(change.$max||{}))if(!row[k]||row[k]<v)row[k]=v;return {matchedCount:1,modifiedCount:1}}
 async findOneAndDelete(q){const row=[...this.rows.values()].find(x=>this.matches(x,q));if(row)this.rows.delete(row._id);return row}
}
test('Express API preserves publishing, inquiries and invoice workflow',async t=>{
 const collections=new Map(),db={collection(name){if(!collections.has(name))collections.set(name,new Collection());return collections.get(name)},async command(){return {ok:1}}};
 process.env.ADMIN_EMAIL='admin@example.com';process.env.ADMIN_PASSWORD='test-only-password';process.env.PUBLIC_BASE_URL='http://localhost:3000';
 delete process.env.FLW_SECRET_KEY;
 const removed=[];let bytesReceived;
 let checkout,verified=false,mailFailure=false,resetFailure=false;const notifications=[],resets=[],contacts=[];const app=createApp(db,{notifyContact:async inquiry=>{contacts.push(inquiry);if(mailFailure)throw Error('mail failed');return {status:'sent',id:'mock-contact-id'}},resetEmail:async mail=>{await new Promise(r=>setTimeout(r,20));if(resetFailure)throw Error('mail failed');resets.push(mail)},notifyNewsletter:async signup=>{notifications.push(signup.email);if(mailFailure)throw Error('mail failed');return {status:'sent',id:'mock-email-id'}},upload:async bytes=>{bytesReceived=bytes;return {image:'https://res.cloudinary.com/example/image/upload/demo.png',cloudinary_id:'realprohomesng/properties/test'}},remove:async id=>removed.push(id),paymentProvider:async(path,options)=>{if(path==='payments'){checkout=JSON.parse(options.body);return {link:'https://checkout.flutterwave.com/demo'}}return {status:verified?'successful':'pending',tx_ref:checkout.tx_ref,currency:'NGN',amount:checkout.amount,id:123,created_at:new Date().toISOString()}}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;let cookie='';
 async function api(path,body,method='POST'){const res=await fetch(base+'/api/'+path,{method:body===undefined?'GET':method,headers:{origin:'http://localhost:3000','content-type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)});const header=res.headers.get('set-cookie');if(header)cookie=header.split(';')[0];return [res.status,await res.json()]}
 assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/js/site.js')).status,200);
 // Every shipped page uses the shared responsive styles and mobile viewport.
 for(const file of (await readdir('public')).filter(name=>name.endsWith('.html'))){const response=await fetch(base+'/'+file);assert.equal(response.status,200,file);const html=await response.text();assert.match(html,/<meta[^>]+name="viewport"[^>]+width=device-width/i,file);assert.match(html,/href="modern\.css"/,file)}
 const cssResponse=await fetch(base+'/modern.css');assert.equal(cssResponse.status,200);assert.match(await cssResponse.text(),/Site-wide fluid layout/);
 assert.equal((await api('health'))[0],200);
 assert.equal((await api('admin/dashboard'))[0],401);
 assert.equal((await api('login',{email:'admin@example.com',password:'incorrect'}))[0],401);
 assert.equal((await api('login',{email:'admin@example.com',password:'test-only-password'}))[0],200);
 const image=await readFile('public/Images/realpro-brand.png');
 const payload={title:'New Duplex',location:'Lekki',price:95000000,description:'Four bedrooms',status:'Available',photo:'data:image/png;base64,'+image.toString('base64')};
 const [status,created]=await api('admin/property',payload);assert.equal(status,200);assert.deepEqual(bytesReceived,image);
 const [,published]=await api('properties');assert.equal(published[0].id,created.id);assert.equal(published[0].description,'Four bedrooms');assert.match(published[0].image,/cloudinary\.com/);assert.equal(published[0].cloudinary_id,undefined);
 const preview=await fetch(base+'/property-share/'+created.id);assert.equal(preview.status,200);assert.match(await preview.text(),/property="og:image" content="https:\/\/res\.cloudinary\.com\/example\/image\/upload\/demo\.png"/);
 delete process.env.COMPANY_WHATSAPP_NUMBER;assert.equal((await api('properties?page=1'))[1].items[0].whatsapp,'2348149113567');
 process.env.COMPANY_WHATSAPP_NUMBER='+2348062761900';assert.equal((await api('properties'))[1][0].whatsapp,'2348062761900');delete process.env.COMPANY_WHATSAPP_NUMBER;
 assert.equal((await api('admin/property',{...payload,id:created.id,photo:undefined,status:'Sold'}))[0],200);
 assert.equal((await api('properties'))[1][0].status,'Sold');
 assert.equal((await api('admin/property',{id:created.id},'DELETE'))[0],200);assert.equal(removed.length,1);assert.equal((await api('properties'))[1].length,0);
 assert.deepEqual((await api('properties?page=1'))[1],{items:[],page:1,pageSize:9,total:0,totalPages:1});
 for(let n=1;n<=20;n++)await db.collection('properties').insertOne({_id:String(n),title:'Property '+n,created:new Date(2025,0,n).toISOString()});
 const first=(await api('properties?page=1'))[1],second=(await api('properties?page=2'))[1],last=(await api('properties?page=3'))[1];
 assert.equal(first.items.length,9);assert.equal(second.items.length,9);assert.equal(last.items.length,2);
 assert.equal(first.items[0].title,'Property 20');assert.equal(second.items[0].title,'Property 11');assert.equal(last.items[0].title,'Property 2');
 assert.equal(new Set([...first.items,...second.items,...last.items].map(p=>p.id)).size,20);
 assert.equal(first.totalPages,3);assert.equal((await api('properties?page=99'))[1].page,3);assert.equal((await api('properties?page=-1'))[1].page,1);
 assert.equal((await api('inquiry',{kind:'inspection',name:'Test',email:'test@example.com',message:'Inspection'}))[0],201);
 const [invoiceStatus,invoice]=await api('admin/invoice',{name:'Test',email:'test@example.com',purpose:'Reservation',amount:10000});assert.equal(invoiceStatus,201);
 assert.equal((await api('invoice?id='+invoice.id))[1].amount,10000);
 assert.equal((await api('pay',{id:invoice.id}))[0],503);
 assert.equal((await api('admin/dashboard'))[1].inquiries.length,1);
 assert.equal((await api('logout',{}))[0],200);
 assert.equal((await api('admin/dashboard'))[0],401);
 // Partner account isolation, quotas, and staff approval.
 const register=(email,role)=>api('account/register',{name:'Partner',email,role,password:'strong-password'});
 assert.equal((await register('partner@example.com','independent'))[0],200);
 assert.equal((await api('admin/dashboard'))[0],401);
 const one=(await api('agent/property',payload))[1];assert.ok(one.id);
 assert.equal((await api('agent/property',payload))[0],200);
 assert.equal((await api('agent/property',payload))[0],403);
 assert.equal((await api('agent/dashboard'))[1].properties.length,2);
 assert.equal((await api('properties'))[1].find(p=>p.id===one.id).ownerId,undefined);
 assert.equal((await api('agent/property',{...payload,id:one.id,photo:undefined,status:'Sold'}))[0],200);
 assert.equal((await api('agent/subscribe',{}))[0],503);
 assert.equal((await register('other@example.com','landlord'))[0],200);
 assert.equal((await api('agent/dashboard'))[1].properties.length,0);
 assert.equal((await api('agent/property',{...payload,id:one.id}))[0],404);
 assert.equal((await api('agent/property',{id:one.id},'DELETE'))[0],404);
 assert.equal((await api('account/login',{email:'partner@example.com',password:'strong-password'}))[0],200);
 assert.equal((await api('agent/property',{id:one.id},'DELETE'))[0],200);
 assert.equal((await api('agent/property',payload))[0],200);
 process.env.PREMIUM_PRICE_NGN='5000';process.env.FLW_SECRET_KEY='test-only';
 assert.equal((await api('agent/subscribe',{}))[0],200);assert.equal(checkout.amount,5000);
 assert.equal((await api('agent/check-subscription',{id:checkout.tx_ref}))[1].status,'pending');
 verified=true;assert.equal((await api('agent/check-subscription',{id:checkout.tx_ref}))[1].status,'paid');
 const until=(await api('agent/dashboard'))[1].account.premiumUntil;
 assert.equal((await api('agent/check-subscription',{id:checkout.tx_ref}))[1].status,'paid');assert.equal((await api('agent/dashboard'))[1].account.premiumUntil,until);
 assert.equal((await api('agent/property',payload))[0],200);
 assert.equal((await api('agent/dashboard'))[1].account.unlimited,true);
 await db.collection('accounts').updateOne({_id:'partner@example.com'},{$set:{premiumUntil:new Date(Date.now()-1000).toISOString()}});
 assert.equal((await api('agent/property',payload))[0],403);
 assert.equal((await register('staff@example.com','staff'))[0],200);
 assert.equal((await api('agent/property',payload))[0],403);
 assert.equal((await api('login',{email:'admin@example.com',password:'test-only-password'}))[0],200);
 assert.equal((await api('admin/account',{id:'staff@example.com',approved:true}))[0],200);
 assert.equal((await api('account/login',{email:'staff@example.com',password:'strong-password'}))[0],200);
 assert.equal((await api('agent/property',payload))[0],200);
 // Suspension affects existing sessions and new sign-ins, but retains listings.
 const staffCookie=cookie;
 assert.equal((await api('admin/account/suspension',{id:'staff@example.com',suspended:true}))[0],401);
 assert.equal((await api('login',{email:'admin@example.com',password:'test-only-password'}))[0],200);
 const adminCookie=cookie;
 const [accountStatus,accounts]=await api('admin/accounts');assert.equal(accountStatus,200);assert.equal(accounts.length,3);
 assert.equal(accounts.filter(a=>['staff','independent'].includes(a.role)).length,2);
 assert.ok(accounts.every(a=>a.created&&!a.suspended&&a.hash===undefined&&a.salt===undefined));
 assert.equal((await api('admin/account/suspension',{id:'staff@example.com',suspended:true}))[0],200);
 assert.equal((await api('admin/accounts'))[1].find(a=>a.email==='staff@example.com').suspended,true);
 assert.equal((await db.collection('properties').countDocuments({ownerId:'staff@example.com'})),1);
 cookie=staffCookie;
 assert.equal((await api('agent/dashboard'))[0],401);
 assert.equal((await api('agent/property',payload))[0],401);
 assert.equal((await api('account/login',{email:'staff@example.com',password:'strong-password'}))[0],403);
 cookie=adminCookie;
 assert.equal((await api('admin/account/suspension',{id:'staff@example.com',suspended:false}))[0],200);
 assert.equal((await api('admin/account/suspension',{id:'missing@example.com',suspended:false}))[0],404);
 cookie=staffCookie;assert.equal((await api('agent/dashboard'))[0],401);
 assert.equal((await api('account/login',{email:'staff@example.com',password:'strong-password'}))[0],200);
 assert.equal((await api('agent/dashboard'))[1].properties.length,1);
 // Newsletter submissions are persisted, deduplicated, and notify the owner.
 assert.equal((await api('inquiry',{kind:'newsletter',email:'Newsletter@example.com'}))[0],201);
 assert.equal((await api('inquiry',{kind:'newsletter',email:'newsletter@example.com'}))[0],200);
 assert.equal((await api('inquiry',{kind:'newsletter',email:'not-an-email'}))[0],400);
 assert.deepEqual(notifications,['newsletter@example.com']);
 mailFailure=true;assert.equal((await api('inquiry',{kind:'newsletter',email:'retry@example.com'}))[0],201);
 const failed=await db.collection('inquiries').findOne({email:'retry@example.com'});assert.equal(failed.notificationStatus,'failed');
 assert.equal((await api('admin/newsletter-notify',{id:failed._id}))[0],401);
 cookie=adminCookie;mailFailure=false;
 assert.equal((await api('admin/newsletter-notify',{id:failed._id}))[1].status,'sent');
 assert.equal((await api('admin/newsletter-notify',{id:failed._id}))[1].status,'sent');
 assert.deepEqual(notifications,['newsletter@example.com','retry@example.com','retry@example.com']);
 const [inquiryStatus,allInquiries]=await api('admin/inquiries');assert.equal(inquiryStatus,200);
 assert.equal(allInquiries.filter(i=>i.kind==='newsletter'&&i.status==='new').length,2);
 const subscriber=allInquiries.find(i=>i.email==='newsletter@example.com');assert.ok(subscriber.id);
 assert.equal((await api('admin/inquiry',{id:subscriber.id}))[0],200);
 assert.equal((await api('admin/inquiries'))[1].filter(i=>i.kind==='newsletter'&&i.status==='new').length,1);
 assert.equal((await api('admin/inquiries'))[1].filter(i=>i.kind==='newsletter').length,2);
 const plans=(await api('smartinvest/plans'))[1];assert.equal(plans.starter.minimum,5000000);assert.equal(plans.growth.minimum,8000000);assert.equal(plans.pro.minimum,15000000);
 assert.equal(plans.starter.monthlyRate,2);assert.equal(plans.growth.monthlyRate,5);assert.equal(plans.pro.monthlyRate,8);
 const [reviewCode,review]=await api('smartinvest/review',{plan:'growth',amount:9000000,months:18});assert.equal(reviewCode,200);assert.equal(review.amount,9000000);assert.equal(review.months,18);assert.equal(review.paymentAvailable,false);
 assert.equal(review.monthlyReturn,450000);assert.equal(review.totalReturn,8100000);assert.equal(review.projectedTotal,17100000);
 const starter=(await api('smartinvest/review',{plan:'starter',amount:5000000,months:6}))[1];assert.equal(starter.totalReturn,600000);assert.equal(starter.projectedTotal,5600000);
 const pro=(await api('smartinvest/review',{plan:'pro',amount:15000000,months:12}))[1];assert.equal(pro.monthlyReturn,1200000);assert.equal(pro.totalReturn,14400000);
 assert.equal((await api('smartinvest/review',{plan:'pro',amount:5000000,months:12}))[0],400);assert.equal((await api('smartinvest/review',{plan:'starter',amount:5000000,months:0}))[0],400);
 assert.equal((await api('inquiry',{kind:'contact',name:'Customer',email:'contact@example.com',phone:'08012345678',message:'Please contact me'}))[0],201);assert.equal(contacts[0].message,'Please contact me');
 const contact=(await api('admin/inquiries'))[1].find(i=>i.email==='contact@example.com');assert.equal(contact.notificationStatus,'sent');
 mailFailure=true;assert.equal((await api('inquiry',{kind:'contact',name:'Customer',email:'contact-failed@example.com',message:'Request information'}))[0],201);const failedContact=(await api('admin/inquiries'))[1].find(i=>i.email==='contact-failed@example.com');assert.equal(failedContact.notificationStatus,'failed');mailFailure=false;
 assert.equal((await api('admin/contact-notify',{id:failedContact.id}))[1].status,'sent');
 // Join Our Team ships a real form and handler, and submissions reach the admin inbox.
 const joinHtml=await (await fetch(base+'/Joinourteam.html')).text();
 assert.match(joinHtml,/<form id="joinTeamForm" method="post">/);assert.match(joinHtml,/name="position"/);assert.match(joinHtml,/js\/join-team\.js/);
 const button={disabled:false},notice={textContent:'',classList:{toggle(){}}};let submit,resetCount=0,prevented=false;
 const fields={name:'Test applicant',email:'applicant@example.com',position:'Site Engineer',message:'I have experience in property development.'};
 const form={querySelector:()=>button,reportValidity:()=>true,addEventListener:(type,fn)=>{assert.equal(type,'submit');submit=fn},reset:()=>resetCount++};
 runInNewContext(await readFile('public/js/join-team.js','utf8'),{document:{getElementById:id=>id==='joinTeamForm'?form:notice},FormData:class{constructor(){return new Map(Object.entries(fields))}},AbortSignal,fetch:async(path,options)=>fetch(base+path,{...options,headers:{...options.headers,origin:'http://localhost:3000'}})});
 await submit({preventDefault(){prevented=true}});assert.ok(prevented);assert.equal(button.disabled,false);assert.equal(resetCount,1);assert.match(notice.textContent,/successfully/);
 const applicant=(await api('admin/inquiries'))[1].find(i=>i.email==='applicant@example.com');assert.equal(applicant.kind,'application');assert.equal(applicant.position,fields.position);assert.match(applicant.message,/Position: Site Engineer/);assert.equal(applicant.status,'new');
 fields.position='';await submit({preventDefault(){}});assert.equal(resetCount,1);assert.match(notice.textContent,/position/);assert.equal(button.disabled,false);
 assert.match(await (await fetch(base+'/admin.html')).text(),/value="application">Job applications/);
 assert.equal((await api('logout',{}))[0],200);assert.equal((await api('admin/inquiries'))[0],401);
 // Password reset links are delivered only to the registered email and expire after one use.
 process.env.RESEND_API_KEY='test-key';process.env.NEWSLETTER_FROM='test@example.com';
 assert.equal((await fetch(base+'/reset-password.html')).status,200);
 resetFailure=true;await api('account/forgot-password',{email:'staff@example.com'});assert.equal((await db.collection('accounts').findOne({_id:'staff@example.com'})).resetTokenHash,undefined);resetFailure=false;
 const known=await api('account/forgot-password',{email:'staff@example.com'}),unknown=await api('account/forgot-password',{email:'unknown@example.com'});assert.deepEqual(known,unknown);
 assert.equal(resets.length,1);assert.equal(resets[0].email,'staff@example.com');
 const token=new URL(resets[0].link).hash.slice(1);assert.match(token,/^[a-f0-9]{64}$/);
 const saved=await db.collection('accounts').findOne({_id:'staff@example.com'});assert.notEqual(saved.resetTokenHash,token);
 assert.equal((await api('account/forgot-password',{email:'staff@example.com'}))[0],200);assert.equal(resets.length,1);
 assert.equal((await api('account/reset-password',{token,password:'short'}))[0],400);
 assert.equal((await api('account/login',{email:'staff@example.com',password:'strong-password'}))[0],200);const oldSession=cookie;
 assert.equal((await api('account/reset-password',{token,password:'new-strong-password'}))[0],200);
 assert.equal((await api('account/reset-password',{token,password:'another-password'}))[0],400);
 cookie=oldSession;assert.equal((await api('agent/dashboard'))[0],401);
 assert.equal((await api('account/login',{email:'staff@example.com',password:'strong-password'}))[0],401);
 assert.equal((await api('account/login',{email:'staff@example.com',password:'new-strong-password'}))[0],200);
 assert.equal((await api('agent/dashboard'))[1].properties.length,1);
 assert.equal((await api('account/forgot-password',{email:'staff@example.com'}))[0],200);
 const expiredToken=new URL(resets.at(-1).link).hash.slice(1);await db.collection('accounts').updateOne({_id:'staff@example.com'},{$set:{resetExpiresAt:Date.now()-1000}});
 assert.equal((await api('account/reset-password',{token:expiredToken,password:'another-password'}))[0],400);
 delete process.env.RESEND_API_KEY;delete process.env.NEWSLETTER_FROM;
 delete process.env.FLW_SECRET_KEY;delete process.env.PREMIUM_PRICE_NGN;
});
