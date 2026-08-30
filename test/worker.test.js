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
      const url = new URL(urlStr);
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
  console.log('Running worker endpoint tests...\n');

  // Test 1: GET /
  {
    const req = new Request('http://localhost:8787/');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET / should return 200');
    const data = await res.json();
    assert.strictEqual(data.name, 'India Holidays API');
    console.log('✔ GET / passed');
  }

  // Test 2: GET /health
  {
    const req = new Request('http://localhost:8787/health');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /health should return 200');
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    console.log('✔ GET /health passed');
  }

  // Test 3: GET /api/meta/states
  {
    const req = new Request('http://localhost:8787/api/meta/states');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/meta/states should return 200');
    const data = await res.json();
    assert(Array.isArray(data.states) || Array.isArray(data), 'states should be an array');
    console.log('✔ GET /api/meta/states passed');
  }

  // Test 4: GET /api/meta/types
  {
    const req = new Request('http://localhost:8787/api/meta/types');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/meta/types should return 200');
    const data = await res.json();
    assert(Array.isArray(data.types) || Array.isArray(data), 'types should be an array');
    console.log('✔ GET /api/meta/types passed');
  }

  // Test 5: GET /api/holidays/2024
  {
    const req = new Request('http://localhost:8787/api/holidays/2024');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/holidays/2024 should return 200');
    const data = await res.json();
    assert(Array.isArray(data), 'holidays should be an array');
    assert(data.length > 0, 'should return holidays for 2024');
    console.log(`✔ GET /api/holidays/2024 passed (returned ${data.length} holidays)`);
  }

  // Test 6: GET /api/holidays/2024/MH
  {
    const req = new Request('http://localhost:8787/api/holidays/2024/MH');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'GET /api/holidays/2024/MH should return 200');
    const data = await res.json();
    assert(Array.isArray(data), 'holidays should be an array');
    assert(data.some(h => h.state_code === 'MH'), 'should contain MH state holidays');
    console.log(`✔ GET /api/holidays/2024/MH passed (returned ${data.length} holidays)`);
  }

  // Test 7: GET /api/holidays with query params ?year=2024&state=KA&type=public
  {
    const req = new Request('http://localhost:8787/api/holidays?year=2024&state=KA&type=public');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200, 'Query params filter should return 200');
    const data = await res.json();
    assert(Array.isArray(data), 'holidays should be an array');
    data.forEach(h => assert.strictEqual(h.type, 'public', 'All returned holidays should match type'));
    console.log(`✔ GET /api/holidays query filtering passed (returned ${data.length} matching holidays)`);
  }

  // Test 8: Non-existent route returns 404
  {
    const req = new Request('http://localhost:8787/unknown/path');
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 404, 'Unknown path should return 404');
    console.log('✔ 404 handling passed');
  }

  console.log('\n🎉 All tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
