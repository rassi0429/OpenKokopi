import express from 'express';
import ApiRouter from './api/index.js';

import {createProxyMiddleware} from 'http-proxy-middleware';

const PANEL_URL = process.env.PANEL_URL ?? 'http://localhost:3001';

const app = express();

app.use(express.urlencoded({extended: true}));
app.use(express.json());

// api
app.use('/api', ApiRouter);


app.use(
    "/",
    createProxyMiddleware({
        target: PANEL_URL,
        changeOrigin: true,
    })
);


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
