// Cloudflare Worker for India Holidays API
// Handles routing and query parameter filtering

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
      if (path === '/api/meta/states' || path === '/api/meta/states.json') {
        return await serveFile('/data/meta/states.json');
      }

      // Route: /api/meta/types
      if (path === '/api/meta/types' || path === '/api/meta/types.json') {
        return await serveFile('/data/meta/types.json');
      }

      // Route: /api/holidays/:year (e.g., /api/holidays/2024)
      const yearMatch = path.match(/^\/api\/holidays\/(\d{4})(?:\.json)?$/);
      if (yearMatch) {
        const year = yearMatch[1];
        return await serveYearHolidays(year, url.searchParams);
      }

      // Route: /api/holidays/:year/:state (e.g., /api/holidays/2024/MH)
      const stateMatch = path.match(/^\/api\/holidays\/(\d{4})\/([A-Z]{2})(?:\.json)?$/);
      if (stateMatch) {
        const year = stateMatch[1];
        const stateCode = stateMatch[2];
        return await serveStateHolidays(year, stateCode, url.searchParams);
      }

      // Route: /api/holidays with query params (e.g., ?year=2024&state=MH)
      if (path === '/api/holidays' || path === '/api/holidays.json') {
        return await serveQueryHolidays(url.searchParams);
      }

      // Root endpoint - API info
      if (path === '/' || path === '/api' || path === '/api/') {
        return new Response(
          JSON.stringify({
            name: 'India Holidays API',
            version: '1.0.0',
            description: 'Free, fast, reliable API for Indian holidays',
            timezone: 'Asia/Kolkata',
            endpoints: {
              'GET /api/holidays/:year': 'Get all holidays for a year',
              'GET /api/holidays/:year/:state': 'Get holidays for a specific state',
              'GET /api/holidays?year=&state=&type=': 'Filter holidays by query params',
              'GET /api/meta/states': 'List supported states',
              'GET /api/meta/types': 'List holiday types',
            },
          }),
          {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
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

async function serveFile(filePath) {
  try {
    const response = await fetch(`https://india-holidays.pages.dev${filePath}`);
    if (!response.ok) {
      throw new Error(`File not found: ${filePath}`);
    }
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    throw new Error(`Failed to load ${filePath}: ${error.message}`);
  }
}

async function serveYearHolidays(year, params) {
  try {
    // Fetch national holidays
    const nationalResponse = await fetch(`https://india-holidays.pages.dev/data/${year}/national.json`);
    let holidays = [];
    
    if (nationalResponse.ok) {
      holidays = await nationalResponse.json();
    }

    // If state filter is provided, also fetch state holidays
    const stateCode = params.get('state');
    if (stateCode) {
      const stateResponse = await fetch(`https://india-holidays.pages.dev/data/${year}/${stateCode}.json`);
      if (stateResponse.ok) {
        const stateHolidays = await stateResponse.json();
        holidays = [...holidays, ...stateHolidays];
      }
    }

    // Filter by type if provided
    const typeFilter = params.get('type');
    if (typeFilter) {
      holidays = holidays.filter(h => h.type === typeFilter);
    }

    // Sort by date
    holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

    return new Response(JSON.stringify(holidays), {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    throw new Error(`Failed to load holidays for ${year}: ${error.message}`);
  }
}

async function serveStateHolidays(year, stateCode, params) {
  try {
    // Fetch national holidays
    const nationalResponse = await fetch(`https://india-holidays.pages.dev/data/${year}/national.json`);
    let holidays = [];
    
    if (nationalResponse.ok) {
      holidays = await nationalResponse.json();
    }

    // Fetch state holidays
    const stateResponse = await fetch(`https://india-holidays.pages.dev/data/${year}/${stateCode}.json`);
    if (stateResponse.ok) {
      const stateHolidays = await stateResponse.json();
      holidays = [...holidays, ...stateHolidays];
    }

    // Filter by type if provided
    const typeFilter = params.get('type');
    if (typeFilter) {
      holidays = holidays.filter(h => h.type === typeFilter);
    }

    // Sort by date
    holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

    return new Response(JSON.stringify(holidays), {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    throw new Error(`Failed to load holidays for ${year}/${stateCode}: ${error.message}`);
  }
}

async function serveQueryHolidays(params) {
  const year = params.get('year') || new Date().getFullYear().toString();
  const stateCode = params.get('state');
  const typeFilter = params.get('type');
  const dateFilter = params.get('date');

  try {
    let holidays = [];

    // Fetch national holidays
    const nationalResponse = await fetch(`https://india-holidays.pages.dev/data/${year}/national.json`);
    if (nationalResponse.ok) {
      holidays = await nationalResponse.json();
    }

    // Fetch state holidays if specified
    if (stateCode) {
      const stateResponse = await fetch(`https://india-holidays.pages.dev/data/${year}/${stateCode}.json`);
      if (stateResponse.ok) {
        const stateHolidays = await stateResponse.json();
        holidays = [...holidays, ...stateHolidays];
      }
    } else {
      // If no state specified, only return national holidays
      holidays = holidays.filter(h => h.state_code === 'IN');
    }

    // Apply filters
    if (typeFilter) {
      holidays = holidays.filter(h => h.type === typeFilter);
    }

    if (dateFilter) {
      holidays = holidays.filter(h => h.date === dateFilter);
    }

    // Sort by date
    holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

    return new Response(JSON.stringify(holidays), {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    throw new Error(`Failed to load holidays: ${error.message}`);
  }
}
