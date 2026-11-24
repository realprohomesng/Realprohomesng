import { MongoClient } from 'mongodb';

export async function connectDatabase(){
 const uri=process.env.MONGODB_URI;
 if(!uri)throw new Error('Set MONGODB_URI in your .env file.');
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:10000});
 try{
  await client.connect();
  const db=client.db(process.env.MONGODB_DB||'realprohomesng');
  await db.command({ping:1});
  await Promise.all([
   db.collection('properties').createIndex({created:-1}),
   db.collection('properties').createIndex({ownerId:1,created:-1}),
   db.collection('accounts').createIndex({resetTokenHash:1},{sparse:true,unique:true}),
   db.collection('subscriptions').createIndex({ownerId:1,created:-1}),
   db.collection('inquiries').createIndex({created:-1}),
   db.collection('invoices').createIndex({created:-1}),
   db.collection('invoices').createIndex({transaction_id:1},{unique:true,partialFilterExpression:{transaction_id:{$type:'string'}}})
  ]);
  return {client,db};
 }catch(e){await client.close();throw e}
}

export async function seedProperties(db){
 const settings=db.collection('settings');
 if(await settings.findOne({_id:'seeded'}))return;
 const items=[
  {_id:'legacy-seed-4-bedroom',title:'4 bedroom detached duplex',location:'Salvation Estate, Langbasa Road, Ajah',price:180000000,image:'Images/4 bedroom duplex.jpeg',status:'Available'},
  {_id:'legacy-seed-5-bedroom',title:'5 bedroom detached duplex',location:'Salvation Estate, Langbasa Road, Ajah',price:180000000,image:'Images/5-bedroom-duplex-in-lekki-ajah-lagos-3.jpg',status:'Available'}
 ];
 for(const item of items)await db.collection('properties').updateOne({_id:item._id},{$setOnInsert:{...item,description:'',created:new Date().toISOString()}},{upsert:true});
 await settings.updateOne({_id:'seeded'},{$setOnInsert:{value:true}},{upsert:true});
}
