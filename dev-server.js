import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './src/worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8787;

const mockEnv = {
  TIMEZONE: 'Asia/Kolkata',
  API_VERSION: '1.0.0',
  ASSETS: {
    async fetch(input) {
      const urlStr = typeof input === 'string' ? input : (input.url ? input.url : input.toString());
      const url = new URL(urlStr, `http://localhost:${PORT}`);
      let reqPath = url.pathname.replace(/^\/+/, '').replace(/^data\/+/, '');
      let filePath = path.join(__dirname, 'data', reqPath);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        filePath = path.join(__dirname, reqPath);
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const isFont = filePath.endsWith('.ttf') || filePath.endsWith('.woff') || filePath.endsWith('.woff2');
        const isIcs = filePath.endsWith('.ics');
        let contentType = 'application/json';
        if (isFont) contentType = filePath.endsWith('.woff2') ? 'font/woff2' : (filePath.endsWith('.woff') ? 'font/woff' : 'font/ttf');
        else if (isIcs) contentType = 'text/calendar; charset=utf-8';

        const content = isFont ? fs.readFileSync(filePath) : fs.readFileSync(filePath, 'utf-8');
        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': isFont ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      return new Response('Not Found', { status: 404 });
    },
  },
};

const server = http.createServer(async (req, res) => {
  try {
    const fullUrl = `http://${req.headers.host || `localhost:${PORT}`}${req.url}`;
    const requestHeaders = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const v of value) requestHeaders.append(key, v);
      } else if (value !== undefined) {
        requestHeaders.set(key, value);
      }
    }

    const bodyChunks = [];
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      for await (const chunk of req) bodyChunks.push(chunk);
    }
    const body = bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : null;

    const fetchReq = new Request(fullUrl, {
      method: req.method,
      headers: requestHeaders,
      body: (req.method !== 'GET' && req.method !== 'HEAD') ? body : null,
    });

    const response = await worker.fetch(fetchReq, mockEnv);

    res.statusCode = response.status;
    response.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Server error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error', details: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Local server running at http://localhost:${PORT}/`);
  console.log(`   Interactive Workbench: http://localhost:${PORT}/`);
  console.log(`   OpenAPI Spec: http://localhost:${PORT}/api/openapi.json`);
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   Multi-Country Holidays: http://localhost:${PORT}/api/v2/holidays/US/2026/CA\n`);
});
