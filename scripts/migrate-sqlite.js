import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {connectDatabase} from '../config/database.js';
import {uploadPhoto,removePhoto} from '../config/cloudinary.js';

// Run against a backup of the old database before the first server start.
const source=resolve(process.argv[2]||resolve(process.env.DATA_DIR||'data','realpro.sqlite'));
let local,client;
try{
 if(!existsSync(source))throw new Error('Old SQLite database not found. Provide its path as the first argument.');
 local=new DatabaseSync(source,{readOnly:true});
 const connection=await connectDatabase();client=connection.client;const db=connection.db;
 if(await db.collection('settings').findOne({_id:'seeded'}))console.warn('Target database already initialized. Existing IDs will be skipped; check for duplicate sample listings.');
 const photos=local.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='property_photos'").get();
 let count=0;
 for(const row of local.prepare('SELECT * FROM properties ORDER BY rowid').all()){
  const {id,...fields}=row;
  if(await db.collection('properties').findOne({_id:id}))continue;
  const photo=photos?local.prepare('SELECT bytes FROM property_photos WHERE property_id=?').get(id):null;
  const uploaded=photo?await uploadPhoto(Buffer.from(photo.bytes)):null;
  if(!uploaded&&fields.image?.startsWith('/api/property-photo/'))throw Error('A previously uploaded property image is missing in the source database.');
  try{await db.collection('properties').insertOne({_id:id,...fields,description:fields.description||'',created:new Date().toISOString(),...(uploaded||{})});count++}
  catch(e){if(uploaded)await removePhoto(uploaded.cloudinary_id);throw e}
 }
 for(const table of ['inquiries','invoices']){
  for(const row of local.prepare('SELECT * FROM '+table).all()){
   const {id,...fields}=row;await db.collection(table).updateOne({_id:id},{$setOnInsert:fields},{upsert:true});
  }
 }
 await db.collection('settings').updateOne({_id:'seeded'},{$setOnInsert:{value:true}},{upsert:true});
 console.log('Migration complete. New properties imported: '+count+'. Old SQLite file was not modified.');
}catch(e){console.error('Migration stopped. Check the source path, MongoDB connection and Cloudinary configuration. Existing imported IDs can be skipped on retry.');process.exitCode=1}
finally{local?.close();await client?.close()}
