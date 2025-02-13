import express from 'express';
import basicAuth from 'express-basic-auth';
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
  basicAuth({
    users: {'admin': 'pass'},
    challenge: true,
    realm: 'Imb4T3st4pp',
  }),
  createProxyMiddleware({
    target: PANEL_URL,
    changeOrigin: true,
  })
);


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
