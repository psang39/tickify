import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { PORT } from "./config/index";
import connectDB from './config/db.js';
import { startOrderExpirationWorker } from './queues/orderExpiration.queue';
import { connectRedis } from "./utils/redisClient";

import app from './app';

// import methodOverride from 'method-override';

mongoose.Promise = global.Promise;
mongoose.set("strictQuery", false);
// mongoose.connect(URI as string,  {
//   family: 4, tls: true
// })
//     .then(() => {
//         console.log('Connected to MongoDB');
//     })
//     .catch((err) => {
//         console.error('Failed to connect to MongoDB', err);
//     });
// mongoose
//     .connect(URI as string, {
//         useNewUrlParser: true,
//         useUnifiedTopology: true,
//     })
//     .then(console.log("Connected to database"))
//     .catch((err) => console.log(err));


// === 4 - CONFIGURE ROUTES ===
// Connect Route handler to server
// Router(app);

// === 5 - START UP SERVER ===
async function bootstrap() {
    try {
        await connectDB();
        await connectRedis();

        // Clustered performance API workers share one separately started
        // expiration worker. Normal deployments keep the existing behavior.
        if (process.env.PERFORMANCE_API_ONLY !== 'true') {
            startOrderExpirationWorker();
        }
        app.listen(PORT, () =>
            console.log(`Server running on http://localhost:${PORT}`)
        )
    }
    catch (error) {
        console.log(error);
    }
}
bootstrap();
