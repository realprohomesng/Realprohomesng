import {connectDatabase,seedProperties} from './config/database.js';
import {configureCloudinary} from './config/cloudinary.js';
import {createApp} from './app.js';
let client;
try{
 const connection=await connectDatabase();client=connection.client;
 await seedProperties(connection.db);
 if(!configureCloudinary())console.warn('Cloudinary is not configured. Photo uploads will be unavailable.');
 const server=createApp(connection.db).listen(Number(process.env.PORT||3000),()=>console.log('MongoDB connected. RealProHomesNG ready on port '+(process.env.PORT||3000)));
 const shutdown=()=>server.close(async()=>{await client.close();process.exit(0)});
 process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}catch(e){await client?.close();console.error(e.message==='Set MONGODB_URI in your .env file.'?e.message:'Startup failed. Check MongoDB URI, database user credentials, network access and port.');process.exitCode=1}
