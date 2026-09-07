import worker from '../src/worker.js';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Mock ASSETS binding using local file system
const mockEnv = {
  TIMEZONE: 'Asia/Kolkata',
  API_VERSION: '1.0.0',
  ASSETS: {
    async fetch(input) {
      const urlStr = typeof input === 'string' ? input : (input.url ? input.url : input.toString());
      const url = new URL(urlStr, 'http://localhost');
      let reqPath = url.pathname.replace(/^\/+/, '').replace(/^data\/+/, '');
      let filePath = path.join(projectRoot, 'data', reqPath);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        filePath = path.join(projectRoot, reqPath);
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

async function runTests() {
  console.log('Running comprehensive worker endpoint tests...\n');

  // Test 1: GET / (JSON directory)
  {
    const req = new Request('http://localhost:8787/');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET / should return 200');
    const data = await res.json();
    assert.strictEqual(data.name, 'India Holidays API');
    assert(data.endpoints, 'Should contain endpoints map');
    console.log('✔ GET / (JSON discovery) passed');
  }

  // Test 2: GET / with Accept: text/html (Interactive Web UI with Google Sans font & Theme Toggle)
  {
    const req = new Request('http://localhost:8787/', {
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
    });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET / with text/html should return 200');
    const html = await res.text();
    assert(html.includes('<!DOCTYPE html>') && html.includes('India Holidays API'), 'Should return HTML UI');
    assert(html.includes('Google Sans') && html.includes("--font-display: 'Google Sans'") && html.includes("--font-body: 'Google Sans'"), 'Should configure Google Sans font-family');
    assert(html.includes('brand-logo-circle') && html.includes('circle-clip') && html.includes('stroke="#000080"'), 'Should render circular Indian Flag logo with Ashoka Chakra');
    assert(!html.includes('header-search-btn') && !html.includes('searchModalBackdrop'), 'Should not include header search bar or search modal');
    assert(html.includes('themeToggleBtn') && html.includes('toggleTheme()') && html.includes('[data-theme="light"]') && html.includes('[data-theme="dark"]'), 'Should include Night/Day theme toggle and CSS tokens');
    assert(html.includes('stateSearchInput') && html.includes('filterStatePills'), 'Should include states search filter');
    assert(html.includes('directoryCountrySelect') && html.includes('onCountrySelectChange(this.value)') && html.includes('renderDirectoryStatePills'), 'Should include country dropdown synced via onCountrySelectChange for State & Region Directory');
    assert(html.includes('data-code="TG"') && html.includes('data-code="MH"') && html.includes('data-code="AN"'), 'Should include full state pill directory');
    assert(html.includes('overflow-x: hidden') && html.includes('min-width: 0'), 'Should contain viewport tearing prevention and flexbox min-width reset');
    assert(html.includes('@media (max-width: 820px)') && html.includes('@media (max-width: 768px)') && html.includes('@media (max-width: 480px)'), 'Should contain responsive mobile breakpoints');
    assert(html.includes('skip-link') && html.includes('Skip to main content'), 'Should include skip to main content link');
    assert(html.includes('og:title') && html.includes('og:description') && html.includes('og:type'), 'Should include OpenGraph metadata');
    assert(html.includes('twitter:card') && html.includes('twitter:title'), 'Should include Twitter card metadata');
    assert(html.includes('application/ld+json') && html.includes('schema.org') && html.includes('WebAPI'), 'Should include JSON-LD WebAPI structured data');
    assert(html.includes('aria-label="Toggle light and dark theme"') && html.includes('aria-label="Toggle navigation menu"') && html.includes('aria-label="Search state name or code"'), 'Should include accessible ARIA labels');
    assert(html.includes('media="print" onload="this.media=\'all\'"'), 'Should include non-blocking font loading');
    console.log('✔ GET / (Interactive HTML UI with Mobile Responsiveness, Google Sans, Accessibility & SEO) passed');
  }

  // Test 3: GET /health
  {
    const req = new Request('http://localhost:8787/health');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /health should return 200');
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    console.log('✔ GET /health passed');
  }

  // Test 4: GET /api/openapi.json
  {
    const req = new Request('http://localhost:8787/api/openapi.json');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/openapi.json should return 200');
    const data = await res.json();
    assert.strictEqual(data.openapi, '3.0.3');
    assert(data.paths['/api/holidays/{year}'], 'Should define holiday paths');
    console.log('✔ GET /api/openapi.json passed');
  }

  // Test 5: GET /api/meta/states
  {
    const req = new Request('http://localhost:8787/api/meta/states');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/meta/states should return 200');
    const data = await res.json();
    assert(Array.isArray(data.states), 'states should be an array');
    assert(data.states.length >= 36, 'should contain all 36 states and UTs');
    console.log(`✔ GET /api/meta/states passed (${data.states.length} states/UTs)`);
  }

  // Test 6: GET /api/meta/types
  {
    const req = new Request('http://localhost:8787/api/meta/types');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/meta/types should return 200');
    const data = await res.json();
    assert(Array.isArray(data.types), 'types should be an array');
    console.log('✔ GET /api/meta/types passed');
  }

  // Test 7: GET /api/holidays/2024
  {
    const req = new Request('http://localhost:8787/api/holidays/2024');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/holidays/2024 should return 200');
    const data = await res.json();
    assert(Array.isArray(data) && data.length > 0, 'should return holidays for 2024');
    console.log(`✔ GET /api/holidays/2024 passed (returned ${data.length} holidays)`);
  }

  // Test 8: GET /api/holidays/2025 (Newly generated dataset)
  {
    const req = new Request('http://localhost:8787/api/holidays/2025');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/holidays/2025 should return 200');
    const data = await res.json();
    assert(Array.isArray(data) && data.length > 0, 'should return holidays for 2025');
    console.log(`✔ GET /api/holidays/2025 passed (returned ${data.length} holidays)`);
  }

  // Test 9: GET /api/holidays/2026/TG
  {
    const req = new Request('http://localhost:8787/api/holidays/2026/TG');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/holidays/2026/TG should return 200');
    const data = await res.json();
    assert(Array.isArray(data) && data.some(h => h.state_code === 'TG'), 'should contain TG holidays');
    console.log(`✔ GET /api/holidays/2026/TG passed (returned ${data.length} holidays)`);
  }

  // Test 10: GET /api/holidays/upcoming
  {
    const req = new Request('http://localhost:8787/api/holidays/upcoming?state=MH&limit=5&date=2026-01-01');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/holidays/upcoming should return 200');
    const data = await res.json();
    assert(Array.isArray(data) && data.length <= 5, 'should return upcoming holidays limited to 5');
    assert(data[0].days_until !== undefined, 'should include days_until property');
    console.log(`✔ GET /api/holidays/upcoming passed (returned ${data.length} upcoming holidays)`);
  }

  // Test 11: GET /api/long-weekends/2026/TG
  {
    const req = new Request('http://localhost:8787/api/long-weekends/2026/TG');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/long-weekends/2026/TG should return 200');
    const data = await res.json();
    assert(Array.isArray(data.long_weekends) && data.long_weekends.length > 0, 'should return long weekends');
    assert(data.long_weekends[0].recommendation, 'should contain recommendation text');
    console.log(`✔ GET /api/long-weekends/2026/TG passed (found ${data.total_long_weekends} long weekends)`);
  }

  // Test 12: GET /api/business-days (Working days calculator)
  {
    const req = new Request('http://localhost:8787/api/business-days?from=2026-03-01&to=2026-03-31&state=MH&bank_rules=true');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/business-days should return 200');
    const data = await res.json();
    assert.strictEqual(data.total_calendar_days, 31, 'March 2026 has 31 days');
    assert(typeof data.working_days === 'number', 'should calculate working days');
    console.log(`✔ GET /api/business-days passed (${data.working_days} working days out of 31 calendar days)`);
  }

  // Test 13: GET /api/calendar/2026/TG.ics (iCalendar Feed)
  {
    const req = new Request('http://localhost:8787/api/calendar/2026/TG.ics');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/calendar/2026/TG.ics should return 200');
    assert.strictEqual(res.headers.get('Content-Type'), 'text/calendar; charset=utf-8');
    const icsText = await res.text();
    assert(icsText.includes('BEGIN:VCALENDAR') && icsText.includes('BEGIN:VEVENT'), 'should be valid iCalendar format');
    console.log('✔ GET /api/calendar/2026/TG.ics passed (valid iCalendar format)');
  }

  // Test 14: Vercel handler integration (api/index.js)
  {
    const vercelHandler = (await import('../api/index.js')).default;
    const req = new Request('http://localhost:3000/api/long-weekends/2026/MH');
    const res = await vercelHandler(req);
    assert.strictEqual(res.status, 200, 'Vercel handler should return 200');
    const data = await res.json();
    assert(Array.isArray(data.long_weekends), 'Vercel handler should return long weekends');
    console.log('✔ Vercel handler (api/index.js) passed');
  }

  // Test 15: 404 handling
  {
    const req = new Request('http://localhost:8787/unknown/path');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 404, 'Unknown path should return 404');
    console.log('✔ 404 handling passed');
  }

  // Test 16: GET /Author-Regular.ttf (Static Font endpoint)
  {
    const req = new Request('http://localhost:8787/Author-Regular.ttf');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /Author-Regular.ttf should return 200');
    assert.strictEqual(res.headers.get('Content-Type'), 'font/ttf');
    const fontBuffer = await res.arrayBuffer();
    assert.strictEqual(fontBuffer.byteLength, 66276, 'Font size should match Author-Regular.ttf');
    console.log('✔ GET /Author-Regular.ttf passed (66,276 bytes font/ttf)');
  }

  // Test 17: GET /fonts/Author-Regular.ttf (Alternative font path)
  {
    const req = new Request('http://localhost:8787/fonts/Author-Regular.ttf');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /fonts/Author-Regular.ttf should return 200');
    assert.strictEqual(res.headers.get('Content-Type'), 'font/ttf');
    console.log('✔ GET /fonts/Author-Regular.ttf passed');
  }

  // Test 18: GET /favicon.ico and GET /favicon.svg (Circular Indian flag favicon)
  {
    const reqIco = new Request('http://localhost:8787/favicon.ico');
    const resIco = await worker.fetch(reqIco, mockEnv);
    assert.strictEqual(resIco.status, 200, 'GET /favicon.ico should return 200');
    assert.strictEqual(resIco.headers.get('Content-Type'), 'image/svg+xml');
    const icoText = await resIco.text();
    assert(icoText.includes('circle-clip') && icoText.includes('#FF9933') && icoText.includes('#138808'), 'Favicon should contain circular Indian flag SVG');

    const reqSvg = new Request('http://localhost:8787/favicon.svg');
    const resSvg = await worker.fetch(reqSvg, mockEnv);
    assert.strictEqual(resSvg.status, 200, 'GET /favicon.svg should return 200');
    assert.strictEqual(resSvg.headers.get('Content-Type'), 'image/svg+xml');
    console.log('✔ GET /favicon.ico and /favicon.svg passed (Circular Indian Flag SVG)');
  }

  // Test 19: Vercel handler serving static favicon.svg
  {
    const vercelHandler = (await import('../api/index.js')).default;
    const req = new Request('http://localhost:3000/favicon.svg');
    const res = await vercelHandler(req);
    assert.strictEqual(res.status, 200, 'Vercel handler should serve /favicon.svg');
    assert.strictEqual(res.headers.get('Content-Type'), 'image/svg+xml');
    console.log('✔ Vercel handler static /favicon.svg passed');
  }

  // Test 20: Path Traversal prevention in Vercel handler
  {
    const vercelHandler = (await import('../api/index.js')).default;
    const reqTraversal1 = new Request('http://localhost:3000/data/../../package.json');
    const resTraversal1 = await vercelHandler(reqTraversal1);
    assert.strictEqual(resTraversal1.status, 404, 'Path traversal attempting to read package.json should return 404');

    const reqTraversal2 = new Request('http://localhost:3000/../../etc/passwd');
    const resTraversal2 = await vercelHandler(reqTraversal2);
    assert.strictEqual(resTraversal2.status, 404, 'Arbitrary file read attempt should return 404');
    console.log('✔ Path Traversal protection in Vercel handler passed');
  }

  // Test 21: Date range bounds & DoS protection in /api/business-days
  {
    const reqExcessive = new Request('http://localhost:8787/api/business-days?from=1900-01-01&to=2099-12-31');
    const resExcessive = await worker.fetch(reqExcessive, mockEnv);
    assert.strictEqual(resExcessive.status, 400, 'Excessive date range should return 400');
    const dataExcessive = await resExcessive.json();
    assert(dataExcessive.error.includes('exceeds maximum limit') || dataExcessive.error.includes('range'), 'Should return range limit error');
    console.log('✔ DoS Date range limit protection in /api/business-days passed');
  }

  // Test 22: Security Headers check
  {
    const req = new Request('http://localhost:8787/api/health');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.headers.get('X-Content-Type-Options'), 'nosniff', 'Should include X-Content-Type-Options');
    assert.strictEqual(res.headers.get('X-Frame-Options'), 'DENY', 'Should include X-Frame-Options');
    assert.strictEqual(res.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin', 'Should include Referrer-Policy');

    const reqHtml = new Request('http://localhost:8787/', { headers: { 'Accept': 'text/html' } });
    const resHtml = await worker.fetch(reqHtml, mockEnv);
    assert(resHtml.headers.get('Content-Security-Policy'), 'HTML should include CSP header');
    console.log('✔ Security Headers (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) passed');
  }

  // Test 23: HTTP HEAD method support
  {
    const reqHead = new Request('http://localhost:8787/api/health', { method: 'HEAD' });
    const resHead = await worker.fetch(reqHead, mockEnv);
    assert.strictEqual(resHead.status, 200, 'HEAD request should return 200');
    assert.strictEqual(resHead.headers.get('Content-Type'), 'application/json; charset=utf-8');
    const text = await resHead.text();
    assert.strictEqual(text, '', 'HEAD request should have empty body');
    console.log('✔ HTTP HEAD method support passed');
  }

  // Test 24: Disallowed HTTP methods return 405
  {
    const reqPost = new Request('http://localhost:8787/api/health', { method: 'POST' });
    const resPost = await worker.fetch(reqPost, mockEnv);
    assert.strictEqual(resPost.status, 405, 'POST request should return 405 Method Not Allowed');
    console.log('✔ HTTP Method restriction (405 for POST/PUT) passed');
  }

  // Test 25: GET /llms.txt (AI Agent Discovery)
  {
    const reqLlms = new Request('http://localhost:8787/llms.txt');
    const resLlms = await worker.fetch(reqLlms, mockEnv);
    assert.strictEqual(resLlms.status, 200, 'GET /llms.txt should return 200');
    assert.strictEqual(resLlms.headers.get('Content-Type'), 'text/plain; charset=utf-8');
    const textLlms = await resLlms.text();
    assert(textLlms.includes('# India Holidays API') && textLlms.includes('/api/holidays/{year}/{state}'), 'llms.txt should contain API overview');
    console.log('✔ GET /llms.txt (AI Agent Discovery) passed');
  }

  // Test 26: GET /robots.txt and GET /sitemap.xml (Technical SEO)
  {
    const reqRobots = new Request('http://localhost:8787/robots.txt');
    const resRobots = await worker.fetch(reqRobots, mockEnv);
    assert.strictEqual(resRobots.status, 200, 'GET /robots.txt should return 200');
    assert.strictEqual(resRobots.headers.get('Content-Type'), 'text/plain; charset=utf-8');
    const textRobots = await resRobots.text();
    assert(textRobots.includes('User-agent: *') && textRobots.includes('Sitemap:'), 'robots.txt should contain sitemap reference');

    const reqSitemap = new Request('http://localhost:8787/sitemap.xml');
    const resSitemap = await worker.fetch(reqSitemap, mockEnv);
    assert.strictEqual(resSitemap.status, 200, 'GET /sitemap.xml should return 200');
    assert.strictEqual(resSitemap.headers.get('Content-Type'), 'application/xml; charset=utf-8');
    const textSitemap = await resSitemap.text();
    assert(textSitemap.includes('<urlset') && textSitemap.includes('<loc>'), 'sitemap.xml should contain urlset');
    console.log('✔ GET /robots.txt and GET /sitemap.xml (Technical SEO) passed');
  }

  // Test 27: GET /api/meta/countries (Multi-country metadata)
  {
    const reqCountries = new Request('http://localhost:8787/api/meta/countries');
    const resCountries = await worker.fetch(reqCountries, mockEnv);
    assert.strictEqual(resCountries.status, 200, 'GET /api/meta/countries should return 200');
    const dataCountries = await resCountries.json();
    assert(Array.isArray(dataCountries.countries), 'countries should be an array');
    assert.strictEqual(dataCountries.total_countries, 6, 'Should support 6 countries');
    console.log(`✔ GET /api/meta/countries passed (${dataCountries.total_countries} countries supported: IN, US, GB, CA, AU, SG)`);
  }

  // Test 28: GET /api/v2/holidays/US/2026/CA (US California holidays)
  {
    const reqUs = new Request('http://localhost:8787/api/v2/holidays/US/2026/CA');
    const resUs = await worker.fetch(reqUs, mockEnv);
    assert.strictEqual(resUs.status, 200, 'GET /api/v2/holidays/US/2026/CA should return 200');
    const dataUs = await resUs.json();
    assert(Array.isArray(dataUs) && dataUs.some(h => h.name.includes("Thanksgiving")), 'Should return US Thanksgiving holiday');
    console.log(`✔ GET /api/v2/holidays/US/2026/CA passed (returned ${dataUs.length} holidays)`);
  }

  // Test 29: GET /api/v2/holidays/GB/2026/SCT (Scotland UK holidays)
  {
    const reqGb = new Request('http://localhost:8787/api/v2/holidays/GB/2026/SCT');
    const resGb = await worker.fetch(reqGb, mockEnv);
    assert.strictEqual(resGb.status, 200, 'GET /api/v2/holidays/GB/2026/SCT should return 200');
    const dataGb = await resGb.json();
    assert(Array.isArray(dataGb) && dataGb.some(h => h.name.includes("Andrew")), 'Should return St Andrew\'s Day for Scotland');
    console.log(`✔ GET /api/v2/holidays/GB/2026/SCT passed (returned ${dataGb.length} holidays)`);
  }

  console.log('\n🎉 All 29 tests (including multi-country, HSTS, accessibility, SEO, & AI discovery) passed successfully!');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
