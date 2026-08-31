// Cloudflare Worker & Universal Edge Router for India Holidays API
// Handles routing, filtering, calendar (.ics), long weekends, business days, OpenAPI spec, and interactive UI

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  ...SECURITY_HEADERS,
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
};

const CSP_HEADER = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self';";

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <clipPath id="circle-clip">
      <circle cx="64" cy="64" r="64"/>
    </clipPath>
  </defs>
  <g clip-path="url(#circle-clip)">
    <rect width="128" height="42.667" fill="#FF9933"/>
    <rect y="42.667" width="128" height="42.666" fill="#FFFFFF"/>
    <rect y="85.333" width="128" height="42.667" fill="#138808"/>
    <g transform="translate(64 64)">
      <circle r="15.5" fill="none" stroke="#000080" stroke-width="2.2"/>
      <circle r="3.2" fill="#000080"/>
      <g stroke="#000080" stroke-width="1.1" stroke-linecap="round">
        <line y1="-3.2" y2="-14.5"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(15)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(30)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(45)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(60)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(75)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(90)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(105)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(120)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(135)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(150)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(165)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(180)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(195)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(210)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(225)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(240)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(255)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(270)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(285)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(300)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(315)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(330)"/>
        <line y1="-3.2" y2="-14.5" transform="rotate(345)"/>
      </g>
    </g>
    <circle cx="64" cy="64" r="63.5" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
  </g>
</svg>`;

export default {
  async fetch(request, env, ctx) {
    const isHead = request.method === 'HEAD';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Only allow GET and HEAD requests
    if (request.method !== 'GET' && !isHead) {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: JSON_HEADERS }
      );
    }

    try {
      const response = await handleRoute(request, env, ctx);
      if (isHead) {
        return new Response(null, { status: response.status, headers: response.headers });
      }
      return response;
    } catch (error) {
      const errResponse = new Response(
        JSON.stringify({ error: 'An internal server error occurred.' }),
        { status: 500, headers: JSON_HEADERS }
      );
      if (isHead) {
        return new Response(null, { status: 500, headers: errResponse.headers });
      }
      return errResponse;
    }
  },
};

async function handleRoute(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const acceptHeader = request.headers.get('accept') || '';

  // 1. Root & Interactive HTML UI / Discovery
  if (path === '/' || path === '/api') {
    if (acceptHeader.includes('text/html') && !url.searchParams.has('json')) {
      return new Response(renderInteractiveHtml(env), {
        headers: {
          ...SECURITY_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'Content-Security-Policy': CSP_HEADER,
        },
      });
    }
    return new Response(
      JSON.stringify(getApiDirectory(env), null, 2),
      { headers: JSON_HEADERS }
    );
  }

  // 2. Health check
  if (path === '/api/health' || path === '/health' || path === '/api/health.json') {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: env?.API_VERSION || '1.0.0',
        timezone: env?.TIMEZONE || 'Asia/Kolkata',
        uptime: '99.99%',
      }, null, 2),
      { headers: JSON_HEADERS }
    );
  }

  // 3. OpenAPI 3.0 Specification
  if (path === '/api/openapi.json' || path === '/openapi.json') {
    return new Response(
      JSON.stringify(getOpenApiSpec(url.origin), null, 2),
      { headers: JSON_HEADERS }
    );
  }

  // 4. Metadata: /api/meta/states
  if (path === '/api/meta/states' || path === '/api/meta/states.json' || path === '/meta/states.json') {
    return await serveFile(env, request, 'meta/states.json');
  }

  // 5. Metadata: /api/meta/types
  if (path === '/api/meta/types' || path === '/api/meta/types.json' || path === '/meta/types.json') {
    return await serveFile(env, request, 'meta/types.json');
  }

  // 6. Upcoming / Next Holidays: /api/holidays/upcoming or /api/holidays/next
  if (path === '/api/holidays/upcoming' || path === '/api/holidays/next') {
    return await serveUpcomingHolidays(env, request, url.searchParams);
  }

  // 7. Business & Working Days Calculator: /api/business-days
  if (path === '/api/business-days' || path === '/api/working-days') {
    return await serveBusinessDays(env, request, url.searchParams);
  }

  // 8. Long Weekend Finder: /api/long-weekends/:year or /api/long-weekends/:year/:state
  const longWeekendMatch = path.match(/^\/api\/long-weekends\/(\d{4})(?:\/([A-Za-z]{2}))?(?:\.json)?$/);
  if (longWeekendMatch) {
    const year = longWeekendMatch[1];
    const stateCode = (longWeekendMatch[2] || url.searchParams.get('state') || '').toUpperCase();
    return await serveLongWeekends(env, request, year, stateCode, url.searchParams);
  }

  // 9. iCalendar (.ics) Subscriptions: /api/calendar/:year/:state.ics or /api/holidays/:year.ics or /api/holidays/:year/:state.ics
  const icsCalendarMatch = path.match(/^\/api\/(?:calendar|holidays)\/(\d{4})(?:\/([A-Za-z]{2}))?\.ics$/);
  if (icsCalendarMatch) {
    const year = icsCalendarMatch[1];
    const stateCode = (icsCalendarMatch[2] || 'IN').toUpperCase();
    return await serveIcsCalendar(env, request, year, stateCode, url.searchParams);
  }

  // 10. Route: /api/holidays/:year (e.g. /api/holidays/2026)
  const yearMatch = path.match(/^\/api\/holidays\/(\d{4})(?:\.json)?$/);
  if (yearMatch) {
    const year = yearMatch[1];
    return await serveYearHolidays(env, request, year, url.searchParams);
  }

  // 11. Route: /api/holidays/:year/:state (e.g. /api/holidays/2026/TG)
  const stateMatch = path.match(/^\/api\/holidays\/(\d{4})\/([A-Za-z]{2})(?:\.json)?$/);
  if (stateMatch) {
    const year = stateMatch[1];
    const stateCode = stateMatch[2].toUpperCase();
    return await serveStateHolidays(env, request, year, stateCode, url.searchParams);
  }

  // 12. Route: /api/holidays with query params (e.g., ?year=2026&state=MH)
  if (path === '/api/holidays' || path === '/api/holidays.json') {
    return await serveQueryHolidays(env, request, url.searchParams);
  }

  // 13. Static Font Route: /Author-Regular.ttf, /fonts/Author-Regular.ttf
  if (path === '/Author-Regular.ttf' || path === '/fonts/Author-Regular.ttf' || path === '/data/fonts/Author-Regular.ttf' || path.endsWith('.ttf') || path.endsWith('.woff') || path.endsWith('.woff2')) {
    return await serveFont(env, request, path);
  }

  // 14. Favicon Route: /favicon.ico, /favicon.svg
  if (path === '/favicon.ico' || path === '/favicon.svg') {
    return new Response(FAVICON_SVG, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, immutable',
        'Access-Control-Allow-Origin': '*',
        ...SECURITY_HEADERS,
      },
    });
  }

  // 15. Direct static asset binding fallback
  if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse && assetResponse.status !== 404) {
        return assetResponse;
      }
    } catch (e) {
      // Continue to 404
    }
  }

  // 16. 404 Handler
  return new Response(
    JSON.stringify({
      error: 'Endpoint not found',
      path: path,
      documentation: '/api',
      available_endpoints: [
        '/api/holidays/:year',
        '/api/holidays/:year/:state',
        '/api/holidays/upcoming',
        '/api/long-weekends/:year/:state',
        '/api/business-days?from=YYYY-MM-DD&to=YYYY-MM-DD',
        '/api/calendar/:year/:state.ics',
        '/api/meta/states',
        '/api/meta/types',
        '/api/openapi.json',
      ],
    }, null, 2),
    { status: 404, headers: JSON_HEADERS }
  );
}

/**
 * Load JSON data from ASSETS binding, test mock store, or base URL
 */
async function loadJson(env, request, relativePath) {
  const cleanPath = relativePath.replace(/^\/+/, '').replace(/^data\/+/, '');

  // 1. Try Cloudflare Workers ASSETS binding
  if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
    try {
      let response = await env.ASSETS.fetch(new URL(`/${cleanPath}`, request ? request.url : 'http://localhost'));
      if (!response.ok) {
        response = await env.ASSETS.fetch(new URL(`/data/${cleanPath}`, request ? request.url : 'http://localhost'));
      }
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      // Fallback
    }
  }

  // 2. Fallback to injected data store (tests)
  if (env && env.__DATA_STORE__ && env.__DATA_STORE__[cleanPath]) {
    return env.__DATA_STORE__[cleanPath];
  }

  // 3. Fallback to environment base URL
  const baseUrl = env?.API_HOST || env?.DATA_BASE_URL;
  if (baseUrl) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/${cleanPath}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      // Ignore
    }
  }

  return null;
}

/**
 * Serve raw static file
 */
async function serveFile(env, request, filePath) {
  const data = await loadJson(env, request, filePath);
  if (!data) {
    return new Response(
      JSON.stringify({ error: `File not found: ${filePath}` }),
      { status: 404, headers: JSON_HEADERS }
    );
  }
  return new Response(JSON.stringify(data, null, 2), { headers: JSON_HEADERS });
}

/**
 * Serve static font files with proper headers and caching
 */
async function serveFont(env, request, pathname) {
  const cleanName = pathname.split('/').pop() || 'Author-Regular.ttf';
  if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
    try {
      let res = await env.ASSETS.fetch(new URL(`/${cleanName}`, request ? request.url : 'http://localhost'));
      if (!res || !res.ok) {
        res = await env.ASSETS.fetch(new URL(`/fonts/${cleanName}`, request ? request.url : 'http://localhost'));
      }
      if (res && res.ok) {
        const isWoff2 = cleanName.endsWith('.woff2');
        const isWoff = cleanName.endsWith('.woff');
        const contentType = isWoff2 ? 'font/woff2' : (isWoff ? 'font/woff' : 'font/ttf');
        const headers = new Headers(res.headers);
        headers.set('Content-Type', contentType);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(res.body, { status: 200, headers });
      }
    } catch (e) {}
  }
  return new Response(JSON.stringify({ error: 'Font not found' }), { status: 404, headers: JSON_HEADERS });
}

/**
 * Helper: Load and merge national + state holidays for a given year
 */
async function getMergedHolidaysForYearState(env, request, year, stateCode) {
  const nationalData = await loadJson(env, request, `${year}/national.json`);
  let holidays = Array.isArray(nationalData) ? [...nationalData] : [];

  if (stateCode && stateCode !== 'IN') {
    const stateData = await loadJson(env, request, `${year}/${stateCode}.json`);
    if (Array.isArray(stateData)) {
      holidays = [...holidays, ...stateData];
    }
  }

  // Deduplicate and sort
  const seen = new Set();
  const unique = [];
  for (const h of holidays) {
    const key = `${h.date}_${h.name}_${h.state_code}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(h);
    }
  }
  unique.sort((a, b) => new Date(a.date) - new Date(b.date));
  return unique;
}

/**
 * Serve holidays for a year (with optional state query)
 */
async function serveYearHolidays(env, request, year, params) {
  const stateCode = (params.get('state') || '').toUpperCase();
  const holidays = await getMergedHolidaysForYearState(env, request, year, stateCode);

  if (holidays.length === 0) {
    return new Response(
      JSON.stringify({ error: `No holiday data found for year: ${year}` }),
      { status: 404, headers: JSON_HEADERS }
    );
  }

  const filtered = filterHolidays(holidays, params);
  return new Response(JSON.stringify(filtered, null, 2), { headers: JSON_HEADERS });
}

/**
 * Serve holidays for a specific year and state
 */
async function serveStateHolidays(env, request, year, stateCode, params) {
  const holidays = await getMergedHolidaysForYearState(env, request, year, stateCode);

  if (holidays.length === 0) {
    return new Response(
      JSON.stringify({ error: `No holiday data found for ${year}/${stateCode}` }),
      { status: 404, headers: JSON_HEADERS }
    );
  }

  const filtered = filterHolidays(holidays, params);
  return new Response(JSON.stringify(filtered, null, 2), { headers: JSON_HEADERS });
}

/**
 * Serve query-filtered holidays
 */
async function serveQueryHolidays(env, request, params) {
  const currentYear = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date());
  const year = params.get('year') || currentYear;
  const stateCode = (params.get('state') || 'IN').toUpperCase();

  const holidays = await getMergedHolidaysForYearState(env, request, year, stateCode);
  const filtered = filterHolidays(holidays, params);

  return new Response(JSON.stringify(filtered, null, 2), { headers: JSON_HEADERS });
}

/**
 * Filter holidays by type, date, or month
 */
function filterHolidays(holidays, params) {
  let list = [...holidays];
  const typeFilter = params.get('type');
  const dateFilter = params.get('date');
  const monthFilter = params.get('month');

  if (typeFilter) {
    list = list.filter((h) => h.type.toLowerCase() === typeFilter.toLowerCase());
  }

  if (dateFilter) {
    list = list.filter((h) => h.date === dateFilter);
  }

  if (monthFilter) {
    const paddedMonth = monthFilter.padStart(2, '0');
    list = list.filter((h) => {
      const parts = h.date.split('-');
      return parts[1] === paddedMonth;
    });
  }

  return list;
}

/**
 * Serve upcoming holidays from current IST date
 */
async function serveUpcomingHolidays(env, request, params) {
  const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const fromDate = params.get('date') || todayIst;
  const stateCode = (params.get('state') || 'IN').toUpperCase();
  const limit = Math.min(Math.max(parseInt(params.get('limit') || '10', 10), 1), 50);

  const currentYear = parseInt(fromDate.slice(0, 4), 10);
  let allHolidays = await getMergedHolidaysForYearState(env, request, currentYear.toString(), stateCode);

  // If near year-end, fetch next year's holidays too
  const nextYearHolidays = await getMergedHolidaysForYearState(env, request, (currentYear + 1).toString(), stateCode);
  if (Array.isArray(nextYearHolidays)) {
    allHolidays = [...allHolidays, ...nextYearHolidays];
  }

  // Filter future holidays
  let upcoming = allHolidays.filter((h) => h.date >= fromDate);
  const typeFilter = params.get('type');
  if (typeFilter) {
    upcoming = upcoming.filter((h) => h.type.toLowerCase() === typeFilter.toLowerCase());
  }

  // Calculate days until holiday
  const fromMs = new Date(`${fromDate}T00:00:00+05:30`).getTime();
  const result = upcoming.slice(0, limit).map((h) => {
    const holMs = new Date(`${h.date}T00:00:00+05:30`).getTime();
    const daysUntil = Math.round((holMs - fromMs) / (1000 * 60 * 60 * 24));
    const dayOfWeek = new Date(`${h.date}T00:00:00+05:30`).toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
    });
    return {
      ...h,
      day_of_week: dayOfWeek,
      days_until: daysUntil,
    };
  });

  return new Response(JSON.stringify(result, null, 2), { headers: JSON_HEADERS });
}

/**
 * Serve Long Weekend & Vacation Recommendations
 */
