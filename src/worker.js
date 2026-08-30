// Cloudflare Worker for India Holidays API
// Handles routing, metadata, and holiday querying with static asset bindings

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: CORS_HEADERS,
      });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    try {
      // Route: /api/meta/states
      if (path === '/api/meta/states' || path === '/api/meta/states.json' || path === '/meta/states.json') {
        return await serveFile(env, request, 'meta/states.json');
      }

      // Route: /api/meta/types
      if (path === '/api/meta/types' || path === '/api/meta/types.json' || path === '/meta/types.json') {
        return await serveFile(env, request, 'meta/types.json');
      }

      // Route: /api/holidays/:year (e.g., /api/holidays/2024)
      const yearMatch = path.match(/^\/api\/holidays\/(\d{4})(?:\.json)?$/);
      if (yearMatch) {
        const year = yearMatch[1];
        return await serveYearHolidays(env, request, year, url.searchParams);
      }

      // Route: /api/holidays/:year/:state (e.g., /api/holidays/2024/MH)
      const stateMatch = path.match(/^\/api\/holidays\/(\d{4})\/([A-Za-z]{2})(?:\.json)?$/);
      if (stateMatch) {
        const year = stateMatch[1];
        const stateCode = stateMatch[2].toUpperCase();
        return await serveStateHolidays(env, request, year, stateCode, url.searchParams);
      }

      // Route: /api/holidays with query params (e.g., ?year=2024&state=MH)
      if (path === '/api/holidays' || path === '/api/holidays.json') {
        return await serveQueryHolidays(env, request, url.searchParams);
      }

      // Route: /api/health or /health
      if (path === '/api/health' || path === '/health' || path === '/api/health.json') {
        return new Response(
          JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: env?.API_VERSION || '1.0.0',
            timezone: env?.TIMEZONE || 'Asia/Kolkata',
          }),
          {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      // Root endpoint - API info
      if (path === '/' || path === '/api' || path === '/api/') {
        return new Response(
          JSON.stringify({
            name: 'India Holidays API',
            version: env?.API_VERSION || '1.0.0',
            description: 'Free, fast, reliable API for Indian holidays',
            timezone: env?.TIMEZONE || 'Asia/Kolkata',
            endpoints: {
              'GET /api/holidays/:year': 'Get all holidays for a year',
              'GET /api/holidays/:year/:state': 'Get holidays for a specific state',
              'GET /api/holidays?year=&state=&type=&date=': 'Filter holidays by query params',
              'GET /api/meta/states': 'List supported states',
              'GET /api/meta/types': 'List holiday types',
              'GET /api/health': 'Health check status',
            },
          }, null, 2),
          {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      // Try serving static asset directly if bound
      if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        try {
          const assetResponse = await env.ASSETS.fetch(request);
          if (assetResponse && assetResponse.status !== 404) {
            return assetResponse;
          }
        } catch (e) {
          // Continue to 404 handler
        }
      }

      // 404 for unknown routes
      return new Response(
        JSON.stringify({ error: 'Not found', path: path }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};

/**
 * Load JSON data from ASSETS binding, origin, or fallback
 */
async function loadJson(env, request, relativePath) {
  const cleanPath = relativePath.replace(/^\/+/, '').replace(/^data\/+/, '');

  // 1. Try Cloudflare Workers ASSETS binding
  if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
    try {
      // Try root relative path
      let response = await env.ASSETS.fetch(new URL(`/${cleanPath}`, request.url));
      if (!response.ok) {
        // Try prefixed with /data/
        response = await env.ASSETS.fetch(new URL(`/data/${cleanPath}`, request.url));
      }
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      // proceed to fallback
    }
  }

  // 2. Fallback to mock / injected data store if provided in env (e.g. for testing)
  if (env && env.__DATA_STORE__ && env.__DATA_STORE__[cleanPath]) {
    return env.__DATA_STORE__[cleanPath];
  }

  // 3. Fallback to environment URL or origin if configured
  const baseUrl = env?.API_HOST || env?.DATA_BASE_URL;
  if (baseUrl) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/${cleanPath}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      // ignore
    }
  }

  return null;
}

async function serveFile(env, request, filePath) {
  const data = await loadJson(env, request, filePath);
  if (!data) {
    return new Response(
      JSON.stringify({ error: `File not found: ${filePath}` }),
      {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function serveYearHolidays(env, request, year, params) {
  // Fetch national holidays
  const nationalData = await loadJson(env, request, `${year}/national.json`);
  let holidays = Array.isArray(nationalData) ? [...nationalData] : [];

  // If state filter is provided, also fetch state holidays
  const stateCode = params.get('state');
  if (stateCode) {
    const stateData = await loadJson(env, request, `${year}/${stateCode.toUpperCase()}.json`);
    if (Array.isArray(stateData)) {
      holidays = [...holidays, ...stateData];
    }
  }

  if (holidays.length === 0 && !nationalData) {
    return new Response(
      JSON.stringify({ error: `No holiday data found for year: ${year}` }),
      {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  // Filter by type if provided
  const typeFilter = params.get('type');
  if (typeFilter) {
    holidays = holidays.filter((h) => h.type === typeFilter);
  }

  // Filter by date if provided
  const dateFilter = params.get('date');
  if (dateFilter) {
    holidays = holidays.filter((h) => h.date === dateFilter);
  }

  // Sort by date
  holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

  return new Response(JSON.stringify(holidays, null, 2), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function serveStateHolidays(env, request, year, stateCode, params) {
  // Fetch national holidays
  const nationalData = await loadJson(env, request, `${year}/national.json`);
  let holidays = Array.isArray(nationalData) ? [...nationalData] : [];

  // Fetch state holidays
  const stateData = await loadJson(env, request, `${year}/${stateCode}.json`);
  if (Array.isArray(stateData)) {
    holidays = [...holidays, ...stateData];
  } else if (!nationalData) {
    return new Response(
      JSON.stringify({ error: `No holiday data found for ${year}/${stateCode}` }),
      {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  // Filter by type if provided
  const typeFilter = params.get('type');
  if (typeFilter) {
    holidays = holidays.filter((h) => h.type === typeFilter);
  }

  // Filter by date if provided
  const dateFilter = params.get('date');
  if (dateFilter) {
    holidays = holidays.filter((h) => h.date === dateFilter);
  }

  // Sort by date
  holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

  return new Response(JSON.stringify(holidays, null, 2), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function serveQueryHolidays(env, request, params) {
  const year = params.get('year') || new Date().getFullYear().toString();
  const stateCode = params.get('state');
  const typeFilter = params.get('type');
  const dateFilter = params.get('date');

  let holidays = [];

  // Fetch national holidays
  const nationalData = await loadJson(env, request, `${year}/national.json`);
  if (Array.isArray(nationalData)) {
    holidays = [...nationalData];
  }

  // Fetch state holidays if specified
  if (stateCode) {
    const stateData = await loadJson(env, request, `${year}/${stateCode.toUpperCase()}.json`);
    if (Array.isArray(stateData)) {
      holidays = [...holidays, ...stateData];
    }
  } else {
    // If no state specified, only return national holidays
    holidays = holidays.filter((h) => h.state_code === 'IN');
  }

  // Apply filters
  if (typeFilter) {
    holidays = holidays.filter((h) => h.type === typeFilter);
  }

  if (dateFilter) {
    holidays = holidays.filter((h) => h.date === dateFilter);
  }

  // Sort by date
  holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

  return new Response(JSON.stringify(holidays, null, 2), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
