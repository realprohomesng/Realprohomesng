import express from 'express';
import { connectDatabase, seedProperties } from './config/database.js';
import { configureCloudinary } from './config/cloudinary.js';
import { createApp } from './app.js';
import { resetEmailConfigured, PASSWORD_RESET_SENDER } from './config/password-reset.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);

let client;
let websiteApp;
// Handle requests while MongoDB initializes
app.use(async (req, res, next) => {
    if (!websiteApp) {
        await initialization;
    }

    if (!websiteApp) {
        return res.status(503).json({
            error: 'Database unavailable. Please try again.'
        });
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
        if (resetEmailConfigured()) console.info('Password reset email configured via Resend: '+PASSWORD_RESET_SENDER);
        else console.warn('Password reset emails disabled: RESEND_API_KEY missing.');

        console.log('MongoDB connected. RealProHomesNG is ready.');
    } catch (error) {
        await client?.close();
        console.error('Startup failed. Check MongoDB configuration.');
    }
}

const initialization = initialize();

// Graceful shutdown
const shutdown = () => {
    server.close(async () => {
        await client?.close();
        process.exit(0);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
