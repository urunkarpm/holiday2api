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

  // Test 2: GET / with Accept: text/html (Interactive Web UI)
  {
    const req = new Request('http://localhost:8787/', {
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
    });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET / with text/html should return 200');
    const html = await res.text();
    assert(html.includes('<!DOCTYPE html>') && html.includes('India Holidays API'), 'Should return HTML UI');
    console.log('✔ GET / (Interactive HTML UI) passed');
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

  console.log('\n🎉 All 15 tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
