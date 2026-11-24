import express from 'express';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {uploadPhoto,removePhoto} from './config/cloudinary.js';
import {mountAccounts} from './accounts.js';
import {sendNewsletterNotification} from './config/newsletter.js';
import {sendPasswordReset} from './config/password-reset.js';
import {sendContactNotification} from './config/contact-notification.js';
import {investmentPlans,reviewInvestment} from './config/smartinvest.js';
const root=resolve('public');
const clean=(v,n=250)=>typeof v==='string'?v.trim().slice(0,n):'';
const email=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const money=v=>Number.isSafeInteger(v)&&v>0&&v<=1000000000;
const now=()=>new Date().toISOString();
const same=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
function fail(message,status=400){throw Object.assign(new Error(message),{status})}
function record({_id,cloudinary_id,ownerId,...fields}){return {id:String(_id),...fields}}
export function decodePhoto(value){
 if(typeof value!=='string')fail('Choose a property photo');
 const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match)fail('Choose a JPG, PNG or WebP photo');
 const bytes=Buffer.from(match[2],'base64'),mime=match[1];
 if(bytes.length<12||bytes.length>5*1024*1024)fail('Photo must be no larger than 5 MB');
 const good=mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217:mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!good)fail('Invalid image file');return bytes;
}
async function flw(path,options={}){
 if(!process.env.FLW_SECRET_KEY)fail('Payments are not configured. Contact RealProHomesNG.',503);
 const response=await fetch('https://api.flutterwave.com/v3/'+path,{...options,headers:{Authorization:'Bearer '+process.env.FLW_SECRET_KEY,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok||data.status!=='success')fail('Flutterwave could not complete the request. Try again later.',502);return data.data;
}
export function createApp(db,{upload=uploadPhoto,remove=removePhoto,paymentProvider=flw,notifyNewsletter=sendNewsletterNotification,notifyContact=sendContactNotification,resetEmail=sendPasswordReset}={}){
 const app=express(),properties=db.collection('properties'),inquiries=db.collection('inquiries'),invoices=db.collection('invoices');
 const sessions=new Map(),attempts=new Map(),base=new URL(process.env.PUBLIC_BASE_URL||'http://localhost:3000'),secure=base.protocol==='https:';
 app.disable('x-powered-by');
 app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});next()});
 app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==base.origin)return res.status(403).json({error:'Invalid request origin'});next()});
 function token(req){const t=(req.headers.cookie||'').match(/(?:^|;\s*)rph_session=([a-f0-9]+)/)?.[1];return t&&sessions.get(t)>Date.now()?t:null}
 function requireAdmin(req,res,next){if(!token(req))return res.status(401).json({error:'Sign in required'});next()}
 function limit(req,key,max=20){const k=key+req.socket.remoteAddress,a=attempts.get(k)||{count:0,until:0};if(a.until<Date.now()){a.count=0;a.until=Date.now()+600000}if(++a.count>max)fail('Please try again later',429);attempts.set(k,a)}
 const json=express.json({limit:'30kb'}),photoJson=express.json({limit:'8mb'});
 const data=req=>{if(!req.is('application/json')||!req.body||typeof req.body!=='object'||Array.isArray(req.body))fail('JSON required',415);return req.body};
 const list=async collection=>(await collection.find({}).sort({created:-1}).toArray()).map(record);
 app.get('/api/health',async(req,res)=>{await db.command({ping:1});res.json({ok:true})});
 app.post('/api/login',json,async(req,res)=>{
  limit(req,'login',8);const b=data(req),password=process.env.ADMIN_PASSWORD||'';
  if(password.length<12||!process.env.ADMIN_EMAIL)fail('Administrator setup required',503);
  if(!same(clean(b.email).toLowerCase(),process.env.ADMIN_EMAIL.toLowerCase())||!same(typeof b.password==='string'?b.password:'',password))fail('Invalid credentials',401);
  const t=randomBytes(32).toString('hex');sessions.set(t,Date.now()+8*3600000);
  res.cookie('rph_session',t,{httpOnly:true,sameSite:'strict',secure,maxAge:28800000,path:'/'}).json({ok:true});
 });
 app.post('/api/logout',json,(req,res)=>{sessions.delete(token(req));res.clearCookie('rph_session',{httpOnly:true,sameSite:'strict',secure,path:'/'}).json({ok:true})});
 app.get('/api/properties',async(req,res)=>{
  const configured=String(process.env.COMPANY_WHATSAPP_NUMBER||'').trim().replace(/^\+/,'');
  const whatsapp=/^[1-9][0-9]{7,14}$/.test(configured)?configured:'2348149113567';
  const publicProperty=p=>({...p,whatsapp});
  // Preserve the existing unpaginated response for other clients.
  if(req.query.page===undefined)return res.json((await list(properties)).map(publicProperty));
  const pageSize=9,total=await properties.countDocuments({});
  const totalPages=Math.max(1,Math.ceil(total/pageSize)),requested=Number(req.query.page);
  const page=Math.min(totalPages,Number.isSafeInteger(requested)&&requested>0?requested:1);
  const items=(await properties.find({}).sort({created:-1,_id:-1}).skip((page-1)*pageSize).limit(pageSize).toArray()).map(record).map(publicProperty);
  res.json({items,page,pageSize,total,totalPages});
 });
 async function notifySignup(signup){
  let result;try{result=await (signup.kind==='contact'?notifyContact(signup):notifyNewsletter(signup))}catch{result={status:'failed'}}
  await inquiries.updateOne({_id:signup._id},{$set:{notificationStatus:result.status,notificationId:result.id||null,notificationAttempt:now()}});
  return result.status;
 }
 app.post('/api/inquiry',json,async(req,res)=>{
  limit(req,'inquiry');const b=data(req),kind=clean(b.kind,30),name=clean(b.name),mail=clean(b.email),phone=clean(b.phone),message=clean(b.message,3000);
  if(!['contact','inspection','newsletter','interest'].includes(kind)||!email(mail)||(!name&&kind!=='newsletter'))fail('Enter valid contact details');
  if(kind==='newsletter'){
   const address=mail.toLowerCase(),id='newsletter-'+createHash('sha256').update(address).digest('hex');
   const signup={_id:id,kind,email:address,name:'',phone:'',message:'Newsletter signup',created:now(),status:'new',notificationStatus:'pending'};
   try{await inquiries.insertOne(signup)}catch(e){if(e.code===11000)return res.json({ok:true});throw e}
   await notifySignup(signup);return res.status(201).json({ok:true});
  }
  if(kind==='contact'&&!message)fail('Enter your message');
  const inquiry={_id:randomUUID(),kind,name,email:mail,phone,message,created:now(),status:'new',...(kind==='contact'?{notificationStatus:'pending'}:{})};await inquiries.insertOne(inquiry);if(kind==='contact')await notifySignup(inquiry);res.status(201).json({ok:true});
 });
 app.get('/api/smartinvest/plans',(req,res)=>res.json(investmentPlans));
 app.post('/api/smartinvest/review',json,(req,res)=>{limit(req,'investment-review',30);const review=reviewInvestment(data(req));if(!review)fail('Choose a valid plan, amount at or above the plan minimum, and duration of 1–60 months.');res.json(review)});
 app.get('/api/invoice',async(req,res)=>{
  const i=await invoices.findOne({_id:clean(req.query.id)},{projection:{_id:0,purpose:1,amount:1,status:1}});if(!i)fail('Invoice not found',404);res.json(i);
 });
 async function verify(i){
  if(i.status==='paid'||!i.ref)return i.status;
  const result=await flw('transactions/verify_by_reference?tx_ref='+encodeURIComponent(i.ref));
  if(result.status==='successful'&&result.tx_ref===i.ref&&result.currency==='NGN'&&Number(result.amount)===i.amount&&result.id){
   await invoices.updateOne({_id:i._id,status:{$ne:'paid'},ref:i.ref},{$set:{status:'paid',transaction_id:String(result.id)}});return 'paid';
  }return i.status;
 }
 app.post('/api/pay',json,async(req,res)=>{
  limit(req,'pay');const b=data(req),i=await invoices.findOne({_id:clean(b.id)});if(!i)fail('Invoice not found',404);
  if(!process.env.FLW_SECRET_KEY)fail('Payments are not configured. Contact RealProHomesNG.',503);
  if(i.status==='paid')fail('Invoice already paid');if(i.ref)fail('Checkout already initiated. Use Check payment or contact our office to reconcile.',409);
  const ref='RPH-'+randomUUID();
  const claimed=await invoices.updateOne({_id:i._id,status:'unpaid',ref:null},{$set:{ref}});
  if(!claimed.modifiedCount)fail('Checkout already initiated',409);
  const result=await flw('payments',{method:'POST',body:JSON.stringify({tx_ref:ref,amount:i.amount,currency:'NGN',redirect_url:new URL('/pay.html?id='+i._id,base).href,customer:{email:i.email,name:i.name},customizations:{title:'RealProHomesNG',description:i.purpose}})});
  const link=new URL(result.link);if(link.protocol!=='https:'||!['checkout.flutterwave.com','flutterwave.com'].includes(link.hostname))fail('Invalid checkout response',502);
  res.json({link:link.href});
 });
 app.post('/api/check-payment',json,async(req,res)=>{limit(req,'verify');const i=await invoices.findOne({_id:clean(data(req).id)});if(!i)fail('Invoice not found',404);res.json({status:await verify(i)})});
 app.use('/api/admin',requireAdmin);
 mountAccounts(app,db,{json,photoJson,data,clean,email,money,now,fail,limit,base,secure,upload,remove,decodePhoto,flw:paymentProvider,record,resetEmail});
 app.get('/api/admin/dashboard',async(req,res)=>{const [p,q,i]=await Promise.all([list(properties),list(inquiries),list(invoices)]);res.json({properties:p,inquiries:q,invoices:i})});
 app.get('/api/admin/inquiries',async(req,res)=>res.json(await list(inquiries)));
 app.post('/api/admin/property',photoJson,async(req,res)=>{
  const b=data(req),title=clean(b.title),location=clean(b.location),price=Number(b.price),status=clean(b.status),description=clean(b.description,3000);
  if(!title||!location||!money(price)||!['Available','Sold','Reserved'].includes(status))fail('Check the property title, location, price and status');
  const requested=clean(b.id),previous=requested?await properties.findOne({_id:requested}):null;if(requested&&!previous)fail('Property not found',404);
  const id=previous?._id||randomUUID(),existingImage=previous?.image||clean(b.image,500);
  if(!b.photo&&!previous&&(!/^Images\/[^/]+\.(jpeg|jpg|png|webp|jfif)$/i.test(existingImage)||!existsSync(resolve(root,existingImage))))fail('Choose a property photo');
  const uploaded=b.photo?await upload(decodePhoto(b.photo)):null;
  const fields={title,location,price,status,description,image:uploaded?.image||existingImage,cloudinary_id:uploaded?.cloudinary_id||previous?.cloudinary_id||null,updated:now()};
  try{if(previous){const result=await properties.updateOne({_id:id,updated:previous.updated??{$exists:false}},{$set:fields});if(!result.matchedCount)fail('Listing changed. Refresh and try again.',409)}else await properties.insertOne({_id:id,...fields,created:now()})}
  catch(e){if(uploaded)await remove(uploaded.cloudinary_id);throw e}
  if(uploaded&&previous?.cloudinary_id)await remove(previous.cloudinary_id);res.json({ok:true,id});
 });
 app.delete('/api/admin/property',json,async(req,res)=>{const removed=await properties.findOneAndDelete({_id:clean(data(req).id)});if(removed?.cloudinary_id)await remove(removed.cloudinary_id);res.json({ok:true})});
 app.post('/api/admin/inquiry',json,async(req,res)=>{await inquiries.updateOne({_id:clean(data(req).id)},{$set:{status:'reviewed'}});res.json({ok:true})});
 app.post('/api/admin/newsletter-notify',json,async(req,res)=>{limit(req,'newsletter-retry',20);const signup=await inquiries.findOne({_id:clean(data(req).id),kind:'newsletter'});if(!signup)fail('Newsletter signup not found',404);if(signup.notificationStatus==='sent')return res.json({status:'sent'});res.json({status:await notifySignup(signup)})});
 app.post('/api/admin/contact-notify',json,async(req,res)=>{limit(req,'contact-retry',20);const inquiry=await inquiries.findOne({_id:clean(data(req).id),kind:'contact'});if(!inquiry)fail('Contact enquiry not found',404);if(inquiry.notificationStatus==='sent')return res.json({status:'sent'});res.json({status:await notifySignup(inquiry)})});
 app.post('/api/admin/invoice',json,async(req,res)=>{
  const b=data(req),name=clean(b.name),mail=clean(b.email),purpose=clean(b.purpose),amount=Number(b.amount);
  if(!name||!email(mail)||!purpose||!money(amount))fail('Enter a valid invoice');
  const id=randomUUID();await invoices.insertOne({_id:id,name,email:mail,purpose,amount,status:'unpaid',ref:null,transaction_id:null,created:now()});res.status(201).json({id});
 });
 app.use('/api',(req,res)=>res.status(404).json({error:'Not found'}));
 app.use(express.static(root,{dotfiles:'ignore'}));
 app.use((req,res)=>res.status(404).send('Not found'));
 app.use((e,req,res,next)=>{if(res.headersSent)return next(e);const status=Number.isInteger(e.status)&&e.status>=400&&e.status<600?e.status:500;res.status(status).json({error:status===413?'Request too large':status>=500&&status!==503?'Unexpected server error':e.type==='entity.parse.failed'?'Invalid JSON':e.message})});
 return app;
}