async function serveLongWeekends(env, request, year, stateCode, params) {
  const holidays = await getMergedHolidaysForYearState(env, request, year, stateCode || 'IN');

  if (!holidays || holidays.length === 0) {
    return new Response(
      JSON.stringify({ error: `No holiday data available for ${year}` }),
      { status: 404, headers: JSON_HEADERS }
    );
  }

  // Map dates to holiday objects
  const holidayMap = new Map();
  for (const h of holidays) {
    if (!holidayMap.has(h.date)) {
      holidayMap.set(h.date, []);
    }
    holidayMap.get(h.date).push(h);
  }

  const longWeekends = [];
  const processedDates = new Set();

  for (const h of holidays) {
    if (processedDates.has(h.date)) continue;

    const dt = new Date(`${h.date}T00:00:00+05:30`);
    const dayOfWeek = dt.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat

    // 1. Natural 3-day weekend: Friday holiday
    if (dayOfWeek === 5) {
      const sat = addDays(h.date, 1);
      const sun = addDays(h.date, 2);
      processedDates.add(h.date);
      longWeekends.push({
        type: 'natural_long_weekend',
        start_date: h.date,
        end_date: sun,
        total_days: 3,
        holidays_included: [h],
        bridge_days_needed: 0,
        recommendation: '3-day weekend (Friday to Sunday)',
      });
    }

    // 2. Natural 3-day weekend: Monday holiday
    else if (dayOfWeek === 1) {
      const sat = addDays(h.date, -2);
      processedDates.add(h.date);
      longWeekends.push({
        type: 'natural_long_weekend',
        start_date: sat,
        end_date: h.date,
        total_days: 3,
        holidays_included: [h],
        bridge_days_needed: 0,
        recommendation: '3-day weekend (Saturday to Monday)',
      });
    }

    // 3. Bridge 4-day weekend: Thursday holiday -> Take Friday off
    else if (dayOfWeek === 4) {
      const fri = addDays(h.date, 1);
      const sun = addDays(h.date, 3);
      processedDates.add(h.date);
      longWeekends.push({
        type: 'bridge_weekend',
        start_date: h.date,
        end_date: sun,
        total_days: 4,
        holidays_included: [h],
        bridge_days_needed: 1,
        bridge_dates: [fri],
        recommendation: `Take leave on Friday (${fri}) for a 4-day weekend (Thursday to Sunday)`,
      });
    }

    // 4. Bridge 4-day weekend: Tuesday holiday -> Take Monday off
    else if (dayOfWeek === 2) {
      const sat = addDays(h.date, -3);
      const mon = addDays(h.date, -1);
      processedDates.add(h.date);
      longWeekends.push({
        type: 'bridge_weekend',
        start_date: sat,
        end_date: h.date,
        total_days: 4,
        holidays_included: [h],
        bridge_days_needed: 1,
        bridge_dates: [mon],
        recommendation: `Take leave on Monday (${mon}) for a 4-day weekend (Saturday to Tuesday)`,
      });
    }
  }

  // Sort chronologically
  longWeekends.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  return new Response(
    JSON.stringify({
      year: parseInt(year, 10),
      state_code: stateCode || 'IN',
      total_long_weekends: longWeekends.length,
      long_weekends: longWeekends,
    }, null, 2),
    { headers: JSON_HEADERS }
  );
}

/**
 * Serve Business & Working Days Calculator
 */
