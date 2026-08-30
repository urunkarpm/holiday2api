import fs from 'fs';
import path from 'path';
import worker from '../src/worker.js';

const projectRoot = process.cwd();

const ALLOWED_ROOTS = [
  path.resolve(projectRoot, 'data'),
  path.resolve(projectRoot, 'public'),
];

function isPathInside(childPath, parentDir) {
  const rel = path.relative(parentDir, childPath);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function resolveSafeAssetPath(reqPath) {
  // Strip null bytes and normalize
  const sanitized = reqPath.replace(/\0/g, '').replace(/^\/+/, '').replace(/^data\/+/, '');
  for (const rootDir of ALLOWED_ROOTS) {
    const candidate = path.resolve(rootDir, sanitized);
    if (isPathInside(candidate, rootDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

const env = {
  TIMEZONE: process.env.TIMEZONE || 'Asia/Kolkata',
  API_VERSION: process.env.API_VERSION || '1.0.0',
  ASSETS: {
    async fetch(input) {
      const urlStr = typeof input === 'string' ? input : (input.url ? input.url : input.toString());
      const url = new URL(urlStr, 'http://localhost');
      const filePath = resolveSafeAssetPath(url.pathname);

      if (filePath) {
        const isFont = filePath.endsWith('.ttf') || filePath.endsWith('.woff') || filePath.endsWith('.woff2');
        const isIcs = filePath.endsWith('.ics');
        const isHtml = filePath.endsWith('.html');
        const isCss = filePath.endsWith('.css');
        const isJs = filePath.endsWith('.js');
        const isSvg = filePath.endsWith('.svg');
        const isIco = filePath.endsWith('.ico');
        let contentType = 'application/json';
        if (isFont) {
          contentType = filePath.endsWith('.woff2') ? 'font/woff2' : (filePath.endsWith('.woff') ? 'font/woff' : 'font/ttf');
        } else if (isIcs) {
          contentType = 'text/calendar; charset=utf-8';
        } else if (isHtml) {
          contentType = 'text/html; charset=utf-8';
        } else if (isCss) {
          contentType = 'text/css; charset=utf-8';
        } else if (isJs) {
          contentType = 'application/javascript; charset=utf-8';
        } else if (isSvg) {
          contentType = 'image/svg+xml';
        } else if (isIco) {
          contentType = 'image/x-icon';
        }

        const content = (isFont || isIco) ? fs.readFileSync(filePath) : fs.readFileSync(filePath, 'utf-8');
        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': (isFont || isSvg || isIco) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff',
          },
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

  const buffer = Buffer.from(await webRes.arrayBuffer());
  res.end(buffer);
}
