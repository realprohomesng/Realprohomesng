import express from 'express';
import { connectDatabase, seedProperties } from './config/database.js';
import { configureCloudinary } from './config/cloudinary.js';
import { createApp } from './app.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);

let client;
let websiteApp;
// Handle requests while MongoDB initializes
app.use((req, res, next) => {
    if (!websiteApp) {
        res.set('Retry-After', '5');
        return res.status(503).send(
            'RealProHomesNG is starting. Please refresh shortly.'
        );
    }

    websiteApp(req, res, next);
});

// Start the server immediately
const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// Initialize MongoDB in the background
async function initialize() {
    try {
        const connection = await connectDatabase();
        client = connection.client;

        await seedProperties(connection.db);

        if (!configureCloudinary()) {
            console.warn('Cloudinary is not configured.');
        }

        websiteApp = createApp(connection.db);

        console.log('MongoDB connected. RealProHomesNG is ready.');
    } catch (error) {
        await client?.close();
        console.error('Startup failed. Check MongoDB configuration.');
    }
}

initialize();

// Graceful shutdown
const shutdown = () => {
    server.close(async () => {
        await client?.close();
        process.exit(0);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);