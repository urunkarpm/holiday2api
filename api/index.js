import fs from 'fs';
import path from 'path';
import worker from '../src/worker.js';

const projectRoot = process.cwd();

const env = {
  TIMEZONE: process.env.TIMEZONE || 'Asia/Kolkata',
  API_VERSION: process.env.API_VERSION || '1.0.0',
  ASSETS: {
    async fetch(input) {
      const urlStr = typeof input === 'string' ? input : (input.url ? input.url : input.toString());
      const url = new URL(urlStr, 'http://localhost');
      let reqPath = url.pathname.replace(/^\/+/, '').replace(/^data\/+/, '');
      const filePath = path.join(projectRoot, 'data', reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return new Response(content, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    },
  },
};

/**
 * Vercel Serverless Function entry point
 * Handles standard Web API Requests & Node.js HTTP req/res
 */
export default async function handler(req, res) {
  // If invoked with Web Standard Request (Edge / Web API)
  if (typeof req?.text === 'function' || (typeof Request !== 'undefined' && req instanceof Request)) {
    return worker.fetch(req, env);
  }

  // If invoked with Node.js IncomingMessage / ServerResponse
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const fullUrl = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }

  const webReq = new Request(fullUrl, {
    method: req.method,
    headers,
  });

  const webRes = await worker.fetch(webReq, env);

  res.statusCode = webRes.status;
  webRes.headers.forEach((val, key) => {
    res.setHeader(key, val);
  });

  const body = await webRes.text();
  res.end(body);
}
