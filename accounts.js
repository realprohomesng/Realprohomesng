import {randomBytes,randomUUID,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {resetEmailConfigured} from './config/password-reset.js';
const derive=promisify(scrypt);
const roles=['staff','landlord','company','independent'];
const DAY=86400000;
export function mountAccounts(app,db,h){
 const {json,photoJson,data,clean,email,money,now,fail,limit,base,secure,upload,remove,decodePhoto,flw,record,resetEmail}=h;
 const users=db.collection('accounts'),properties=db.collection('properties'),payments=db.collection('subscriptions');
 const sessions=new Map(),cookieOptions={httpOnly:true,sameSite:'lax',secure,path:'/'};
 const price=()=>Number(process.env.PREMIUM_PRICE_NGN||0);
 const days=()=>{const n=Number(process.env.PREMIUM_DURATION_DAYS||30);return Number.isSafeInteger(n)&&n>0&&n<=365?n:30};
 const active=u=>u.role==='staff'?u.approved===true:Date.parse(u.premiumUntil)>Date.now();
 const info=u=>({id:u._id,name:u.name,email:u._id,role:u.role,approved:u.approved,suspended:u.suspended===true,created:u.created||null,premiumUntil:u.premiumUntil||null,unlimited:active(u),limit:active(u)?null:u.role==='staff'?0:2});
 const checkSuspended=u=>{if(u.suspended===true)fail('Your account has been suspended. Contact RealProHomesNG for assistance.',403)};
 const sessionToken=req=>(req.headers.cookie||'').match(/(?:^|;\s*)rph_agent=([a-f0-9]{64})(?:;|$)/)?.[1];
 function signIn(u,res){const t=randomBytes(32).toString('hex');sessions.set(t,{id:u._id,version:u.passwordVersion||null,expires:Date.now()+8*3600000});res.cookie('rph_agent',t,{...cookieOptions,maxAge:8*3600000}).json({account:info(u)})}
 async function auth(req,res,next){const t=sessionToken(req),s=sessions.get(t);if(!s||s.expires<=Date.now()){sessions.delete(t);fail('Sign in required',401)}const u=await users.findOne({_id:s.id});if(!u||(u.passwordVersion||null)!==s.version){sessions.delete(t);fail('Sign in required',401)}checkSuspended(u);req.account=u;next()}
 // A database-backed lease serializes listing creation even across server instances.
 async function locked(id,action){const lock=randomUUID(),time=new Date();const result=await users.updateOne({_id:id,$or:[{listingLock:{$exists:false}},{listingLockUntil:{$lt:time}}]},{$set:{listingLock:lock,listingLockUntil:new Date(+time+60000)}});if(!result.modifiedCount)fail('Another listing request is in progress. Try again.',409);try{return await action(await users.findOne({_id:id}))}finally{await users.updateOne({_id:id,listingLock:lock},{$unset:{listingLock:'',listingLockUntil:''}})}}
 app.post('/api/account/register',json,async(req,res)=>{
  limit(req,'register',10);const b=data(req),name=clean(b.name),id=clean(b.email).toLowerCase(),role=clean(b.role),password=b.password;
  if(!name||!email(id)||!roles.includes(role)||typeof password!=='string'||password.length<10||password.length>128)fail('Enter a name, valid email, account type and password of 10–128 characters.');
  const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt,64)).toString('hex');
  const u={_id:id,name,role,salt,hash,approved:role!=='staff',suspended:false,created:now()};
  try{await users.insertOne(u)}catch(e){if(e.code===11000)fail('An account already exists for this email.',409);throw e}signIn(u,res);
 });
 app.post('/api/account/login',json,async(req,res)=>{
  limit(req,'account-login',10);const b=data(req),u=await users.findOne({_id:clean(b.email).toLowerCase()});
  if(typeof b.password!=='string'||b.password.length>128)fail('Invalid credentials',401);
  const hash=await derive(b.password,u?.salt||'invalid-account',64);if(!u||!timingSafeEqual(hash,Buffer.from(u.hash,'hex')))fail('Invalid credentials',401);checkSuspended(u);signIn(u,res);
 });
 app.post('/api/account/logout',json,(req,res)=>{sessions.delete(sessionToken(req));res.clearCookie('rph_agent',cookieOptions).json({ok:true})});
 app.post('/api/account/forgot-password',json,async(req,res)=>{
  limit(req,'forgot-password',8);const id=clean(data(req).email).toLowerCase();if(!email(id))fail('Enter a valid email address');
  if(!resetEmailConfigured())fail('Password reset emails are not configured. Contact RealProHomesNG.',503);
  const u=await users.findOne({_id:id});
  // Respond identically for registered, unknown, suspended and recently requested addresses.
  res.json({ok:true,message:'If an eligible account exists, a reset link will be sent to its registered email address.'});
  if(!u||u.suspended===true)return;
  const token=randomBytes(32).toString('hex'),digest=createHash('sha256').update(token).digest('hex'),time=Date.now();
  try{
   const result=await users.updateOne({_id:id,suspended:{$ne:true},$or:[{resetRequestedAt:{$exists:false}},{resetRequestedAt:{$lt:time-60000}}]},{$set:{resetTokenHash:digest,resetExpiresAt:time+30*60000,resetRequestedAt:time}});
   if(!result.modifiedCount)return;
   const link=new URL('/reset-password.html',base);link.hash=token;await resetEmail({email:u._id,link:link.href});
  }catch{console.warn('Password reset email could not be sent. Check email configuration.');}
 });
 app.post('/api/account/reset-password',json,async(req,res)=>{
  limit(req,'reset-password',12);const {token,password}=data(req);if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail('This reset link is invalid or expired. Request a new one.');
  if(typeof password!=='string'||password.length<10||password.length>128)fail('Use a password of 10–128 characters.');
  const digest=createHash('sha256').update(token).digest('hex'),u=await users.findOne({resetTokenHash:digest,resetExpiresAt:{$gt:Date.now()},suspended:{$ne:true}});
  if(!u)fail('This reset link is invalid or expired. Request a new one.');
  const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt,64)).toString('hex');
  const result=await users.updateOne({_id:u._id,resetTokenHash:digest,resetExpiresAt:{$gt:Date.now()},suspended:{$ne:true}},{$set:{salt,hash,passwordVersion:randomUUID()},$unset:{resetTokenHash:'',resetExpiresAt:'',resetRequestedAt:''}});
  if(!result.modifiedCount)fail('This reset link is invalid or expired. Request a new one.');
  for(const [token,session] of sessions)if(session.id===u._id)sessions.delete(token);
  res.clearCookie('rph_agent',cookieOptions).json({ok:true});
 });
 app.use('/api/agent',auth);
 app.get('/api/agent/dashboard',async(req,res)=>{
  const u=req.account,items=(await properties.find({ownerId:u._id}).sort({created:-1}).toArray()).map(record);
  const pending=(await payments.find({ownerId:u._id,status:'pending'}).sort({created:-1}).limit(1).toArray())[0];
  res.json({account:info(u),properties:items,premium:{price:money(price())?price():null,days:days(),configured:money(price())&&!!process.env.FLW_SECRET_KEY,pending:pending?{id:pending._id,link:pending.link||null}:null}});
 });
 app.post('/api/agent/property',photoJson,async(req,res)=>{
  const b=data(req),ownerId=req.account._id,id=clean(b.id)||randomUUID(),title=clean(b.title),location=clean(b.location),price=Number(b.price),status=clean(b.status),description=clean(b.description,3000);
  if(!title||!location||!money(price)||!['Available','Sold','Reserved'].includes(status))fail('Check the property title, location, price and status');
  const previous=b.id?await properties.findOne({_id:id,ownerId}):null;if(b.id&&!previous)fail('Property not found',404);
  if(req.account.role==='staff'&&!active(req.account))fail('Awaiting administrator approval',403);
  if(!previous&&!b.photo)fail('Choose a property photo');
  if(!previous&&!active(req.account)&&await properties.countDocuments({ownerId})>=2)fail('Free plan allows only 2 properties. Upgrade to Premium.',403);
  const uploaded=b.photo?await upload(decodePhoto(b.photo)):null;
  const fields={title,location,price,status,description,image:uploaded?.image||previous.image,cloudinary_id:uploaded?.cloudinary_id||previous?.cloudinary_id||null,updated:now()};
  try{await locked(ownerId,async u=>{
   checkSuspended(u);
   if(u.role==='staff'&&!active(u))fail('Awaiting administrator approval',403);
   if(previous){const result=await properties.updateOne({_id:id,ownerId,updated:previous.updated??{$exists:false}},{$set:fields});if(!result.matchedCount)fail('Listing changed. Refresh and try again.',409)}
   else{if(!active(u)&&await properties.countDocuments({ownerId})>=2)fail('Free plan allows only 2 properties. Upgrade to Premium.',403);await properties.insertOne({_id:id,ownerId,...fields,created:now()})}
  })}catch(e){if(uploaded)await remove(uploaded.cloudinary_id);throw e}
  if(uploaded&&previous?.cloudinary_id)await remove(previous.cloudinary_id);res.json({ok:true,id});
 });
 app.delete('/api/agent/property',json,async(req,res)=>{const item=await properties.findOneAndDelete({_id:clean(data(req).id),ownerId:req.account._id});if(!item)fail('Property not found',404);if(item.cloudinary_id)await remove(item.cloudinary_id);res.json({ok:true})});
 app.post('/api/agent/subscribe',json,async(req,res)=>{
  limit(req,'subscribe',10);const u=req.account,amount=price();if(u.role==='staff'||active(u))fail('Your account does not need a new subscription');if(!money(amount)||!process.env.FLW_SECRET_KEY)fail('Premium payments are not configured. Contact our office.',503);
  const pending=(await payments.find({ownerId:u._id,status:'pending'}).sort({created:-1}).limit(1).toArray())[0];if(pending?.link&&Date.parse(pending.created)>Date.now()-DAY)return res.json({link:pending.link});
  const id='RPH-PREMIUM-'+randomUUID();await payments.insertOne({_id:id,ownerId:u._id,amount,days:days(),status:'pending',created:now()});
  const result=await flw('payments',{method:'POST',body:JSON.stringify({tx_ref:id,amount,currency:'NGN',redirect_url:new URL('/agent-dashboard.html?subscription='+encodeURIComponent(id),base).href,customer:{email:u._id,name:u.name},customizations:{title:'RealProHomesNG Premium',description:'Property listing subscription'}})});
  const link=new URL(result.link);if(link.protocol!=='https:'||!['checkout.flutterwave.com','flutterwave.com'].includes(link.hostname))fail('Invalid checkout response',502);
  await payments.updateOne({_id:id},{$set:{link:link.href}});res.json({link:link.href});
 });
 app.post('/api/agent/check-subscription',json,async(req,res)=>{
  limit(req,'subscription-check',20);const id=clean(data(req).id),p=await payments.findOne({_id:id,ownerId:req.account._id});if(!p)fail('Subscription not found',404);
  if(p.status!=='paid'){
   const result=await flw('transactions/verify_by_reference?tx_ref='+encodeURIComponent(id));
   if(result.status!=='successful'||result.tx_ref!==id||result.currency!=='NGN'||Number(result.amount)!==p.amount||!result.id)return res.json({status:'pending'});
   const paidAt=Date.parse(result.created_at);const expires=new Date((Number.isFinite(paidAt)?Math.min(paidAt,Date.now()):Date.now())+p.days*DAY).toISOString();
   await payments.updateOne({_id:id,status:'pending'},{$set:{status:'paid',expires,transactionId:String(result.id)}});
  }
  const paid=await payments.findOne({_id:id});await users.updateOne({_id:req.account._id},{$max:{premiumUntil:paid.expires}});res.json({status:'paid'});
 });
 // Only the existing administrator can approve staff. Public registrations never grant staff privileges automatically.
 app.get('/api/admin/accounts',async(req,res)=>{res.json((await users.find({}).sort({created:-1}).toArray()).map(info))});
 app.post('/api/admin/account',json,async(req,res)=>{const b=data(req);if(typeof b.approved!=='boolean')fail('Choose an approval status');const r=await users.updateOne({_id:clean(b.id),role:'staff'},{$set:{approved:b.approved}});if(!r.matchedCount)fail('Staff account not found',404);res.json({ok:true})});
 app.post('/api/admin/account/suspension',json,async(req,res)=>{
  const b=data(req),id=clean(b.id).toLowerCase();if(!id||typeof b.suspended!=='boolean')fail('Choose a valid account and suspension status');
  const result=await users.updateOne({_id:id},{$set:{suspended:b.suspended,suspensionUpdated:now()},...(b.suspended?{$unset:{resetTokenHash:'',resetExpiresAt:'',resetRequestedAt:''}}:{})});if(!result.matchedCount)fail('Account not found',404);
  if(b.suspended)for(const [token,session] of sessions)if(session.id===id)sessions.delete(token);
  res.json({ok:true,suspended:b.suspended});
 });
}
