import {v2 as cloudinary} from 'cloudinary';
import {randomUUID} from 'node:crypto';

export function configureCloudinary(){
 const {CLOUDINARY_CLOUD_NAME:cloud_name,CLOUDINARY_API_KEY:api_key,CLOUDINARY_API_SECRET:api_secret}=process.env;
 if(!cloud_name||!api_key||!api_secret)return false;
 cloudinary.config({cloud_name,api_key,api_secret,secure:true});
 return true;
}
export async function uploadPhoto(bytes){
 if(!configureCloudinary())throw Object.assign(new Error('Configure Cloudinary credentials in .env before uploading photos.'),{status:503});
 const result=await new Promise((resolve,reject)=>{
  const stream=cloudinary.uploader.upload_stream({resource_type:'image',public_id:'realprohomesng/properties/'+randomUUID(),overwrite:false,allowed_formats:['jpg','jpeg','png','webp']},(error,value)=>error?reject(error):resolve(value));
  stream.end(bytes);
 }).catch(()=>{throw Object.assign(new Error('Could not upload property photo. Check Cloudinary configuration and try again.'),{status:502})});
 const link=new URL(result.secure_url);
 if(link.protocol!=='https:')throw Error('Invalid image delivery URL');
 return {image:link.href,cloudinary_id:result.public_id};
}
export async function removePhoto(id){
 if(typeof id!=='string'||!id.startsWith('realprohomesng/properties/'))return;
 if(!configureCloudinary())return;
 try{await cloudinary.uploader.destroy(id,{resource_type:'image',invalidate:true})}catch{console.warn('A property photo could not be removed from Cloudinary. Review the Cloudinary media library.')}
}