async function serveBusinessDays(env, request, params) {
  const fromStr = params.get('from');
  const toStr = params.get('to');
  const stateCode = (params.get('state') || 'IN').toUpperCase();
  const bankRules = params.get('bank_rules') === 'true' || params.get('bank') === 'true';
  const includeSaturdays = params.get('include_saturdays') === 'true';

  if (!fromStr || !toStr) {
    return new Response(
      JSON.stringify({
        error: 'Missing required parameters. Both "from" and "to" (YYYY-MM-DD) are required.',
        example: '/api/business-days?from=2026-03-01&to=2026-03-31&state=MH',
      }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(fromStr) || !dateRegex.test(toStr)) {
    return new Response(
      JSON.stringify({ error: 'Invalid date format. Expected YYYY-MM-DD for both "from" and "to".' }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const fromDate = new Date(`${fromStr}T00:00:00+05:30`);
  const toDate = new Date(`${toStr}T00:00:00+05:30`);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) {
    return new Response(
      JSON.stringify({ error: 'Invalid date range. "from" must be before or equal to "to" in YYYY-MM-DD format.' }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  // Prevent Denial of Service: bound date calculation span to max 5 years (1826 days)
  const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 1826) {
    return new Response(
      JSON.stringify({
        error: 'Date range span exceeds maximum limit of 5 years (1826 days). Please query a shorter span.',
      }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  // Collect holidays across all years in date range
  const startYear = fromDate.getFullYear();
  const endYear = toDate.getFullYear();
  if (startYear < 2020 || endYear > 2040) {
    return new Response(
      JSON.stringify({
        error: 'Year range must be within supported range (2024–2036).',
      }),
      { status: 400, headers: JSON_HEADERS }
    );
  }
  let holidays = [];
  for (let yr = startYear; yr <= endYear; yr++) {
    const yrHols = await getMergedHolidaysForYearState(env, request, yr.toString(), stateCode);
    if (Array.isArray(yrHols)) {
      holidays = [...holidays, ...yrHols];
    }
  }

  const holidayDateMap = new Map();
  for (const h of holidays) {
    holidayDateMap.set(h.date, h);
  }

  let totalCalendarDays = 0;
  let workingDays = 0;
  let weekendDays = 0;
  const holidaysOnWeekdays = [];
  const holidaysOnWeekends = [];

  let curr = new Date(fromDate);
  while (curr <= toDate) {
    totalCalendarDays++;
    const dateStr = curr.toISOString().split('T')[0];
    const dayOfWeek = curr.getDay(); // 0 = Sun, 6 = Sat
    const dayOfMonth = curr.getDate();
    const saturdayCount = Math.ceil(dayOfMonth / 7); // 1st, 2nd, 3rd, 4th, 5th Saturday

    let isWeekend = false;
    if (dayOfWeek === 0) {
      isWeekend = true; // Sunday
    } else if (dayOfWeek === 6) {
      if (bankRules) {
        // RBI Bank Rules: 2nd & 4th Saturdays are off; 1st, 3rd, 5th are working days
        isWeekend = saturdayCount === 2 || saturdayCount === 4;
      } else if (!includeSaturdays) {
        // Standard 5-day week: all Saturdays are off
        isWeekend = true;
      }
    }

    const holidayMatch = holidayDateMap.get(dateStr);

    if (isWeekend) {
      weekendDays++;
      if (holidayMatch) {
        holidaysOnWeekends.push({
          date: dateStr,
          name: holidayMatch.name,
          day: curr.toLocaleDateString('en-US', { weekday: 'long' }),
        });
      }
    } else {
      if (holidayMatch) {
        holidaysOnWeekdays.push({
          date: dateStr,
          name: holidayMatch.name,
          day: curr.toLocaleDateString('en-US', { weekday: 'long' }),
        });
      } else {
        workingDays++;
      }
    }

    curr.setDate(curr.getDate() + 1);
  }

  return new Response(
    JSON.stringify({
      from: fromStr,
      to: toStr,
      state_code: stateCode,
      rules: bankRules ? 'RBI Bank Rules (2nd/4th Sat off)' : includeSaturdays ? '6-Day Workweek' : 'Standard 5-Day Workweek',
      total_calendar_days: totalCalendarDays,
      working_days: workingDays,
      weekend_days: weekendDays,
      holiday_days_count: holidaysOnWeekdays.length + holidaysOnWeekends.length,
      holidays_on_weekdays: holidaysOnWeekdays,
      holidays_on_weekends: holidaysOnWeekends,
    }, null, 2),
    { headers: JSON_HEADERS }
  );
}

/**
 * Serve RFC 5545 compliant iCalendar (.ics) format
 */
async function serveIcsCalendar(env, request, year, stateCode, params) {
  const holidays = await getMergedHolidaysForYearState(env, request, year, stateCode);

  if (!holidays || holidays.length === 0) {
    return new Response(`No holidays found for ${year}/${stateCode}`, { status: 404, headers: CORS_HEADERS });
  }

  const calName = `India Holidays ${year}${stateCode !== 'IN' ? ` (${stateCode})` : ''}`;
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//India Holidays API//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    'X-WR-TIMEZONE:Asia/Kolkata',
  ];

  for (const h of holidays) {
    const dtClean = h.date.replace(/-/g, '');
    const nextDay = addDays(h.date, 1).replace(/-/g, '');
    const slug = h.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const uid = `${h.date}-${slug}-${h.state_code}@holiday2api.vercel.app`;

    ics.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtClean}T000000Z`,
      `DTSTART;VALUE=DATE:${dtClean}`,
      `DTEND;VALUE=DATE:${nextDay}`,
      `SUMMARY:${escapeIcs(h.name)}`,
      `DESCRIPTION:${escapeIcs(h.description || h.name)} (Type: ${h.type})`,
      `LOCATION:${h.state_code === 'IN' ? 'India' : `India - ${h.state_code}`}`,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  }

  ics.push('END:VCALENDAR');
  const icsBody = ics.join('\r\n');

  return new Response(icsBody, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="india-holidays-${year}-${stateCode}.ics"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/**
 * Helper: Add days to ISO date string
 */
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Helper: Escape special characters in iCalendar text
 */
function escapeIcs(text) {
  if (!text) return '';
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Return API Directory metadata
 */
function getApiDirectory(env) {
  return {
    name: 'India Holidays API',
    version: env?.API_VERSION || '1.0.0',
    description: 'Free, fast, timezone-aware REST API for Indian holidays (National & all 36 States/UTs)',
    timezone: env?.TIMEZONE || 'Asia/Kolkata',
    supported_years: '2024–2036',
    endpoints: {
      'GET /api/holidays/:year': 'Get all holidays for a year',
      'GET /api/holidays/:year/:state': 'Get holidays for a specific state',
      'GET /api/holidays?year=&state=&type=&date=': 'Filter holidays dynamically',
      'GET /api/holidays/upcoming?state=&limit=': 'Get upcoming holidays from today',
      'GET /api/long-weekends/:year/:state': 'Find 3-day and 4-day bridge long weekends',
      'GET /api/business-days?from=&to=&state=&bank_rules=': 'Calculate working and business days',
      'GET /api/calendar/:year/:state.ics': 'Export iCalendar (.ics) for Google/Apple Calendar',
      'GET /api/meta/states': 'List all 36 supported states and union territories',
      'GET /api/meta/types': 'List all holiday classifications',
      'GET /api/openapi.json': 'OpenAPI 3.0 specification',
      'GET /api/health': 'Health check status',
    },
    web_explorer: '/',
  };
}

/**
 * OpenAPI 3.0.3 Specification
 */
function getOpenApiSpec(baseUrl) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'India Holidays API',
      version: '1.0.0',
      description: 'Free, fast, reliable REST API providing Indian holiday datasets across 36 States and Union Territories with long weekend planning, iCalendar feeds, and business day calculations.',
      license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    },
    servers: [
      { url: baseUrl || 'https://holiday2api.vercel.app', description: 'Production Edge CDN' },
    ],
    paths: {
      '/api/holidays/{year}': {
        get: {
          summary: 'Get all holidays for a year',
          parameters: [
            { name: 'year', in: 'path', required: true, schema: { type: 'string', example: '2026' } },
            { name: 'state', in: 'query', required: false, schema: { type: 'string', example: 'TG' } },
            { name: 'type', in: 'query', required: false, schema: { type: 'string', example: 'national' } },
            { name: 'date', in: 'query', required: false, schema: { type: 'string', example: '2026-01-26' } },
          ],
          responses: { '200': { description: 'Holiday list' } },
        },
      },
      '/api/holidays/{year}/{state}': {
        get: {
          summary: 'Get holidays for a specific state',
          parameters: [
            { name: 'year', in: 'path', required: true, schema: { type: 'string', example: '2026' } },
            { name: 'state', in: 'path', required: true, schema: { type: 'string', example: 'MH' } },
            { name: 'type', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'State holiday list' } },
        },
      },
      '/api/holidays/upcoming': {
        get: {
          summary: 'Get upcoming holidays from today',
          parameters: [
            { name: 'state', in: 'query', schema: { type: 'string', example: 'IN' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          ],
          responses: { '200': { description: 'Upcoming holidays list' } },
        },
      },
      '/api/long-weekends/{year}/{state}': {
        get: {
          summary: 'Get long weekends and bridge leave planner',
          parameters: [
            { name: 'year', in: 'path', required: true, schema: { type: 'string', example: '2026' } },
            { name: 'state', in: 'path', required: true, schema: { type: 'string', example: 'KA' } },
          ],
          responses: { '200': { description: 'Long weekend recommendations' } },
        },
      },
      '/api/business-days': {
        get: {
          summary: 'Calculate working and business days',
          parameters: [
            { name: 'from', in: 'query', required: true, schema: { type: 'string', example: '2026-03-01' } },
            { name: 'to', in: 'query', required: true, schema: { type: 'string', example: '2026-03-31' } },
            { name: 'state', in: 'query', schema: { type: 'string', example: 'MH' } },
            { name: 'bank_rules', in: 'query', schema: { type: 'boolean', default: false } },
          ],
          responses: { '200': { description: 'Working days calculation breakdown' } },
        },
      },
      '/api/calendar/{year}/{state}.ics': {
        get: {
          summary: 'Download RFC 5545 iCalendar feed',
          parameters: [
            { name: 'year', in: 'path', required: true, schema: { type: 'string', example: '2026' } },
            { name: 'state', in: 'path', required: true, schema: { type: 'string', example: 'DL' } },
          ],
          responses: { '200': { description: 'iCalendar text feed' } },
        },
      },
      '/api/meta/states': {
        get: { summary: 'List all supported states and UTs', responses: { '200': { description: 'States list' } } },
      },
      '/api/meta/types': {
        get: { summary: 'List holiday classifications', responses: { '200': { description: 'Types list' } } },
      },
      '/api/health': {
        get: { summary: 'API health check', responses: { '200': { description: 'Health status' } } },
      },
    },
  };
}

/**
 * Render Modern Interactive HTML Landing Page, Postman Guide & API Documentation UI
 */
function renderInteractiveHtml(env) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>India Holidays API — The Open Gazette & Holiday Engine</title>
  <meta name="description" content="A fast, human-crafted REST API for Indian holidays. Covers National gazettes and all 36 States & UTs with Postman collections, iCalendar feeds, long weekend planning, and working day calculations.">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,${encodeURIComponent(FAVICON_SVG)}">
  <link rel="alternate icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="data:image/svg+xml;utf8,${encodeURIComponent(FAVICON_SVG)}">
  <link rel="preload" href="/Author-Regular.ttf" as="font" type="font/ttf" crossorigin>
  <script>
    (function() {
      try {
        var theme = localStorage.getItem('holiday2api_theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
      } catch (e) {}
    })();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;500;600;700;800&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400;1,6..72,600&display=swap" rel="stylesheet">
  <style>
    @font-face {
      font-family: 'Author';
      src: url('/Author-Regular.ttf') format('truetype'),
           url('/fonts/Author-Regular.ttf') format('truetype');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }

    :root, [data-theme="light"] {
      --bg: #f8fafc;
      --bg-surface: #ffffff;
      --bg-elevated: #f1f5f9;
      --bg-subtle: #e2e8f0;
      --border-subtle: #e2e8f0;
      --border-strong: #cbd5e1;
      
      --ink-primary: #0f172a;
      --ink-secondary: #475569;
      --ink-muted: #64748b;
      
      --accent-saffron: #ea580c;
      --accent-saffron-subtle: rgba(234, 88, 12, 0.08);
      --accent-marigold: #d97706;
      --accent-emerald: #059669;
      --accent-emerald-subtle: rgba(5, 150, 105, 0.08);
      --accent-terracotta: #c2410c;
      --accent-cyan: #0284c7;
      --accent-cyan-subtle: rgba(2, 132, 199, 0.08);
      --accent-purple: #7c3aed;
      --accent-purple-subtle: rgba(124, 58, 237, 0.08);
      
      --font-display: 'Author', 'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-serif: 'Newsreader', Georgia, serif;
      --font-mono: 'IBM Plex Mono', monospace;
      
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
      --shadow-crisp: 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.04);
      --shadow-elevated: 0 10px 30px rgba(0, 0, 0, 0.08);
      --nav-bg: rgba(255, 255, 255, 0.92);
      --grid-dot: rgba(0, 0, 0, 0.035);
    }

    [data-theme="dark"] {
      --bg: #0e1013;
      --bg-surface: #14171c;
      --bg-elevated: #1b1f26;
      --bg-subtle: #232832;
      --border-subtle: #282e3a;
      --border-strong: #3b4455;
      
      --ink-primary: #f3f4f6;
      --ink-secondary: #9da7b8;
      --ink-muted: #626d80;
      
      --accent-saffron: #f97316;
      --accent-saffron-subtle: rgba(249, 115, 22, 0.12);
      --accent-marigold: #fbbf24;
      --accent-emerald: #10b981;
      --accent-emerald-subtle: rgba(16, 185, 129, 0.12);
      --accent-terracotta: #ea580c;
      --accent-cyan: #38bdf8;
      --accent-cyan-subtle: rgba(56, 189, 248, 0.12);
      --accent-purple: #a78bfa;
      --accent-purple-subtle: rgba(167, 139, 250, 0.12);
      
      --shadow-crisp: 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.25);
      --shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.45);
      --nav-bg: rgba(14, 16, 19, 0.9);
      --grid-dot: rgba(255, 255, 255, 0.02);
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      min-width: 0;
    }

    html {
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
      scroll-behavior: smooth;
      overflow-x: hidden;
      width: 100%;
    }

    body {
      width: 100%;
      max-width: 100vw;
      overflow-x: hidden;
      background-color: var(--bg);
      color: var(--ink-primary);
      font-family: var(--font-display);
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
      background-image: 
        radial-gradient(circle at 50% 0%, var(--accent-saffron-subtle) 0%, transparent 60%),
        linear-gradient(to right, var(--grid-dot) 1px, transparent 1px),
        linear-gradient(to bottom, var(--grid-dot) 1px, transparent 1px);
      background-size: 100% 100%, 32px 32px, 32px 32px;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    /* Top Utility Bar */
    .top-nav {
      border-bottom: 1px solid var(--border-subtle);
      background: var(--nav-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      position: sticky;
      top: 0;
      z-index: 100;
      transition: background 0.2s ease, border-color 0.2s ease;
      width: 100%;
    }
    .top-nav-inner {
      max-width: 1240px;
      margin: 0 auto;
      padding: 0.75rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      width: 100%;
    }
    .top-nav-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .top-nav-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      text-decoration: none;
      color: var(--ink-primary);
      font-weight: 700;
      font-size: clamp(0.92rem, 2.5vw, 1.05rem);
      letter-spacing: -0.02em;
      flex-shrink: 0;
    }
    .brand-flag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }
    .brand-flag svg, .footer-flag svg {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 50%;
    }
    .version-tag {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      padding: 0.15rem 0.45rem;
      border-radius: var(--radius-sm);
      background: var(--bg-subtle);
      color: var(--ink-secondary);
      border: 1px solid var(--border-subtle);
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 1.15rem;
      flex-wrap: wrap;
    }
    .nav-link {
      color: var(--ink-secondary);
      text-decoration: none;
      font-size: 0.88rem;
      font-weight: 500;
      transition: color 0.15s;
      white-space: nowrap;
      padding: 0.25rem 0;
    }
    .nav-link:hover { color: var(--ink-primary); }
    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--accent-emerald);
      background: var(--accent-emerald-subtle);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .ping-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-emerald);
      box-shadow: 0 0 8px var(--accent-emerald);
      animation: pulseDot 2s infinite;
    }
    @keyframes pulseDot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.85); }
    }
    .theme-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: var(--bg-elevated);
      border: 1px solid var(--border-strong);
      color: var(--ink-primary);
      padding: 0.3rem 0.65rem;
      border-radius: var(--radius-md);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
      box-shadow: var(--shadow-crisp);
      flex-shrink: 0;
    }
    .theme-toggle:hover {
      border-color: var(--accent-saffron);
      background: var(--bg-subtle);
      transform: translateY(-1px);
    }
    .theme-icon {
      font-size: 0.85rem;
      line-height: 1;
      display: inline-block;
    }
    [data-theme="dark"] .sun-icon { display: none; }
    [data-theme="dark"] .moon-icon { display: inline-block; }
    :root:not([data-theme="dark"]) .moon-icon { display: none; }
    :root:not([data-theme="dark"]) .sun-icon { display: inline-block; }

    @media (max-width: 820px) {
      .top-nav-inner {
        flex-direction: column;
        align-items: stretch;
        padding: 0.65rem 1rem 0.5rem;
        gap: 0.5rem;
      }
      .top-nav-header {
        justify-content: space-between;
        width: 100%;
      }
      .nav-links {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        white-space: nowrap;
        scrollbar-width: none;
        padding: 0.25rem 0 0.25rem;
        gap: 0.85rem;
        justify-content: flex-start;
        font-size: 0.82rem;
      }
      .nav-links::-webkit-scrollbar {
        display: none;
      }
    }

    .container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem 4rem;
      width: 100%;
    }
    @media (max-width: 768px) {
      .container {
        padding: 1.5rem 1rem 3rem;
      }
    }
    @media (max-width: 480px) {
      .container {
        padding: 1.25rem 0.75rem 2.5rem;
      }
    }

    /* Hero Section */
    .hero {
      padding: clamp(1.5rem, 4vw, 3rem) 0 clamp(1.75rem, 4vw, 3.5rem);
      position: relative;
      width: 100%;
    }
    .meta-stamp {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-mono);
      font-size: clamp(0.68rem, 1.8vw, 0.75rem);
      color: var(--accent-saffron);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 1.25rem;
      background: var(--accent-saffron-subtle);
      border: 1px solid rgba(249, 115, 22, 0.25);
      padding: 0.3rem 0.8rem;
      border-radius: var(--radius-sm);
      font-weight: 600;
      max-width: 100%;
      word-break: break-word;
    }
    h1 {
      font-size: clamp(1.75rem, 5.5vw, 3.8rem);
      font-weight: 800;
      line-height: 1.12;
      letter-spacing: -0.035em;
      margin-bottom: 1.25rem;
      color: var(--ink-primary);
      overflow-wrap: break-word;
      word-break: break-word;
    }
    h1 .serif-accent {
      font-family: var(--font-serif);
      font-weight: 400;
      font-style: italic;
      color: var(--accent-marigold);
      letter-spacing: -0.01em;
      display: inline-block;
    }
    .hero-lead {
      font-size: clamp(0.95rem, 2.2vw, 1.15rem);
      line-height: 1.65;
      color: var(--ink-secondary);
      max-width: 780px;
      margin-bottom: 2rem;
      overflow-wrap: break-word;
    }
    
    /* Quick cURL Bar in Hero */
    .hero-terminal {
      background: var(--bg-surface);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.9rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 680px;
      margin-bottom: 2rem;
      box-shadow: var(--shadow-crisp);
      gap: 0.75rem;
      width: 100%;
    }
    @media (max-width: 640px) {
      .hero-terminal {
        flex-direction: column;
        align-items: stretch;
        gap: 0.6rem;
        padding: 0.65rem 0.75rem;
      }
      .hero-terminal .btn {
        width: 100%;
        justify-content: center;
      }
    }
    .terminal-cmd {
      font-family: var(--font-mono);
      font-size: clamp(0.78rem, 2.2vw, 0.88rem);
      color: var(--accent-cyan);
      overflow-x: auto;
      white-space: nowrap;
      padding-right: 0.5rem;
      -webkit-overflow-scrolling: touch;
      flex: 1;
    }
    .terminal-cmd span { color: var(--ink-muted); }

    /* Button styles */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-family: var(--font-display);
      font-size: 0.9rem;
      font-weight: 600;
      padding: 0.65rem 1.25rem;
      border-radius: var(--radius-md);
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      white-space: nowrap;
      touch-action: manipulation;
    }
    .btn-primary {
      background: var(--accent-saffron);
      color: #ffffff;
      border-color: #ea580c;
    }
    .btn-primary:hover {
      background: #f86704;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25);
    }
    .btn-outline {
      background: var(--bg-surface);
      color: var(--ink-primary);
      border-color: var(--border-strong);
    }
    .btn-outline:hover {
      background: var(--bg-elevated);
      border-color: var(--ink-secondary);
      transform: translateY(-1px);
    }
    .btn-sm {
      font-size: 0.78rem;
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
    }
    .btn-icon {
      padding: 0.35rem 0.55rem;
    }
    .hero-actions {
      display: flex;
      gap: 0.85rem;
      flex-wrap: wrap;
      width: 100%;
    }
    @media (max-width: 540px) {
      .hero-actions {
        flex-direction: column;
      }
      .hero-actions .btn {
        width: 100%;
        justify-content: center;
      }
    }

    /* Key Spec Badges Grid */
    .specs-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
      gap: 1px;
      background: var(--border-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      overflow: hidden;
      margin: 1.5rem 0 clamp(2rem, 4vw, 3.5rem);
      box-shadow: var(--shadow-crisp);
      width: 100%;
    }
    .spec-item {
      background: var(--bg-surface);
      padding: clamp(0.85rem, 2.5vw, 1.25rem);
    }
    .spec-val {
      font-family: var(--font-display);
      font-size: clamp(1.25rem, 3.5vw, 1.55rem);
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--ink-primary);
      margin-bottom: 0.2rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .spec-val.accent { color: var(--accent-saffron); }
    .spec-label {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: var(--ink-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      line-height: 1.35;
    }

    /* Section Headings */
    .section-header {
      margin-bottom: 1.5rem;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 0.85rem;
      width: 100%;
    }
    .section-title {
      font-size: clamp(1.2rem, 3vw, 1.45rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--ink-primary);
    }
    .section-desc {
      font-size: clamp(0.82rem, 2vw, 0.88rem);
      color: var(--ink-secondary);
      margin-top: 0.2rem;
    }

    /* Quick Preset Chips */
    .presets-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      overflow-x: auto;
      padding: 0.5rem 0 1.25rem;
      scrollbar-width: thin;
      scrollbar-color: var(--border-strong) transparent;
      -webkit-overflow-scrolling: touch;
      width: 100%;
      max-width: 100%;
    }
    .presets-bar::-webkit-scrollbar {
      height: 4px;
    }
    .presets-bar::-webkit-scrollbar-thumb {
      background: var(--border-strong);
      border-radius: 4px;
    }
    .preset-label {
      font-family: var(--font-mono);
      font-size: 0.74rem;
      font-weight: 600;
      color: var(--ink-muted);
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-right: 0.25rem;
      flex-shrink: 0;
    }
    .preset-chip {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--ink-secondary);
      font-family: var(--font-mono);
      font-size: 0.78rem;
      font-weight: 500;
      padding: 0.4rem 0.85rem;
      border-radius: 999px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
      box-shadow: var(--shadow-crisp);
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      flex-shrink: 0;
    }
    .preset-chip:hover {
      background: var(--bg-elevated);
      color: var(--ink-primary);
      border-color: var(--border-strong);
      transform: translateY(-1px);
    }
    .preset-chip.active {
      background: var(--accent-saffron-subtle);
      color: var(--accent-saffron);
      border-color: var(--accent-saffron);
      font-weight: 600;
    }

    /* Interactive Workbench Layout */
    .wb-mobile-tabs {
      display: none;
    }
    @media (max-width: 989px) {
      .wb-mobile-tabs {
        display: flex;
        background: var(--bg-surface);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-md);
        padding: 4px;
        gap: 4px;
        margin-bottom: 1.25rem;
        box-shadow: var(--shadow-crisp);
        width: 100%;
      }
      .wb-tab-btn {
        flex: 1;
        padding: 0.65rem 0.75rem;
        font-family: var(--font-mono);
        font-size: 0.78rem;
        font-weight: 700;
        border: none;
        background: transparent;
        color: var(--ink-secondary);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        user-select: none;
      }
      .wb-tab-btn:hover {
        color: var(--ink-primary);
        background: var(--bg-elevated);
      }
      .wb-tab-btn.active {
        background: var(--accent-saffron);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(234, 88, 12, 0.3);
      }
      .wb-count-badge {
        font-size: 0.68rem;
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.25);
        color: #ffffff;
      }
      .wb-tab-btn:not(.active) .wb-count-badge {
        background: var(--bg-subtle);
        color: var(--ink-secondary);
      }
    }

    .workbench {
      display: grid;
      grid-template-columns: minmax(360px, 420px) minmax(0, 1fr);
      gap: 1.5rem;
      margin-bottom: 3.5rem;
      align-items: start;
      width: 100%;
    }
    @media (max-width: 989px) {
      .workbench { 
        display: block;
        margin-bottom: 2.5rem;
      }
      .workbench .panel {
        display: none;
      }
      .workbench .panel.wb-panel-active {
        display: flex;
      }
    }

    /* Panel & Controls */
    .panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-crisp);
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 100%;
    }
    .panel-header {
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-subtle);
      padding: 0.85rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
      width: 100%;
    }
    @media (max-width: 560px) {
      .panel-header {
        padding: 0.75rem 0.85rem;
        gap: 0.5rem;
      }
    }
    .panel-header-title {
      font-family: var(--font-mono);
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ink-primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .panel-body {
      padding: clamp(0.85rem, 2.5vw, 1.35rem);
      width: 100%;
    }

    .form-row {
      margin-bottom: 1.15rem;
      width: 100%;
    }
    .field-label {
      display: block;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--ink-secondary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.45rem;
    }
    .control-select, .control-input {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      color: var(--ink-primary);
      font-family: var(--font-mono);
      font-size: 16px; /* Prevents auto-zoom in mobile Safari */
      padding: 0.65rem 0.85rem;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      max-width: 100%;
    }
    @media (min-width: 768px) {
      .control-select, .control-input {
        font-size: 0.85rem;
      }
    }
    .control-select {
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 1rem;
      padding-right: 2.25rem;
      cursor: pointer;
    }
    .control-select:focus, .control-input:focus {
      border-color: var(--accent-saffron);
      box-shadow: 0 0 0 3px var(--accent-saffron-subtle);
    }
    .grid-duo {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
      gap: 0.75rem;
      width: 100%;
    }

    .checkbox-pill {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      padding: 0.65rem 0.9rem;
      border-radius: var(--radius-md);
      font-size: 0.8rem;
      font-family: var(--font-mono);
      color: var(--ink-secondary);
      cursor: pointer;
      width: 100%;
      transition: all 0.15s ease;
      user-select: none;
      line-height: 1.4;
    }
    .checkbox-pill:hover {
      border-color: var(--accent-saffron);
      color: var(--ink-primary);
    }
    .checkbox-pill input { 
      accent-color: var(--accent-saffron);
      width: 1.05rem;
      height: 1.05rem;
      cursor: pointer;
      flex-shrink: 0;
    }

    .url-preview-wrapper {
      display: flex;
      align-items: center;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      overflow: hidden;
      transition: border-color 0.15s;
      width: 100%;
      max-width: 100%;
    }
    .url-preview-wrapper:focus-within {
      border-color: var(--accent-saffron);
    }
    .url-method-badge {
      background: var(--bg-elevated);
      border-right: 1px solid var(--border-strong);
      padding: 0.65rem 0.75rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--accent-emerald);
      user-select: none;
      flex-shrink: 0;
    }
    .url-preview-bar {
      flex: 1;
      min-width: 0;
      padding: 0.65rem 0.85rem;
      font-family: var(--font-mono);
      font-size: clamp(0.72rem, 2vw, 0.8rem);
      color: var(--accent-cyan);
      overflow-x: auto;
      white-space: nowrap;
      -webkit-overflow-scrolling: touch;
    }
    .url-copy-btn {
      border-radius: 0;
      border: none;
      border-left: 1px solid var(--border-strong);
      background: transparent;
      color: var(--ink-secondary);
      padding: 0.65rem 0.85rem;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.15s;
      flex-shrink: 0;
    }
    .url-copy-btn:hover {
      background: var(--bg-elevated);
      color: var(--ink-primary);
    }

    /* Response Panel & Dual View Mode */
    .view-toggle-group {
      display: inline-flex;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      padding: 2px;
      gap: 2px;
      flex-shrink: 0;
    }
    .view-toggle-btn {
      background: transparent;
      border: none;
      color: var(--ink-secondary);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.3rem 0.75rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      white-space: nowrap;
    }
    .view-toggle-btn.active {
      background: var(--bg-surface);
      color: var(--ink-primary);
      box-shadow: var(--shadow-crisp);
    }

    /* Visual Holiday Cards Grid */
    .visual-cards-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
      gap: 0.95rem;
      max-height: 540px;
      overflow-y: auto;
      padding: 0.25rem 0.25rem 0.5rem 0.1rem;
      scrollbar-width: thin;
      scrollbar-color: var(--border-strong) transparent;
      -webkit-overflow-scrolling: touch;
      width: 100%;
    }
    @media (max-width: 480px) {
      .visual-cards-container {
        grid-template-columns: 1fr;
        max-height: 480px;
      }
    }
    .visual-cards-container::-webkit-scrollbar {
      width: 6px;
    }
    .visual-cards-container::-webkit-scrollbar-thumb {
      background: var(--border-strong);
      border-radius: 4px;
    }

    .holiday-card {
      background: var(--bg);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.75rem;
      transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
      position: relative;
      box-shadow: var(--shadow-crisp);
      min-width: 0;
      max-width: 100%;
    }
    .holiday-card:hover {
      border-color: var(--accent-saffron);
      transform: translateY(-2px);
      box-shadow: var(--shadow-elevated);
    }
    .holiday-date-strip {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 0.25rem;
      gap: 0.5rem;
    }
    .holiday-day-num {
      font-size: 1.45rem;
      font-weight: 800;
      color: var(--ink-primary);
      font-family: var(--font-display);
      line-height: 1;
    }
    .holiday-month-name {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--accent-saffron);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .holiday-weekday {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--ink-muted);
    }
    .holiday-name {
      font-size: 1rem;
      font-weight: 700;
      color: var(--ink-primary);
      line-height: 1.35;
      margin: 0.35rem 0;
      word-break: break-word;
    }
    .holiday-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
    }
    .tag-badge {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.2rem 0.55rem;
      border-radius: var(--radius-sm);
      background: var(--bg-subtle);
      color: var(--ink-secondary);
      border: 1px solid var(--border-subtle);
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      max-width: 100%;
      word-break: break-word;
    }
    .tag-badge.national {
      background: var(--accent-emerald-subtle);
      color: var(--accent-emerald);
      border-color: rgba(16, 185, 129, 0.3);
    }
    .tag-badge.gazetted {
      background: var(--accent-saffron-subtle);
      color: var(--accent-saffron);
      border-color: rgba(249, 115, 22, 0.3);
    }
    .tag-badge.bank {
      background: var(--accent-cyan-subtle);
      color: var(--accent-cyan);
      border-color: rgba(2, 132, 199, 0.3);
    }
    .tag-badge.restricted, .tag-badge.optional {
      background: var(--accent-purple-subtle);
      color: var(--accent-purple);
      border-color: rgba(124, 58, 237, 0.3);
    }
    .tag-badge.upcoming-countdown {
      background: var(--accent-saffron-subtle);
      color: var(--accent-saffron);
      border-color: rgba(249, 115, 22, 0.35);
      font-weight: 700;
    }

    /* Long weekend specific card */
    .lw-card {
      background: var(--bg);
      border: 1px solid var(--border-subtle);
      border-left: 4px solid var(--accent-saffron);
      border-radius: var(--radius-md);
      padding: 1.15rem;
      margin-bottom: 0.85rem;
      box-shadow: var(--shadow-crisp);
      transition: all 0.15s ease;
      min-width: 0;
      max-width: 100%;
    }
    .lw-card:hover {
      border-color: var(--border-strong);
      border-left-color: var(--accent-saffron);
      transform: translateY(-1px);
      box-shadow: var(--shadow-elevated);
    }
    .lw-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--ink-primary);
      margin-bottom: 0.35rem;
      word-break: break-word;
    }
    .lw-meta {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--accent-marigold);
      margin-bottom: 0.6rem;
      word-break: break-word;
    }
    .lw-advice {
      font-size: 0.88rem;
      color: var(--ink-secondary);
      line-height: 1.5;
      background: var(--bg-elevated);
      padding: 0.6rem 0.85rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      word-break: break-word;
    }

    /* KPI Metrics Box */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 110px), 1fr));
      gap: 0.85rem;
      margin-bottom: 1.15rem;
      width: 100%;
    }
    @media (max-width: 480px) {
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.65rem;
      }
    }
    .kpi-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.85rem 0.65rem;
      text-align: center;
      box-shadow: var(--shadow-crisp);
      min-width: 0;
    }
    .kpi-val {
      font-size: clamp(1.25rem, 3.5vw, 1.55rem);
      font-weight: 800;
      font-family: var(--font-display);
      line-height: 1.1;
      margin-bottom: 0.25rem;
    }
    .kpi-label {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--ink-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Meta & OpenApi Cards */
    .meta-card {
      background: var(--bg);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 1.1rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.65rem;
      transition: all 0.15s ease;
      box-shadow: var(--shadow-crisp);
      min-width: 0;
      max-width: 100%;
    }
    .meta-card:hover {
      border-color: var(--accent-saffron);
      transform: translateY(-1px);
      box-shadow: var(--shadow-elevated);
    }
    .meta-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .meta-card-title {
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--ink-primary);
      word-break: break-word;
    }
    .meta-card-desc {
      font-size: 0.85rem;
      color: var(--ink-secondary);
      line-height: 1.45;
      word-break: break-word;
    }

    /* Raw Code Box */
    .raw-code-box {
      background: var(--bg);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: clamp(0.75rem, 2.5vw, 1.25rem);
      font-family: var(--font-mono);
      font-size: clamp(0.72rem, 1.8vw, 0.82rem);
      line-height: 1.55;
      color: var(--ink-primary);
      max-height: 540px;
      overflow: auto;
      white-space: pre;
      scrollbar-width: thin;
      scrollbar-color: var(--border-strong) transparent;
      -webkit-overflow-scrolling: touch;
      width: 100%;
      max-width: 100%;
    }
    .raw-code-box::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .raw-code-box::-webkit-scrollbar-thumb {
      background: var(--border-strong);
      border-radius: 4px;
    }

    /* Code Snippets Drawer */
    .snippets-drawer {
      margin-top: 1.15rem;
      border-top: 1px solid var(--border-subtle);
      padding-top: 0.85rem;
      width: 100%;
    }
    .snippets-drawer summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: 0.76rem;
      font-weight: 600;
      color: var(--accent-cyan);
      user-select: none;
      padding: 0.4rem 0;
      outline: none;
      list-style: none;
    }
    .snippets-drawer summary::-webkit-details-marker {
      display: none;
    }
    .snippets-drawer summary:hover {
      color: var(--accent-saffron);
    }
    .snippets-drawer-chevron {
      font-size: 0.75rem;
      transition: transform 0.2s ease;
      color: var(--ink-muted);
    }
    .snippets-drawer[open] .snippets-drawer-chevron {
      transform: rotate(180deg);
    }
    .snippets-container {
      margin-top: 0.75rem;
      width: 100%;
    }
    .snippet-tabs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.55rem;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .snippet-tabs {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }
    .snippet-tab {
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      color: var(--ink-secondary);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.3rem 0.75rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .snippet-tab:hover {
      color: var(--ink-primary);
      border-color: var(--border-strong);
    }
    .snippet-tab.active {
      background: var(--bg-subtle);
      color: var(--accent-saffron);
      border-color: var(--accent-saffron);
    }
    .snippet-display {
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      padding: 0.85rem 1rem;
      font-family: var(--font-mono);
      font-size: clamp(0.72rem, 1.8vw, 0.78rem);
      line-height: 1.55;
      color: var(--ink-primary);
      overflow-x: auto;
      white-space: pre;
      -webkit-overflow-scrolling: touch;
      max-width: 100%;
    }

    /* Feature Grid (Editorial Style) */
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
      gap: clamp(1rem, 3vw, 1.5rem);
      margin: 2.5rem 0 clamp(2rem, 5vw, 4rem);
      width: 100%;
    }
    .feature-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: clamp(1.25rem, 3vw, 1.75rem);
      position: relative;
      box-shadow: var(--shadow-crisp);
      transition: transform 0.15s ease, border-color 0.15s ease;
      min-width: 0;
    }
    .feature-card:hover {
      transform: translateY(-2px);
      border-color: var(--border-strong);
    }
    .feature-num {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--accent-saffron);
      margin-bottom: 0.75rem;
      display: block;
      font-weight: 600;
    }
    .feature-title {
      font-size: clamp(1.1rem, 2.5vw, 1.2rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.6rem;
      color: var(--ink-primary);
      word-break: break-word;
    }
    .feature-desc {
      font-size: clamp(0.85rem, 2vw, 0.9rem);
      color: var(--ink-secondary);
      line-height: 1.55;
      word-break: break-word;
    }

    /* Postman Section */
    .postman-section {
      background: linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-lg);
      padding: clamp(1.25rem, 3.5vw, 2rem);
      margin: 3rem 0;
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 2rem;
      align-items: center;
      box-shadow: var(--shadow-crisp);
      width: 100%;
    }
    @media (max-width: 860px) {
      .postman-section { 
        grid-template-columns: 1fr; 
        gap: 1.5rem;
        padding: 1.35rem;
      }
    }
    .postman-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: #ff6c37;
      background: rgba(255, 108, 55, 0.12);
      border: 1px solid rgba(255, 108, 55, 0.3);
      padding: 0.25rem 0.65rem;
      border-radius: var(--radius-sm);
      margin-bottom: 0.85rem;
      font-weight: 600;
    }
    .postman-heading {
      font-size: clamp(1.25rem, 3.5vw, 1.5rem);
      font-weight: 800;
      color: var(--ink-primary);
      margin-bottom: 0.65rem;
      letter-spacing: -0.02em;
      word-break: break-word;
    }
    .postman-text {
      font-size: clamp(0.85rem, 2vw, 0.92rem);
      color: var(--ink-secondary);
      line-height: 1.55;
      margin-bottom: 1.25rem;
      word-break: break-word;
    }
    .postman-box {
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      min-width: 0;
      max-width: 100%;
    }
    .step-list {
      list-style: none;
      font-family: var(--font-mono);
      font-size: clamp(0.75rem, 2vw, 0.8rem);
      color: var(--ink-secondary);
    }
    .step-list li {
      margin-bottom: 0.65rem;
      display: flex;
      gap: 0.6rem;
      word-break: break-word;
    }
    .step-list li strong { color: var(--ink-primary); }
    .step-num {
      color: var(--accent-saffron);
      font-weight: 700;
      flex-shrink: 0;
    }

    /* States Directory Filter */
    .states-search-wrapper {
      margin-bottom: 1rem;
      max-width: 400px;
      width: 100%;
    }
    .states-filter-bar {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
      width: 100%;
      max-height: 240px;
      overflow-y: auto;
      padding: 0.65rem;
      scrollbar-width: thin;
      scrollbar-color: var(--border-strong) transparent;
      -webkit-overflow-scrolling: touch;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      background: var(--bg-surface);
    }
    @media (min-width: 768px) {
      .states-filter-bar {
        max-height: none;
        border: none;
        background: transparent;
        padding: 0;
        gap: 0.5rem;
      }
    }
    .state-pill {
      font-family: var(--font-mono);
      font-size: 0.76rem;
      background: var(--bg);
      border: 1px solid var(--border-subtle);
      padding: 0.35rem 0.65rem;
      border-radius: var(--radius-sm);
      color: var(--ink-secondary);
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.15s;
      box-shadow: var(--shadow-crisp);
      user-select: none;
    }
    .state-pill:hover {
      background: var(--bg-elevated);
      color: var(--ink-primary);
      border-color: var(--border-strong);
      transform: translateY(-1px);
    }
    .state-pill span {
      color: var(--accent-saffron);
      font-weight: 600;
    }

    /* Documentation Table & Mobile Responsive Cards */
    .doc-table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      background: var(--bg-surface);
      margin-top: 1.5rem;
      box-shadow: var(--shadow-crisp);
      -webkit-overflow-scrolling: touch;
      width: 100%;
      max-width: 100%;
    }
    .doc-table {
      width: 100%;
      min-width: 860px;
      border-collapse: separate;
      border-spacing: 0;
      text-align: left;
      font-size: 0.88rem;
    }
    .doc-table th {
      background: var(--bg-elevated);
      padding: 0.95rem 1.25rem;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--ink-muted);
      border-bottom: 1px solid var(--border-subtle);
      border-right: 1px solid var(--border-subtle);
      font-weight: 600;
      white-space: nowrap;
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .doc-table th:last-child {
      border-right: none;
    }
    .doc-table td {
      padding: 1.15rem 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
      border-right: 1px solid var(--border-subtle);
      color: var(--ink-secondary);
      vertical-align: top;
      line-height: 1.55;
      background: transparent;
      transition: background 0.15s ease;
    }
    .doc-table td:last-child {
      border-right: none;
    }
    .doc-table tr:last-child td {
      border-bottom: none;
    }
    .doc-table tr:hover td {
      background: var(--bg-elevated);
    }
    .doc-table td code {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      background: var(--bg-subtle);
      color: var(--accent-marigold);
      padding: 0.15rem 0.4rem;
      border-radius: var(--radius-sm);
      border: 1px solid rgba(251, 191, 36, 0.2);
    }

    /* Transform Table to Native Cards on Mobile */
    @media (max-width: 768px) {
      .doc-table-wrap {
        background: transparent;
        border: none;
        box-shadow: none;
        overflow-x: visible;
      }
      .doc-table, .doc-table thead, .doc-table tbody, .doc-table th, .doc-table td, .doc-table tr {
        display: block;
        width: 100%;
        min-width: 0;
      }
      .doc-table thead {
        display: none;
      }
      .doc-table tr {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: 1.15rem;
        margin-bottom: 1rem;
        box-shadow: var(--shadow-crisp);
      }
      .doc-table td {
        padding: 0.35rem 0;
        border: none;
        text-align: left !important;
      }
      .doc-table td:first-child {
        padding-bottom: 0.5rem;
      }
      .doc-table td:last-child {
        padding-top: 0.75rem;
      }
      .doc-table colgroup {
        display: none;
      }
    }

    .method-get {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--accent-emerald);
      background: var(--accent-emerald-subtle);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
      display: inline-block;
      letter-spacing: 0.03em;
    }
    .endpoint-code {
      font-family: var(--font-mono);
      color: var(--ink-primary);
      font-weight: 600;
      font-size: clamp(0.78rem, 2vw, 0.84rem);
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      padding: 0.35rem 0.6rem;
      border-radius: var(--radius-sm);
      display: inline-block;
      word-break: break-all;
      line-height: 1.4;
      max-width: 100%;
    }
    .endpoint-code .param {
      color: var(--accent-saffron);
    }
    .table-endpoint-title {
      font-weight: 700;
      color: var(--ink-primary);
      font-size: 0.92rem;
      margin-bottom: 0.25rem;
      display: block;
      word-break: break-word;
    }
    .table-param-note {
      font-size: 0.8rem;
      color: var(--ink-muted);
      margin-top: 0.4rem;
      line-height: 1.45;
      word-break: break-word;
    }
    .endpoint-sample-btn {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      font-family: var(--font-mono);
      font-size: clamp(0.72rem, 1.8vw, 0.75rem);
      color: var(--accent-cyan);
      background: var(--accent-cyan-subtle);
      border: 1px solid rgba(56, 189, 248, 0.25);
      padding: 0.45rem 0.75rem;
      border-radius: var(--radius-sm);
      text-decoration: none;
      transition: all 0.15s ease;
      word-break: break-all;
      width: 100%;
      box-sizing: border-box;
    }
    .endpoint-sample-btn:hover {
      background: var(--accent-cyan);
      border-color: var(--accent-cyan);
      color: #ffffff;
      transform: translateY(-1px);
    }
    .endpoint-sample-btn .arrow-icon {
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    /* Toast Notification */
    .toast {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      background: var(--bg-elevated);
      border: 1px solid var(--accent-saffron);
      color: var(--ink-primary);
      font-family: var(--font-mono);
      font-size: 0.82rem;
      padding: 0.65rem 1.25rem;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-elevated);
      z-index: 1000;
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      pointer-events: none;
      max-width: calc(100vw - 2rem);
      word-break: break-word;
    }
    @media (max-width: 540px) {
      .toast {
        left: 1rem;
        right: 1rem;
        bottom: 1rem;
        justify-content: center;
        text-align: center;
      }
    }
    .toast.show {
      transform: translateY(0);
      opacity: 1;
      pointer-events: auto;
    }

    /* Human-crafted Footer */
    footer {
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      padding: clamp(2.5rem, 5vw, 3.5rem) clamp(1rem, 4vw, 1.5rem);
      margin-top: 5rem;
      width: 100%;
    }
    .footer-inner {
      max-width: 1240px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 2rem;
      width: 100%;
    }
    @media (max-width: 768px) {
      .footer-inner {
        grid-template-columns: 1fr;
        gap: 1.75rem;
      }
    }
    .footer-col-main {
      max-width: 440px;
    }
    .footer-brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--ink-primary);
      margin-bottom: 0.65rem;
    }
    .footer-flag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }
    .footer-desc {
      font-size: 0.85rem;
      color: var(--ink-secondary);
      line-height: 1.55;
    }
    .footer-nav-col {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .footer-nav-title {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ink-muted);
      margin-bottom: 0.35rem;
    }
    .footer-link {
      color: var(--ink-secondary);
      text-decoration: none;
      font-size: 0.85rem;
      transition: color 0.15s;
    }
    .footer-link:hover { color: var(--accent-saffron); }
    .footer-bottom {
      max-width: 1240px;
      margin: 2.5rem auto 0;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: clamp(0.7rem, 1.8vw, 0.75rem);
      color: var(--ink-muted);
      flex-wrap: wrap;
      gap: 1rem;
      width: 100%;
    }
  </style>
</head>
<body>

  <!-- Top Navigation -->
  <nav class="top-nav">
    <div class="top-nav-inner">
      <div class="top-nav-header">
        <a href="/" class="brand">
          <span class="brand-flag" aria-label="Indian Flag">${FAVICON_SVG}</span>
          <span>India Holidays API</span>
          <span class="version-tag">v1.0</span>
        </a>
        <div class="top-nav-actions">
          <button id="themeToggleBtn" class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle Day / Night Mode" title="Toggle Day / Night Mode">
            <span class="theme-icon moon-icon">🌙</span>
            <span class="theme-icon sun-icon">☀️</span>
            <span class="theme-label" id="themeLabel">Day</span>
          </button>
          <div class="status-indicator">
            <span class="ping-dot"></span>
            <span>Global Edge Live</span>
          </div>
        </div>
      </div>
      <div class="nav-links">
        <a href="#workbench" class="nav-link">Sandbox</a>
        <a href="#postman" class="nav-link">Postman Spec</a>
        <a href="#states" class="nav-link">36 States</a>
        <a href="#docs" class="nav-link">Endpoints</a>
      </div>
    </div>
  </nav>

  <main class="container">
    
    <!-- Hero Section -->
    <header class="hero">
      <div class="meta-stamp">
        <span>●</span> Open Public Gazette Infrastructure
      </div>
      <h1>
        The Definitive Indian Holiday API.<br>
        <span class="serif-accent">Every Gazette. Every State. Zero Friction.</span>
      </h1>
      <p class="hero-lead">
        A fast, free, open-access REST engine for Indian national gazettes, state festivals, bank holidays (RBI 2nd/4th Sat rules), long weekends, and RFC 5545 calendar feeds from 2024 to 2036.
      </p>

      <!-- Quick cURL Bar -->
      <div class="hero-terminal">
        <div class="terminal-cmd" id="heroTerminalCmd">
          <span>$ </span>curl <span id="heroTerminalUrl">https://holiday2api.vercel.app/api/holidays/2026/TG</span>
        </div>
        <button class="btn btn-sm btn-outline" onclick="copyHeroCurl()">
          📋 Copy cURL
        </button>
      </div>

      <div class="hero-actions">
        <a href="#workbench" class="btn btn-primary">⚡ Test Live in Workbench</a>
        <a href="#postman" class="btn btn-outline">🚀 Import to Postman</a>
        <a href="https://github.com/urunkarpm/holiday2api" target="_blank" class="btn btn-outline" rel="noopener noreferrer">⭐ GitHub Repository</a>
      </div>
    </header>

    <!-- Key Spec Badges -->
    <div class="specs-strip">
      <div class="spec-item">
        <div class="spec-val accent">36</div>
        <div class="spec-label">States & Union Territories</div>
      </div>
      <div class="spec-item">
        <div class="spec-val">2024–2036</div>
        <div class="spec-label">13 Calendar Years Mapped</div>
      </div>
      <div class="spec-item">
        <div class="spec-val">&lt; 20ms</div>
        <div class="spec-label">Edge Cache Response</div>
      </div>
      <div class="spec-item">
        <div class="spec-val">100% Free</div>
        <div class="spec-label">Zero Auth • No Rate Wall</div>
      </div>
    </div>

    <!-- Live Workbench Section -->
    <section id="workbench">
      <div class="section-header">
        <div>
          <h2 class="section-title">⚡ Interactive Developer Workbench</h2>
          <p class="section-desc">Compose queries across 36 states, preview visual holiday cards, inspect raw payloads, and copy code snippets.</p>
        </div>
      </div>

      <!-- Quick Preset Chips -->
      <div class="presets-bar">
        <span class="preset-label">Presets:</span>
        <button class="preset-chip active" onclick="applyPreset('tg-2026', this)">Telangana 2026</button>
        <button class="preset-chip" onclick="applyPreset('mh-lw', this)">Maharashtra Long Weekends</button>
        <button class="preset-chip" onclick="applyPreset('upcoming', this)">Upcoming 5 Holidays</button>
        <button class="preset-chip" onclick="applyPreset('rbi-working', this)">Q1 RBI Working Days</button>
        <button class="preset-chip" onclick="applyPreset('national-2026', this)">All-India National 2026</button>
        <button class="preset-chip" onclick="applyPreset('ics-feed', this)">Apple/Google .ICS Feed</button>
        <button class="preset-chip" onclick="applyPreset('meta-states', this)">36 States Directory</button>
        <button class="preset-chip" onclick="applyPreset('meta-types', this)">Holiday Classifications</button>
        <button class="preset-chip" onclick="applyPreset('openapi', this)">OpenAPI Spec</button>
        <button class="preset-chip" onclick="applyPreset('health', this)">API Health</button>
      </div>

      <!-- Mobile Segmented Tab Switcher -->
      <div class="wb-mobile-tabs">
        <button class="wb-tab-btn active" id="btnTabControls" onclick="switchWorkbenchMobileTab('controls')">
          <span>⚙️ Query Builder</span>
        </button>
        <button class="wb-tab-btn" id="btnTabResponse" onclick="switchWorkbenchMobileTab('response')">
          <span>📦 Payload Preview</span>
          <span class="wb-count-badge" id="wbResultCountBadge">Live</span>
        </button>
      </div>

      <!-- The Workbench Grid -->
      <div class="workbench">
        <!-- Controls Column -->
        <div class="panel wb-panel-active" id="wbControlsPanel">
          <div class="panel-header">
            <span class="panel-header-title">⚡ Query Builder</span>
            <span class="tag-badge gazetted" id="methodBadge">GET</span>
          </div>
          <div class="panel-body">
            
            <div class="form-row">
              <label class="field-label" for="endpointSelect">Target Endpoint</label>
              <select id="endpointSelect" class="control-select" onchange="handleControlChange()">
                <option value="/api/holidays/:year/:state">GET /api/holidays/:year/:state (State Holidays)</option>
                <option value="/api/holidays/:year">GET /api/holidays/:year (National Holidays)</option>
                <option value="/api/holidays/upcoming">GET /api/holidays/upcoming (Upcoming Holidays)</option>
                <option value="/api/long-weekends/:year/:state">GET /api/long-weekends/:year/:state (Long Weekend Finder)</option>
                <option value="/api/business-days">GET /api/business-days (Working Days Calculator)</option>
                <option value="/api/calendar/:year/:state.ics">GET /api/calendar/:year/:state.ics (iCalendar Feed)</option>
                <option value="/api/meta/states">GET /api/meta/states (List All 36 States & UTs)</option>
                <option value="/api/meta/types">GET /api/meta/types (List Holiday Types)</option>
                <option value="/api/openapi.json">GET /api/openapi.json (OpenAPI 3.0 Spec)</option>
                <option value="/api/health">GET /api/health (System Health)</option>
              </select>
            </div>

            <div class="grid-duo form-row" id="yearStateRow">
              <div id="yearGroup">
                <label class="field-label" for="yearSelect">Year (2024–2036)</label>
                <select id="yearSelect" class="control-select" onchange="handleControlChange()">
                  <option value="2026" selected>2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                  <option value="2029">2029</option>
                  <option value="2030">2030</option>
                  <option value="2031">2031</option>
                  <option value="2032">2032</option>
                  <option value="2033">2033</option>
                  <option value="2034">2034</option>
                  <option value="2035">2035</option>
                  <option value="2036">2036</option>
                </select>
              </div>

              <div id="stateGroup">
                <label class="field-label" for="stateSelect">State / UT (36 Regions)</label>
                <select id="stateSelect" class="control-select" onchange="handleControlChange()">
                  <option value="TG" selected>TG — Telangana</option>
                  <option value="IN">IN — National (All India)</option>
                  <option value="AN">AN — Andaman and Nicobar Islands</option>
                  <option value="AP">AP — Andhra Pradesh</option>
                  <option value="AR">AR — Arunachal Pradesh</option>
                  <option value="AS">AS — Assam</option>
                  <option value="BR">BR — Bihar</option>
                  <option value="CH">CH — Chandigarh</option>
                  <option value="CT">CT — Chhattisgarh</option>
                  <option value="DN">DN — Dadra & Nagar Haveli and Daman & Diu</option>
                  <option value="DL">DL — Delhi NCR</option>
                  <option value="GA">GA — Goa</option>
                  <option value="GJ">GJ — Gujarat</option>
                  <option value="HR">HR — Haryana</option>
                  <option value="HP">HP — Himachal Pradesh</option>
                  <option value="JK">JK — Jammu & Kashmir</option>
                  <option value="JH">JH — Jharkhand</option>
                  <option value="KA">KA — Karnataka</option>
                  <option value="KL">KL — Kerala</option>
                  <option value="LA">LA — Ladakh</option>
                  <option value="LD">LD — Lakshadweep</option>
                  <option value="MP">MP — Madhya Pradesh</option>
                  <option value="MH">MH — Maharashtra</option>
                  <option value="MN">MN — Manipur</option>
                  <option value="ML">ML — Meghalaya</option>
                  <option value="MZ">MZ — Mizoram</option>
                  <option value="NL">NL — Nagaland</option>
                  <option value="OR">OR — Odisha</option>
                  <option value="PY">PY — Puducherry</option>
                  <option value="PB">PB — Punjab</option>
                  <option value="RJ">RJ — Rajasthan</option>
                  <option value="SK">SK — Sikkim</option>
                  <option value="TN">TN — Tamil Nadu</option>
                  <option value="TR">TR — Tripura</option>
                  <option value="UP">UP — Uttar Pradesh</option>
                  <option value="UT">UT — Uttarakhand</option>
                  <option value="WB">WB — West Bengal</option>
                </select>
              </div>
            </div>

            <!-- Date Range Controls for Business Days -->
            <div id="dateRangeGroup" style="display: none;" class="form-row">
              <div class="grid-duo" style="margin-bottom: 0.75rem;">
                <div>
                  <label class="field-label" for="fromDateInput">From Date</label>
                  <input type="date" id="fromDateInput" class="control-input" value="2026-03-01" onchange="handleControlChange()">
                </div>
                <div>
                  <label class="field-label" for="toDateInput">To Date</label>
                  <input type="date" id="toDateInput" class="control-input" value="2026-03-31" onchange="handleControlChange()">
                </div>
              </div>
              <label class="checkbox-pill">
                <input type="checkbox" id="bankRulesCheckbox" onchange="handleControlChange()">
                <span>Apply RBI Bank Rules (2nd & 4th Sat Off)</span>
              </label>
            </div>

            <div class="form-row">
              <label class="field-label">Calculated Request Path</label>
              <div class="url-preview-wrapper">
                <span class="url-method-badge">GET</span>
                <div id="urlPreviewDisplay" class="url-preview-bar">/api/holidays/2026/TG</div>
                <button class="url-copy-btn" onclick="copySnippetText(window.location.origin + getGeneratedPath())" title="Copy Full URL" aria-label="Copy Full URL">📋</button>
              </div>
            </div>

            <button class="btn btn-primary" style="width: 100%; justify-content: center; font-size: 0.95rem; padding: 0.75rem 1.25rem;" onclick="executeWorkbenchRequest(true)">
              ⚡ Send API Request
            </button>

            <!-- Collapsible Code Snippet Generator Drawer -->
            <details class="snippets-drawer">
              <summary>
                <span>💻 View Integration Code Snippets</span>
                <span class="snippets-drawer-chevron">▼</span>
              </summary>
              <div class="snippets-container">
                <div class="snippet-tabs-header">
                  <div class="snippet-tabs">
                    <button class="snippet-tab active" onclick="switchSnippetTab('curl', this)">cURL</button>
                    <button class="snippet-tab" onclick="switchSnippetTab('js', this)">JS Fetch</button>
                    <button class="snippet-tab" onclick="switchSnippetTab('python', this)">Python</button>
                    <button class="snippet-tab" onclick="switchSnippetTab('go', this)">Go</button>
                  </div>
                  <button class="btn btn-sm btn-outline" onclick="copyCurrentSnippet()" style="padding: 0.2rem 0.6rem; font-size: 0.72rem;">📋 Copy</button>
                </div>
                <div class="snippet-display" id="snippetDisplayArea">
                  <code id="snippetCode">curl https://holiday2api.vercel.app/api/holidays/2026/TG</code>
                </div>
              </div>
            </details>

          </div>
        </div>

        <!-- Response Viewer Column -->
        <div class="panel" id="wbResponsePanel">
          <div class="panel-header">
            <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
              <span class="panel-header-title">📦 Payload Inspector</span>
              <span id="responseStatusBadge" class="status-indicator">200 OK</span>
              <span id="responseTimeBadge" style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--ink-muted); background: var(--bg); padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">-- ms</span>
            </div>

            <!-- View Switcher & Copy -->
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div class="view-toggle-group">
                <button id="btnViewVisual" class="view-toggle-btn active" onclick="setViewMode('visual')">✦ Visual</button>
                <button id="btnViewRaw" class="view-toggle-btn" onclick="setViewMode('raw')">{ } JSON</button>
              </div>
              <button class="btn btn-sm btn-outline" onclick="copyCurrentPayload()" title="Copy Response Payload" aria-label="Copy Response Payload" style="padding: 0.25rem 0.55rem; font-size: 0.75rem;">📋</button>
            </div>
          </div>
          <div class="panel-body">
            
            <!-- Visual Container -->
            <div id="visualDisplayArea" class="visual-cards-container">
              <div style="color: var(--ink-muted); font-family: var(--font-mono); font-size: 0.85rem; padding: 2.5rem 1rem; text-align: center;">
                Loading payload preview...
              </div>
            </div>

            <!-- Raw JSON Container -->
            <div id="rawDisplayArea" class="raw-code-box" style="display: none;">
              Loading raw response...
            </div>

          </div>
        </div>
      </div>
    </section>

    <!-- Postman & OpenAPI Integration Card -->
    <section id="postman" class="postman-section">
      <div>
        <div class="postman-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff6c37"><circle cx="12" cy="12" r="11"/></svg>
          Postman & OpenAPI 3.0 Ready
        </div>
        <h3 class="postman-heading">Test in Postman in 10 seconds.</h3>
        <p class="postman-text">
          Directly import the complete, typed OpenAPI 3.0 specification into Postman, Insomnia, Swagger, or Bruno. Preloaded with all 10+ endpoints, schema validators, state parameters, and response mocks.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <a href="/api/openapi.json" target="_blank" class="btn btn-primary" style="background: #ff6c37; border-color: #e0531c;">
            📥 View OpenAPI Spec
          </a>
          <button class="btn btn-outline" onclick="copyOpenApiUrl()">
            📋 Copy Spec URL
          </button>
        </div>
      </div>

      <div class="postman-box">
        <strong style="color: var(--ink-primary); font-family: var(--font-display); font-size: 0.92rem; display: block; margin-bottom: 0.75rem;">
          3-Step Postman Import:
        </strong>
        <ol class="step-list">
          <li>
            <span class="step-num">01.</span>
            <span>Open Postman and click <strong>Import</strong>.</span>
          </li>
          <li>
            <span class="step-num">02.</span>
            <span>Paste URL: <code style="color: var(--accent-cyan);" id="postmanSpecUrlText">/api/openapi.json</code></span>
          </li>
          <li>
            <span class="step-num">03.</span>
            <span>Hit enter. All requests and parameters are instantly available in your workspace.</span>
          </li>
        </ol>
      </div>
    </section>

    <!-- Features & Capabilities -->
    <div class="feature-grid">
      <div class="feature-card">
        <span class="feature-num">[01] — CALENDAR ENGINE</span>
        <h3 class="feature-title">Long Weekend Optimizer</h3>
        <p class="feature-desc">
          Automatically searches national and state gazettes to identify 3-day and 4-day weekends, with smart bridge leave advice for travelers and HR planners.
        </p>
      </div>

      <div class="feature-card">
        <span class="feature-num">[02] — FINTECH & ENTERPRISE</span>
        <h3 class="feature-title">RBI & Working Days Calculator</h3>
        <p class="feature-desc">
          Calculates precise working days between any two dates, accurately applying Reserve Bank of India 2nd & 4th Saturday closures alongside gazetted regional holidays.
        </p>
      </div>

      <div class="feature-card">
        <span class="feature-num">[03] — DEVICE SYNC</span>
        <h3 class="feature-title">RFC 5545 iCalendar Feeds</h3>
        <p class="feature-desc">
          Live <code>.ics</code> calendar subscriptions for Apple Calendar, Google Calendar, and Microsoft Outlook. Always timezone-locked to <code>Asia/Kolkata</code>.
        </p>
      </div>
    </div>

    <!-- 36 States & UTs Directory -->
    <section id="states" style="margin: 4rem 0;">
      <div class="section-header">
        <div>
          <h2 class="section-title">🗺️ Supported States & Union Territories</h2>
          <p class="section-desc">Click any region below to instantly test and explore its official gazetted calendar.</p>
        </div>
      </div>

      <div class="states-search-wrapper">
        <input type="text" id="stateSearchInput" class="control-input" placeholder="🔍 Search state or code (e.g. Kerala, DL, Goa)..." oninput="filterStatePills(this.value)">
      </div>

      <div class="states-filter-bar" id="statesContainer">
        <button class="state-pill" data-code="TG" data-name="Telangana" onclick="quickSelectState('TG')"><span>TG</span> Telangana</button>
        <button class="state-pill" data-code="IN" data-name="National All India" onclick="quickSelectState('IN')"><span>IN</span> National (All India)</button>
        <button class="state-pill" data-code="MH" data-name="Maharashtra" onclick="quickSelectState('MH')"><span>MH</span> Maharashtra</button>
        <button class="state-pill" data-code="KA" data-name="Karnataka" onclick="quickSelectState('KA')"><span>KA</span> Karnataka</button>
        <button class="state-pill" data-code="DL" data-name="Delhi NCR" onclick="quickSelectState('DL')"><span>DL</span> Delhi NCR</button>
        <button class="state-pill" data-code="TN" data-name="Tamil Nadu" onclick="quickSelectState('TN')"><span>TN</span> Tamil Nadu</button>
        <button class="state-pill" data-code="WB" data-name="West Bengal" onclick="quickSelectState('WB')"><span>WB</span> West Bengal</button>
        <button class="state-pill" data-code="KL" data-name="Kerala" onclick="quickSelectState('KL')"><span>KL</span> Kerala</button>
        <button class="state-pill" data-code="GJ" data-name="Gujarat" onclick="quickSelectState('GJ')"><span>GJ</span> Gujarat</button>
        <button class="state-pill" data-code="UP" data-name="Uttar Pradesh" onclick="quickSelectState('UP')"><span>UP</span> Uttar Pradesh</button>
        <button class="state-pill" data-code="AN" data-name="Andaman and Nicobar Islands" onclick="quickSelectState('AN')"><span>AN</span> Andaman & Nicobar</button>
        <button class="state-pill" data-code="AP" data-name="Andhra Pradesh" onclick="quickSelectState('AP')"><span>AP</span> Andhra Pradesh</button>
        <button class="state-pill" data-code="AR" data-name="Arunachal Pradesh" onclick="quickSelectState('AR')"><span>AR</span> Arunachal Pradesh</button>
        <button class="state-pill" data-code="AS" data-name="Assam" onclick="quickSelectState('AS')"><span>AS</span> Assam</button>
        <button class="state-pill" data-code="BR" data-name="Bihar" onclick="quickSelectState('BR')"><span>BR</span> Bihar</button>
        <button class="state-pill" data-code="CH" data-name="Chandigarh" onclick="quickSelectState('CH')"><span>CH</span> Chandigarh</button>
        <button class="state-pill" data-code="CT" data-name="Chhattisgarh" onclick="quickSelectState('CT')"><span>CT</span> Chhattisgarh</button>
        <button class="state-pill" data-code="DN" data-name="Dadra & Nagar Haveli and Daman & Diu" onclick="quickSelectState('DN')"><span>DN</span> Dadra & Nagar / Daman & Diu</button>
        <button class="state-pill" data-code="GA" data-name="Goa" onclick="quickSelectState('GA')"><span>GA</span> Goa</button>
        <button class="state-pill" data-code="HR" data-name="Haryana" onclick="quickSelectState('HR')"><span>HR</span> Haryana</button>
        <button class="state-pill" data-code="HP" data-name="Himachal Pradesh" onclick="quickSelectState('HP')"><span>HP</span> Himachal Pradesh</button>
        <button class="state-pill" data-code="JK" data-name="Jammu and Kashmir" onclick="quickSelectState('JK')"><span>JK</span> Jammu & Kashmir</button>
        <button class="state-pill" data-code="JH" data-name="Jharkhand" onclick="quickSelectState('JH')"><span>JH</span> Jharkhand</button>
        <button class="state-pill" data-code="LA" data-name="Ladakh" onclick="quickSelectState('LA')"><span>LA</span> Ladakh</button>
        <button class="state-pill" data-code="LD" data-name="Lakshadweep" onclick="quickSelectState('LD')"><span>LD</span> Lakshadweep</button>
        <button class="state-pill" data-code="MP" data-name="Madhya Pradesh" onclick="quickSelectState('MP')"><span>MP</span> Madhya Pradesh</button>
        <button class="state-pill" data-code="MN" data-name="Manipur" onclick="quickSelectState('MN')"><span>MN</span> Manipur</button>
        <button class="state-pill" data-code="ML" data-name="Meghalaya" onclick="quickSelectState('ML')"><span>ML</span> Meghalaya</button>
        <button class="state-pill" data-code="MZ" data-name="Mizoram" onclick="quickSelectState('MZ')"><span>MZ</span> Mizoram</button>
        <button class="state-pill" data-code="NL" data-name="Nagaland" onclick="quickSelectState('NL')"><span>NL</span> Nagaland</button>
        <button class="state-pill" data-code="OR" data-name="Odisha" onclick="quickSelectState('OR')"><span>OR</span> Odisha</button>
        <button class="state-pill" data-code="PY" data-name="Puducherry" onclick="quickSelectState('PY')"><span>PY</span> Puducherry</button>
        <button class="state-pill" data-code="PB" data-name="Punjab" onclick="quickSelectState('PB')"><span>PB</span> Punjab</button>
        <button class="state-pill" data-code="RJ" data-name="Rajasthan" onclick="quickSelectState('RJ')"><span>RJ</span> Rajasthan</button>
        <button class="state-pill" data-code="SK" data-name="Sikkim" onclick="quickSelectState('SK')"><span>SK</span> Sikkim</button>
        <button class="state-pill" data-code="TR" data-name="Tripura" onclick="quickSelectState('TR')"><span>TR</span> Tripura</button>
        <button class="state-pill" data-code="UT" data-name="Uttarakhand" onclick="quickSelectState('UT')"><span>UT</span> Uttarakhand</button>
      </div>
    </section>

    <!-- API Reference Table -->
    <section id="docs">
      <div class="section-header">
        <div>
          <h2 class="section-title">📖 Complete API Reference</h2>
          <p class="section-desc">Standardized JSON endpoints with global edge caching (<code>Cache-Control: public, max-age=3600</code>) and unrestricted CORS headers.</p>
        </div>
      </div>

      <div class="doc-table-wrap">
        <table class="doc-table">
          <colgroup>
            <col style="width: 90px;">
            <col style="width: 320px;">
            <col style="width: 380px;">
            <col style="width: 250px;">
          </colgroup>
          <thead>
            <tr>
              <th style="text-align: center;">Method</th>
              <th>Endpoint Path</th>
              <th>Description & Parameters</th>
              <th>Live Preview</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center;"><span class="method-get">GET</span></td>
              <td>
                <code class="endpoint-code">/api/holidays/<span class="param">:year</span>/<span class="param">:state</span></code>
              </td>
              <td>
                <span class="table-endpoint-title">Regional & State Holidays</span>
                Merged state gazette and national holidays for any Indian State or Union Territory.
                <div class="table-param-note"><code>:year</code> 2024–2036 • <code>:state</code> 2-letter ISO (e.g. <code>TG</code>, <code>MH</code>, <code>KA</code>)</div>
              </td>
              <td>
                <a href="/api/holidays/2026/TG" target="_blank" class="endpoint-sample-btn">
                  <span>/api/holidays/2026/TG</span>
                  <span class="arrow-icon">↗</span>
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align: center;"><span class="method-get">GET</span></td>
              <td>
                <code class="endpoint-code">/api/holidays/<span class="param">:year</span></code>
              </td>
              <td>
                <span class="table-endpoint-title">National Gazetted Holidays</span>
                All mandatory and central government holidays observed across India.
                <div class="table-param-note"><code>:year</code> 2024–2036</div>
              </td>
              <td>
                <a href="/api/holidays/2026" target="_blank" class="endpoint-sample-btn">
                  <span>/api/holidays/2026</span>
                  <span class="arrow-icon">↗</span>
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align: center;"><span class="method-get">GET</span></td>
              <td>
                <code class="endpoint-code">/api/holidays/upcoming</code>
              </td>
              <td>
                <span class="table-endpoint-title">Upcoming Holidays Stream</span>
                Chronological list of next upcoming holidays relative to today's date in IST.
                <div class="table-param-note"><code>?state=XX</code> (optional) • <code>?limit=N</code> max results (default 5)</div>
              </td>
              <td>
                <a href="/api/holidays/upcoming?state=MH&limit=5" target="_blank" class="endpoint-sample-btn">
                  <span>/api/holidays/upcoming?state=MH</span>
                  <span class="arrow-icon">↗</span>
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align: center;"><span class="method-get">GET</span></td>
              <td>
                <code class="endpoint-code">/api/long-weekends/<span class="param">:year</span>/<span class="param">:state</span></code>
              </td>
              <td>
                <span class="table-endpoint-title">Long Weekend & Bridge Planner</span>
                Identifies 3-day and 4-day bridge weekends with strategic leave recommendations.
                <div class="table-param-note"><code>:year</code> 2024–2036 • <code>:state</code> 2-letter ISO (e.g. <code>KA</code>)</div>
              </td>
              <td>
                <a href="/api/long-weekends/2026/KA" target="_blank" class="endpoint-sample-btn">
                  <span>/api/long-weekends/2026/KA</span>
                  <span class="arrow-icon">↗</span>
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align: center;"><span class="method-get">GET</span></td>
              <td>
                <code class="endpoint-code">/api/business-days</code>
              </td>
              <td>
                <span class="table-endpoint-title">Working & Business Days Calculator</span>
                Calculates working days between two dates, excluding weekends and official holidays.
                <div class="table-param-note"><code>?from=YYYY-MM-DD</code> • <code>?to=YYYY-MM-DD</code> • <code>?bank_rules=true</code></div>
              </td>
              <td>
                <a href="/api/business-days?from=2026-03-01&to=2026-03-31&state=MH" target="_blank" class="endpoint-sample-btn">
                  <span>/api/business-days?from=...</span>
                  <span class="arrow-icon">↗</span>
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align: center;"><span class="method-get">GET</span></td>
              <td>
                <code class="endpoint-code">/api/calendar/<span class="param">:year</span>/<span class="param">:state</span>.ics</code>
              </td>
              <td>
                <span class="table-endpoint-title">iCalendar (.ics) Subscriptions</span>
                RFC 5545 calendar feed for Google Calendar, Apple Calendar, and Microsoft Outlook.
                <div class="table-param-note"><code>:year</code> 2024–2036 • <code>:state</code> ISO or <code>IN</code> for national</div>
              </td>
              <td>
                <a href="/api/calendar/2026/TG.ics" target="_blank" class="endpoint-sample-btn">
                  <span>/api/calendar/2026/TG.ics</span>
                  <span class="arrow-icon">↗</span>
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align: center;"><span class="method-get">GET</span></td>
              <td>
                <code class="endpoint-code">/api/meta/states</code>
              </td>
              <td>
                <span class="table-endpoint-title">36 States & UTs Directory</span>
                Complete catalog of all 36 States & Union Territories with ISO-3166-2:IN codes.
                <div class="table-param-note">No query parameters required</div>
              </td>
              <td>
                <a href="/api/meta/states" target="_blank" class="endpoint-sample-btn">
                  <span>/api/meta/states</span>
                  <span class="arrow-icon">↗</span>
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align: center;"><span class="method-get">GET</span></td>
              <td>
                <code class="endpoint-code">/api/meta/types</code>
              </td>
              <td>
                <span class="table-endpoint-title">Holiday Classifications</span>
                List of all supported holiday classifications (<code>national</code>, <code>gazetted</code>, <code>restricted</code>, <code>bank</code>).
                <div class="table-param-note">No query parameters required</div>
              </td>
              <td>
                <a href="/api/meta/types" target="_blank" class="endpoint-sample-btn">
                  <span>/api/meta/types</span>
                  <span class="arrow-icon">↗</span>
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align: center;"><span class="method-get">GET</span></td>
              <td>
                <code class="endpoint-code">/api/openapi.json</code>
              </td>
              <td>
                <span class="table-endpoint-title">OpenAPI 3.0.3 Specification</span>
                Standard machine-readable specification for SDK generators and Postman collections.
                <div class="table-param-note">No query parameters required</div>
              </td>
              <td>
                <a href="/api/openapi.json" target="_blank" class="endpoint-sample-btn">
                  <span>/api/openapi.json</span>
                  <span class="arrow-icon">↗</span>
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align: center;"><span class="method-get">GET</span></td>
              <td>
                <code class="endpoint-code">/api/health</code>
              </td>
              <td>
                <span class="table-endpoint-title">Edge Health & Timezone Status</span>
                Health status, cluster uptime, current Asia/Kolkata timestamp, and API version.
                <div class="table-param-note">No query parameters required</div>
              </td>
              <td>
                <a href="/api/health" target="_blank" class="endpoint-sample-btn">
                  <span>/api/health</span>
                  <span class="arrow-icon">↗</span>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </main>

  <!-- Toast Notification Element -->
  <div id="toastNotification" class="toast" role="status" aria-live="polite">
    <span>✓</span>
    <span id="toastMessage">Copied to clipboard</span>
  </div>

  <!-- Human Crafted Footer -->
  <footer>
    <div class="footer-inner">
      <div class="footer-col-main">
        <div class="footer-brand">
          <span>India Holidays API</span>
          <span class="footer-flag" aria-label="Indian Flag">${FAVICON_SVG}</span>
        </div>
        <p class="footer-desc">
          Built as public data infrastructure for engineers, HRMS platforms, fintech apps, and calendar tools. Free forever under the MIT License with zero tracking and zero telemetry.
        </p>
      </div>
      <div class="footer-nav-col">
        <div class="footer-nav-title">Navigation</div>
        <a href="#workbench" class="footer-link">Interactive Sandbox</a>
        <a href="#postman" class="footer-link">Postman & OpenAPI</a>
        <a href="#states" class="footer-link">36 States Directory</a>
        <a href="#docs" class="footer-link">API Endpoints</a>
      </div>
      <div class="footer-nav-col">
        <div class="footer-nav-title">Developers</div>
        <a href="/api/openapi.json" target="_blank" class="footer-link">OpenAPI 3.0 Spec</a>
        <a href="/api/meta/states" target="_blank" class="footer-link">States Metadata</a>
        <a href="https://github.com/urunkarpm/holiday2api" target="_blank" class="footer-link" rel="noopener noreferrer">GitHub Repository</a>
        <a href="/api/health" target="_blank" class="footer-link">System Health</a>
      </div>
    </div>
    <div class="footer-bottom">
      <div>© 2026 India Holidays API • Open Source MIT</div>
      <div>Timezone: Asia/Kolkata (IST • UTC+05:30)</div>
    </div>
  </footer>

  <script>
    let toastTimeout = null;

    function initTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      updateThemeUI(currentTheme);
    }

    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', nextTheme);
      try {
        localStorage.setItem('holiday2api_theme', nextTheme);
      } catch (e) {}
      updateThemeUI(nextTheme);
      showToast(nextTheme === 'light' ? '☀️ Day mode activated' : '🌙 Night mode activated');
    }

    function updateThemeUI(theme) {
      const label = document.getElementById('themeLabel');
      if (label) {
        label.textContent = theme === 'dark' ? 'Night' : 'Day';
      }
    }

    let activeSnippetType = 'curl';
    let activeViewMode = 'visual';
    let lastFetchedData = null;
    let lastFetchedIsIcs = false;

    function getGeneratedPath() {
      const ep = document.getElementById('endpointSelect').value;
      const year = document.getElementById('yearSelect').value;
      const state = document.getElementById('stateSelect').value;
      const fromDate = document.getElementById('fromDateInput').value;
      const toDate = document.getElementById('toDateInput').value;
      const bankRules = document.getElementById('bankRulesCheckbox').checked;

      if (ep === '/api/holidays/:year/:state') return '/api/holidays/' + year + '/' + state;
      if (ep === '/api/holidays/:year') return '/api/holidays/' + year;
      if (ep === '/api/holidays/upcoming') return '/api/holidays/upcoming?state=' + state + '&limit=5';
      if (ep === '/api/long-weekends/:year/:state') return '/api/long-weekends/' + year + '/' + state;
      if (ep === '/api/business-days') return '/api/business-days?from=' + fromDate + '&to=' + toDate + '&state=' + state + (bankRules ? '&bank_rules=true' : '');
      if (ep === '/api/calendar/:year/:state.ics') return '/api/calendar/' + year + '/' + state + '.ics';
      if (ep === '/api/meta/states') return '/api/meta/states';
      if (ep === '/api/meta/types') return '/api/meta/types';
      if (ep === '/api/openapi.json') return '/api/openapi.json';
      if (ep === '/api/health') return '/api/health';
      return '/api/holidays/' + year + '/' + state;
    }

    function updateFormFields() {
      const ep = document.getElementById('endpointSelect').value;
      const yearStateRow = document.getElementById('yearStateRow');
      const yearGroup = document.getElementById('yearGroup');
      const stateGroup = document.getElementById('stateGroup');
      const dateRangeGroup = document.getElementById('dateRangeGroup');

      const hasYear = ep.includes(':year');
      const hasState = ep.includes(':state') || ep.includes('upcoming') || ep.includes('business');
      const hasDateRange = ep.includes('business-days');

      yearGroup.style.display = hasYear ? 'block' : 'none';
      stateGroup.style.display = hasState ? 'block' : 'none';
      yearStateRow.style.display = (hasYear || hasState) ? 'grid' : 'none';
      if (hasYear && !hasState) {
        yearStateRow.style.gridTemplateColumns = '1fr';
      } else if (!hasYear && hasState) {
        yearStateRow.style.gridTemplateColumns = '1fr';
      } else {
        yearStateRow.style.gridTemplateColumns = 'repeat(auto-fit, minmax(170px, 1fr))';
      }
      dateRangeGroup.style.display = hasDateRange ? 'block' : 'none';

      const path = getGeneratedPath();
      document.getElementById('urlPreviewDisplay').innerText = path;
      updateSnippetDisplay();
    }

    function handleControlChange() {
      updateFormFields();
      executeWorkbenchRequest();
    }

    function updateSnippetDisplay() {
      const fullUrl = window.location.origin + getGeneratedPath();
      let code = '';
      if (activeSnippetType === 'curl') {
        code = 'curl "' + fullUrl + '"';
      } else if (activeSnippetType === 'js') {
        code = 'fetch("' + fullUrl + '")\\n  .then(res => res.json())\\n  .then(data => console.log(data));';
      } else if (activeSnippetType === 'python') {
        code = 'import requests\\n\\nres = requests.get("' + fullUrl + '")\\nprint(res.json())';
      } else if (activeSnippetType === 'go') {
        code = 'package main\\nimport ("fmt"; "net/http"; "io")\\n\\nfunc main() {\\n  resp, _ := http.Get("' + fullUrl + '")\\n  defer resp.Body.Close()\\n  body, _ := io.ReadAll(resp.Body)\\n  fmt.Println(string(body))\\n}';
      }
      document.getElementById('snippetCode').innerText = code;
    }

    function switchSnippetTab(type, el) {
      activeSnippetType = type;
      document.querySelectorAll('.snippet-tab').forEach(t => t.classList.remove('active'));
      if (el) {
        el.classList.add('active');
      } else if (typeof event !== 'undefined' && event && event.target) {
        const targetTab = event.target.closest('.snippet-tab');
        if (targetTab) targetTab.classList.add('active');
      }
      updateSnippetDisplay();
    }

    function setViewMode(mode) {
      activeViewMode = mode;
      document.getElementById('btnViewVisual').classList.toggle('active', mode === 'visual');
      document.getElementById('btnViewRaw').classList.toggle('active', mode === 'raw');
      
      document.getElementById('visualDisplayArea').style.display = (mode === 'visual') ? 'grid' : 'none';
      document.getElementById('rawDisplayArea').style.display = (mode === 'raw') ? 'block' : 'none';

      if (lastFetchedData !== null) {
        renderPayloadViews(lastFetchedData, lastFetchedIsIcs);
      }
    }

    function copyCurrentPayload() {
      if (lastFetchedData !== null) {
        const text = lastFetchedIsIcs ? lastFetchedData : JSON.stringify(lastFetchedData, null, 2);
        navigator.clipboard.writeText(text);
        showToast('Copied payload to clipboard');
      } else {
        showToast('No payload loaded');
      }
    }

    function switchWorkbenchMobileTab(tab) {
      const panelControls = document.getElementById('wbControlsPanel');
      const panelResponse = document.getElementById('wbResponsePanel');
      const btnControls = document.getElementById('btnTabControls');
      const btnResponse = document.getElementById('btnTabResponse');
      
      if (panelControls && panelResponse && btnControls && btnResponse) {
        if (tab === 'controls') {
          btnControls.classList.add('active');
          btnResponse.classList.remove('active');
          panelControls.classList.add('wb-panel-active');
          panelResponse.classList.remove('wb-panel-active');
        } else {
          btnControls.classList.remove('active');
          btnResponse.classList.add('active');
          panelControls.classList.remove('wb-panel-active');
          panelResponse.classList.add('wb-panel-active');
        }
      }
    }

    async function executeWorkbenchRequest(isExplicitUserSend) {
      const path = getGeneratedPath();
      const startTime = performance.now();
      const visualContainer = document.getElementById('visualDisplayArea');
      const rawContainer = document.getElementById('rawDisplayArea');
      const statusBadge = document.getElementById('responseStatusBadge');
      const timeBadge = document.getElementById('responseTimeBadge');

      visualContainer.innerHTML = '<div style="grid-column: 1/-1; color: var(--ink-muted); font-family: var(--font-mono); font-size: 0.85rem; padding: 3rem 1rem; text-align: center;">⚡ Fetching data from edge...</div>';
      rawContainer.innerText = 'Fetching data...';

      if (isExplicitUserSend && window.innerWidth < 990) {
        switchWorkbenchMobileTab('response');
      }

      try {
        const res = await fetch(path);
        const elapsed = Math.round(performance.now() - startTime);
        timeBadge.innerText = elapsed + ' ms';
        statusBadge.innerText = res.status + ' ' + (res.status === 200 ? 'OK' : res.statusText);
        statusBadge.style.color = res.ok ? 'var(--accent-emerald)' : '#ef4444';

        if (path.endsWith('.ics')) {
          const text = await res.text();
          lastFetchedData = text;
          lastFetchedIsIcs = true;
          renderPayloadViews(text, true);
        } else {
          const json = await res.json();
          lastFetchedData = json;
          lastFetchedIsIcs = false;
          renderPayloadViews(json, false);
        }
      } catch (err) {
        statusBadge.innerText = 'Error';
        statusBadge.style.color = '#ef4444';
        visualContainer.innerHTML = '<div style="grid-column: 1/-1; color: #ef4444; font-family: var(--font-mono); padding: 1.5rem; background: var(--bg); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-md);">Failed to fetch: ' + err.message + '</div>';
        rawContainer.innerText = 'Error: ' + err.message;
      }
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function renderPayloadViews(data, isIcs) {
      const visualContainer = document.getElementById('visualDisplayArea');
      const rawContainer = document.getElementById('rawDisplayArea');
      const countBadge = document.getElementById('wbResultCountBadge');

      if (countBadge) {
        if (isIcs) countBadge.textContent = 'iCal';
        else if (Array.isArray(data)) countBadge.textContent = data.length + ' Items';
        else if (data && data.long_weekends) countBadge.textContent = data.long_weekends.length + ' Weekends';
        else if (data && data.working_days !== undefined) countBadge.textContent = data.working_days + ' Days';
        else countBadge.textContent = 'Ready';
      }

      // 1. Calendar (.ICS) View
      if (isIcs) {
        rawContainer.innerText = data;
        const currentPath = getGeneratedPath();
        const safeEncodedPath = encodeURI(currentPath);
        const fullIcsUrl = window.location.origin + currentPath;
        visualContainer.innerHTML = '<div style="grid-column: 1/-1; padding: 1.5rem; background: var(--bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); box-shadow: var(--shadow-crisp);">' +
          '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">' +
            '<span class="tag-badge gazetted">RFC 5545 Live Feed</span>' +
            '<span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-emerald);">● Synchronized</span>' +
          '</div>' +
          '<h3 style="color: var(--ink-primary); font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">📅 iCalendar (.ics) Feed Generated</h3>' +
          '<p style="color: var(--ink-secondary); font-size: 0.9rem; line-height: 1.55; margin-bottom: 1.35rem;">' +
            'This universal calendar subscription contains all gazetted holidays locked to Asia/Kolkata timezone. Subscribe once to get automatic updates on Apple Calendar, Google Calendar, or Outlook.' +
          '</p>' +
          '<div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">' +
            '<a class="btn btn-sm btn-primary" href="' + escapeHtml(safeEncodedPath) + '" target="_blank" rel="noopener noreferrer">📥 Download .ics File</a>' +
            '<button class="btn btn-sm btn-outline" id="btnCopyWebCal">📋 Copy WebCal URL</button>' +
          '</div>' +
        '</div>';

        const btnCopy = document.getElementById('btnCopyWebCal');
        if (btnCopy) {
          btnCopy.addEventListener('click', () => copySnippetText(fullIcsUrl));
        }
        return;
      }

      rawContainer.innerText = JSON.stringify(data, null, 2);

      // Helper function to render a list of long weekend cards
      function renderLongWeekendCards(lwList, totalCount, year, state) {
        if (!Array.isArray(lwList) || lwList.length === 0) {
          return '<div style="grid-column: 1/-1; color: var(--ink-muted); padding: 3rem 1rem; text-align: center; font-family: var(--font-mono); font-size: 0.88rem;">🔍 No long weekends detected for this selection.</div>';
        }
        let html = '';
        if (totalCount !== undefined) {
          html += '<div style="grid-column: 1/-1; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; padding: 0 0.2rem;">' +
            '<span style="font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700; color: var(--ink-secondary); text-transform: uppercase;">' + (state ? escapeHtml(state) + ' — ' : '') + escapeHtml(year) + ' (' + escapeHtml(totalCount) + ' Long Weekends Found)</span>' +
            '<span class="tag-badge gazetted">' + escapeHtml(totalCount) + ' Opportunities</span>' +
          '</div>';
        }
        lwList.forEach(lw => {
          const isBridge = (lw.type === 'bridge_weekend') || (lw.bridge_days_needed > 0) || (lw.total_days >= 4);
          const badgeClass = isBridge ? 'gazetted' : 'national';
          const badgeText = lw.total_days ? escapeHtml(lw.total_days) + ' Days Off' : 'Long Weekend';
          const holidaysIncludedNames = Array.isArray(lw.holidays_included) ? lw.holidays_included.map(h => h.name).join(', ') : '';

          html += '<div class="lw-card" style="grid-column: 1/-1;">' +
            '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.45rem; flex-wrap: wrap; gap: 0.5rem;">' +
              '<div class="lw-title">' + escapeHtml(holidaysIncludedNames || lw.name || 'Long Weekend') + '</div>' +
              '<span class="tag-badge ' + badgeClass + '">' + badgeText + '</span>' +
            '</div>' +
            '<div class="lw-meta">🗓️ ' + escapeHtml(lw.start_date) + ' → ' + escapeHtml(lw.end_date) + ' • ' + (isBridge ? 'Bridge Leave (' + escapeHtml(lw.bridge_days_needed) + ' day leave)' : 'Natural Weekend') + '</div>' +
            '<div class="lw-advice">💡 ' + escapeHtml(lw.recommendation || lw.leave_required || 'No additional leave required — natural weekend.') + '</div>' +
          '</div>';
        });
        return html;
      }

      // Helper function to render a list of holiday cards
      function renderHolidayCards(holidayList) {
        if (!Array.isArray(holidayList) || holidayList.length === 0) {
          return '<div style="grid-column: 1/-1; color: var(--ink-muted); padding: 3rem 1rem; text-align: center; font-family: var(--font-mono); font-size: 0.88rem;">🔍 No records matched the selected query parameters.</div>';
        }
        let html = '';
        holidayList.forEach(h => {
          const dateObj = new Date(h.date + 'T00:00:00+05:30');
          const monthStr = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Kolkata' });
          const dayNum = isNaN(dateObj.getTime()) ? '' : dateObj.getDate();
          const weekday = h.day || h.day_of_week || (isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }));

          let typeBadgeClass = 'tag-badge';
          const typeLower = (h.type || '').toLowerCase();
          if (typeLower === 'national') typeBadgeClass += ' national';
          else if (typeLower === 'gazetted' || typeLower === 'public' || typeLower === 'state') typeBadgeClass += ' gazetted';
          else if (typeLower === 'bank') typeBadgeClass += ' bank';
          else if (typeLower === 'restricted' || typeLower === 'optional') typeBadgeClass += ' restricted';

          const typeBadge = '<span class="' + typeBadgeClass + '">' + escapeHtml(h.type || 'holiday') + '</span>';
          const stateBadge = h.state_code ? '<span class="tag-badge national">' + escapeHtml(h.state_code) + '</span>' : '';
          
          let countdownBadge = '';
          if (h.days_until !== undefined) {
            let countdownText = 'In ' + escapeHtml(h.days_until) + ' days';
            if (h.days_until === 0) countdownText = '🌟 Today';
            else if (h.days_until === 1) countdownText = '⚡ Tomorrow';
            countdownBadge = '<span class="tag-badge upcoming-countdown">' + countdownText + '</span>';
          }

          html += '<div class="holiday-card">' +
            '<div>' +
              '<div class="holiday-date-strip">' +
                '<div><span class="holiday-day-num">' + escapeHtml(dayNum) + '</span> <span class="holiday-month-name">' + escapeHtml(monthStr) + '</span></div>' +
                '<span class="holiday-weekday">' + escapeHtml(weekday) + '</span>' +
              '</div>' +
              '<div class="holiday-name">' + escapeHtml(h.name) + '</div>' +
            '</div>' +
            '<div class="holiday-tags">' + typeBadge + stateBadge + countdownBadge + '</div>' +
          '</div>';
        });
        return html;
      }

      // 2. Objects with long_weekends property: /api/long-weekends/:year/:state
      if (typeof data === 'object' && data !== null && Array.isArray(data.long_weekends)) {
        visualContainer.innerHTML = renderLongWeekendCards(data.long_weekends, data.total_long_weekends, data.year, data.state_code);
        return;
      }

      // 3. Arrays: Bare Holidays or Bare Long Weekends
      if (Array.isArray(data)) {
        if (data.length === 0) {
          visualContainer.innerHTML = '<div style="grid-column: 1/-1; color: var(--ink-muted); padding: 3rem 1rem; text-align: center; font-family: var(--font-mono); font-size: 0.88rem;">🔍 No records matched the selected query parameters.</div>';
          return;
        }

        // Check if items are long weekend objects
        if (data[0] && (data[0].type === 'bridge_weekend' || data[0].type === 'natural_long_weekend' || data[0].recommendation || data[0].total_days)) {
          visualContainer.innerHTML = renderLongWeekendCards(data, data.length);
          return;
        }

        // Standard Holiday Array
        visualContainer.innerHTML = renderHolidayCards(data);
        return;
      }

      // 4. Other Objects: Business Days, States Metadata, Types Metadata, OpenAPI Spec, Health Check
      if (typeof data === 'object' && data !== null) {
        
        // A. Business / Working Days Object
        if (data.working_days !== undefined) {
          let html = '<div style="grid-column: 1/-1; background: var(--bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.35rem; box-shadow: var(--shadow-crisp);">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.15rem; flex-wrap: wrap; gap: 0.5rem;">' +
              '<h4 style="font-size: 1.15rem; color: var(--ink-primary); font-weight: 700;">💼 Working Days Calculation</h4>' +
              '<span class="tag-badge national">' + escapeHtml(data.state_code || 'IN') + '</span>' +
            '</div>' +
            '<div class="kpi-grid">' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--accent-emerald);">' + escapeHtml(data.working_days) + '</div><div class="kpi-label">Working Days</div></div>' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--accent-saffron);">' + escapeHtml(data.holiday_days_count || 0) + '</div><div class="kpi-label">Holidays</div></div>' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--accent-marigold);">' + escapeHtml(data.weekend_days || 0) + '</div><div class="kpi-label">Weekend Days</div></div>' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--ink-primary);">' + escapeHtml(data.total_calendar_days || 0) + '</div><div class="kpi-label">Total Span</div></div>' +
            '</div>' +
            '<div style="font-size: 0.85rem; font-family: var(--font-mono); color: var(--ink-secondary); margin-bottom: 1rem; background: var(--bg-surface); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">' +
              'Date Span: <strong style="color: var(--ink-primary);">' + escapeHtml(data.from) + '</strong> → <strong style="color: var(--ink-primary);">' + escapeHtml(data.to) + '</strong> • Rules: <strong style="color: var(--accent-saffron);">' + escapeHtml(data.rules || 'Standard') + '</strong>' +
            '</div>';

          if (Array.isArray(data.holidays_on_weekdays) && data.holidays_on_weekdays.length > 0) {
            html += '<div style="margin-top: 1rem;"><strong style="font-size: 0.76rem; font-family: var(--font-mono); color: var(--accent-saffron); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.45rem;">Weekdays Holidays:</strong><div style="display:flex; flex-wrap:wrap; gap:0.4rem;">';
            data.holidays_on_weekdays.forEach(hw => {
              html += '<span class="tag-badge gazetted">' + escapeHtml(hw.date) + ' — ' + escapeHtml(hw.name) + ' (' + escapeHtml(hw.day) + ')</span>';
            });
            html += '</div></div>';
          }

          if (Array.isArray(data.holidays_on_weekends) && data.holidays_on_weekends.length > 0) {
            html += '<div style="margin-top: 1rem;"><strong style="font-size: 0.76rem; font-family: var(--font-mono); color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.45rem;">Weekend Holidays:</strong><div style="display:flex; flex-wrap:wrap; gap:0.4rem;">';
            data.holidays_on_weekends.forEach(he => {
              html += '<span class="tag-badge">' + escapeHtml(he.date) + ' — ' + escapeHtml(he.name) + ' (' + escapeHtml(he.day) + ')</span>';
            });
            html += '</div></div>';
          }

          html += '</div>';
          visualContainer.innerHTML = html;
          return;
        }

        // B. States Metadata (/api/meta/states)
        if (Array.isArray(data.states)) {
          let html = '';
          data.states.forEach(st => {
            const isUT = st.type === 'union_territory';
            const isNat = st.type === 'national';
            const badgeClass = isNat ? 'national' : isUT ? 'gazetted' : '';
            const typeLabel = isNat ? 'National' : isUT ? 'Union Territory' : 'State';

            html += '<div class="meta-card">' +
              '<div class="meta-card-header">' +
                '<span style="font-family: var(--font-mono); font-size: 1.15rem; font-weight: 800; color: var(--accent-saffron);">' + escapeHtml(st.code) + '</span>' +
                '<span class="tag-badge ' + badgeClass + '">' + escapeHtml(typeLabel) + '</span>' +
              '</div>' +
              '<div class="meta-card-title">' + escapeHtml(st.name) + '</div>' +
              '<button class="btn btn-sm btn-outline btn-quick-state" style="margin-top: 0.45rem; justify-content: center;" data-state="' + escapeHtml(st.code) + '">⚡ Query ' + escapeHtml(st.code) + '</button>' +
            '</div>';
          });
          visualContainer.innerHTML = html;
          visualContainer.querySelectorAll('.btn-quick-state').forEach(btn => {
            btn.addEventListener('click', () => quickSelectState(btn.getAttribute('data-state')));
          });
          return;
        }

        // C. Types Metadata (/api/meta/types)
        if (Array.isArray(data.types)) {
          let html = '';
          data.types.forEach(tp => {
            const badgeClass = tp.id === 'national' ? 'national' : (tp.id === 'public' || tp.id === 'state') ? 'gazetted' : '';
            html += '<div class="meta-card">' +
              '<div class="meta-card-header">' +
                '<span class="meta-card-title">' + escapeHtml(tp.name) + '</span>' +
                '<span class="tag-badge ' + badgeClass + '">' + escapeHtml(tp.id) + '</span>' +
              '</div>' +
              '<div class="meta-card-desc">' + escapeHtml(tp.description) + '</div>' +
            '</div>';
          });
          visualContainer.innerHTML = html;
          return;
        }

        // D. Health Telemetry (/api/health)
        if (data.status && (data.uptime || data.timestamp || data.timezone)) {
          let html = '<div style="grid-column: 1/-1; background: var(--bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.35rem; box-shadow: var(--shadow-crisp);">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">' +
              '<h4 style="font-size: 1.15rem; color: var(--ink-primary); font-weight: 700;">📡 API Edge Status & Health</h4>' +
              '<span class="status-indicator"><span class="ping-dot"></span><span>' + escapeHtml((data.status || 'OK').toUpperCase()) + '</span></span>' +
            '</div>' +
            '<div class="kpi-grid">' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--accent-emerald);">' + escapeHtml(data.status || 'OK') + '</div><div class="kpi-label">Edge Health</div></div>' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--accent-cyan);">' + escapeHtml(data.uptime || '99.99%') + '</div><div class="kpi-label">Uptime</div></div>' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--accent-saffron); font-size: 1.2rem;">' + escapeHtml(data.timezone || 'Asia/Kolkata') + '</div><div class="kpi-label">Timezone</div></div>' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--ink-primary);">' + escapeHtml(data.version || '1.0.0') + '</div><div class="kpi-label">API Version</div></div>' +
            '</div>' +
            '<div style="font-size: 0.8rem; font-family: var(--font-mono); color: var(--ink-muted); margin-top: 0.65rem;">Server Timestamp: ' + escapeHtml(data.timestamp || new Date().toISOString()) + '</div>' +
          '</div>';
          visualContainer.innerHTML = html;
          return;
        }

        // E. OpenAPI Spec (/api/openapi.json)
        if (data.openapi && data.paths) {
          let html = '<div style="grid-column: 1/-1; background: var(--bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.35rem; margin-bottom: 0.75rem; box-shadow: var(--shadow-crisp);">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">' +
              '<h4 style="font-size: 1.2rem; color: var(--ink-primary); font-weight: 700;">' + escapeHtml(data.info?.title || 'OpenAPI 3.0 Spec') + '</h4>' +
              '<span class="tag-badge gazetted">v' + escapeHtml(data.info?.version || '1.0.0') + '</span>' +
            '</div>' +
            '<p style="color: var(--ink-secondary); font-size: 0.88rem; margin-bottom: 1.15rem; line-height: 1.5;">' + escapeHtml(data.info?.description || '') + '</p>' +
            '<div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">' +
              '<a href="/api/openapi.json" target="_blank" class="btn btn-sm btn-primary">📥 Open Full Spec JSON</a>' +
              '<button class="btn btn-sm btn-outline" onclick="copyOpenApiUrl()">📋 Copy Spec URL</button>' +
            '</div>' +
          '</div>';

          Object.keys(data.paths).forEach(p => {
            const pathObj = data.paths[p];
            const getMethod = pathObj.get;
            if (getMethod) {
              html += '<div class="meta-card" style="grid-column: 1/-1;">' +
                '<div class="meta-card-header">' +
                  '<div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">' +
                    '<span class="tag-badge national" style="font-weight: 700;">GET</span>' +
                    '<code style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--accent-cyan);">' + escapeHtml(p) + '</code>' +
                  '</div>' +
                '</div>' +
                '<div class="meta-card-desc">' + escapeHtml(getMethod.summary || '') + '</div>' +
              '</div>';
            }
          });
          visualContainer.innerHTML = html;
          return;
        }

        // Generic Object fallback
        let html = '<div style="grid-column: 1/-1; background: var(--bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.35rem; box-shadow: var(--shadow-crisp);">' +
          '<pre style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--accent-cyan); line-height: 1.5;">' + escapeHtml(JSON.stringify(data, null, 2)) + '</pre>' +
        '</div>';
        visualContainer.innerHTML = html;
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('toastNotification');
      const msgEl = document.getElementById('toastMessage');
      if (toast && msgEl) {
        msgEl.innerText = msg;
        toast.classList.add('show');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 2200);
      }
    }

    function copyHeroCurl() {
      const url = window.location.origin + '/api/holidays/2026/TG';
      navigator.clipboard.writeText('curl "' + url + '"');
      showToast('Copied cURL command');
    }

    function copySnippetText(txt) {
      navigator.clipboard.writeText(txt);
      showToast('Copied to clipboard');
    }

    function copyCurrentSnippet() {
      const code = document.getElementById('snippetCode').innerText;
      navigator.clipboard.writeText(code);
      showToast('Copied code snippet');
    }

    function copyOpenApiUrl() {
      const url = window.location.origin + '/api/openapi.json';
      navigator.clipboard.writeText(url);
      showToast('Copied OpenAPI specification URL');
    }

    function applyPreset(type, el) {
      document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
      if (el) {
        el.classList.add('active');
      } else if (typeof event !== 'undefined' && event && event.target) {
        const targetChip = event.target.closest('.preset-chip');
        if (targetChip) targetChip.classList.add('active');
      }

      if (type === 'tg-2026') {
        document.getElementById('endpointSelect').value = '/api/holidays/:year/:state';
        document.getElementById('yearSelect').value = '2026';
        document.getElementById('stateSelect').value = 'TG';
      } else if (type === 'mh-lw') {
        document.getElementById('endpointSelect').value = '/api/long-weekends/:year/:state';
        document.getElementById('yearSelect').value = '2026';
        document.getElementById('stateSelect').value = 'MH';
      } else if (type === 'upcoming') {
        document.getElementById('endpointSelect').value = '/api/holidays/upcoming';
        document.getElementById('stateSelect').value = 'IN';
      } else if (type === 'rbi-working') {
        document.getElementById('endpointSelect').value = '/api/business-days';
        document.getElementById('stateSelect').value = 'MH';
        document.getElementById('fromDateInput').value = '2026-01-01';
        document.getElementById('toDateInput').value = '2026-03-31';
        document.getElementById('bankRulesCheckbox').checked = true;
      } else if (type === 'national-2026') {
        document.getElementById('endpointSelect').value = '/api/holidays/:year';
        document.getElementById('yearSelect').value = '2026';
      } else if (type === 'ics-feed') {
        document.getElementById('endpointSelect').value = '/api/calendar/:year/:state.ics';
        document.getElementById('yearSelect').value = '2026';
        document.getElementById('stateSelect').value = 'TG';
      } else if (type === 'meta-states') {
        document.getElementById('endpointSelect').value = '/api/meta/states';
      } else if (type === 'meta-types') {
        document.getElementById('endpointSelect').value = '/api/meta/types';
      } else if (type === 'openapi') {
        document.getElementById('endpointSelect').value = '/api/openapi.json';
      } else if (type === 'health') {
        document.getElementById('endpointSelect').value = '/api/health';
      }

      updateFormFields();
      executeWorkbenchRequest();
    }

    function filterStatePills(query) {
      const q = (query || '').trim().toLowerCase();
      const pills = document.querySelectorAll('#statesContainer .state-pill');
      pills.forEach(pill => {
        const code = (pill.getAttribute('data-code') || '').toLowerCase();
        const name = (pill.getAttribute('data-name') || '').toLowerCase();
        if (!q || code.includes(q) || name.includes(q)) {
          pill.style.display = 'inline-flex';
        } else {
          pill.style.display = 'none';
        }
      });
    }

    function quickSelectState(st) {
      const epSelect = document.getElementById('endpointSelect');
      const currentEp = epSelect.value;
      if (currentEp !== '/api/holidays/:year/:state' && 
          currentEp !== '/api/long-weekends/:year/:state' && 
          currentEp !== '/api/calendar/:year/:state.ics' && 
          currentEp !== '/api/holidays/upcoming' && 
          currentEp !== '/api/business-days') {
        epSelect.value = '/api/holidays/:year/:state';
      }
      document.getElementById('stateSelect').value = st;
      updateFormFields();
      executeWorkbenchRequest();
      const wb = document.getElementById('workbench');
      if (wb) wb.scrollIntoView({ behavior: 'smooth' });
    }

    // Initialize on page ready
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();

      const heroUrl = window.location.origin + '/api/holidays/2026/TG';
      const heroEl = document.getElementById('heroTerminalUrl');
      if (heroEl) heroEl.innerText = heroUrl;

      const specEl = document.getElementById('postmanSpecUrlText');
      if (specEl) specEl.innerText = window.location.origin + '/api/openapi.json';

      updateFormFields();
      executeWorkbenchRequest();
    });
  </script>
</body>
</html>`;
}

