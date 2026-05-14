// // const express = require('express');
// // const app = express();
// // const path = require('path');
// // const mongoose = require('mongoose');
// // const methodOverride = require('method-override');

// import express from 'express';
// import mongoose from 'mongoose';
// import methodOverride from 'method-override';
// import path from 'path';
// const app = express();
import { setServers } from "node:dns/promises";
import compression from 'compression';
import router from "./routes/index";
import cors from 'cors'

// mongoose.connect('mongodb://localhost:27017/ai_recruitment_platform')
//     .then(() => {
//         console.log('Connected to MongoDB');
//     })
//     .catch((err) => {
//         console.error('Failed to connect to MongoDB', err);
//     });

// app.use(express.json());
// app.use(methodOverride('_method'));
import Express from "express";

// import authRoutes from "./routes/auth";

const app = Express();
app.use(cors({
    origin: 'http://localhost:5173', // Điền đúng địa chỉ Frontend của bạn
    credentials: true // Cho phép đính kèm token/cookie
}));
setServers(["1.1.1.1", "8.8.8.8"]);
app.use(Express.json({ limit: '10mb' }));
app.use(Express.urlencoded({ limit: '10mb', extended: true }));
app.use(compression({
    // Chỉ nén những response lớn hơn 1KB (mặc định)
    threshold: 1024,
    // Tùy chọn lọc: chỉ nén JSON, HTML, Text...
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));
app.use(Express.json());
app.use('/api/v1/', router);

export default app;