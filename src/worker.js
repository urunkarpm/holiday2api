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
  if (path === '/' || path === '/api' || path === '/docs' || path === '/documentation') {
    const isDocPath = path === '/docs' || path === '/documentation';
    const isHtmlAccept = acceptHeader.includes('text/html');
    if ((isDocPath || isHtmlAccept) && !url.searchParams.has('json')) {
      return new Response(renderInteractiveHtml(env), {
        headers: {
          ...SECURITY_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
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
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>India Holidays API — Simple, Fast & Free Indian Holiday Documentation</title>
  <meta name="description" content="Simple, developer-friendly REST API for Indian holidays. National & 36 States/UTs, upcoming holidays, long weekend vacation finder, working days calculator, and iCal feeds. No API keys required.">
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
  <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,6..1200,400..800;1,6..1200,400..800&family=Google+Sans+Text:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
  <style>
    :root, [data-theme="light"] {
      --bg: #ffffff;
      --bg-page: #f8fafc;
      --bg-surface: #ffffff;
      --bg-elevated: #f1f5f9;
      --bg-subtle: #e2e8f0;
      --bg-nav: rgba(255, 255, 255, 0.96);
      --bg-sidebar: #fcfcfd;
      --bg-active-pill: #f1f5f9;
      --bg-code: #0f172a;
      --bg-table-row-hover: #f8fafc;
      
      --border-subtle: #e2e8f0;
      --border-strong: #cbd5e1;
      --border-accent: #ea580c;
      
      --ink-primary: #0f172a;
      --ink-secondary: #334155;
      --ink-muted: #64748b;
      --ink-subtle: #94a3b8;
      --ink-inverse: #ffffff;
      
      --accent-saffron: #ea580c;
      --accent-orange: #ea580c;
      --accent-orange-subtle: rgba(234, 88, 12, 0.08);
      --accent-orange-border: rgba(234, 88, 12, 0.25);
      --accent-emerald: #059669;
      --accent-emerald-subtle: rgba(5, 150, 105, 0.08);
      --accent-cyan: #0284c7;
      --accent-purple: #7c3aed;
      --accent-marigold: #d97706;
      
      --font-display: 'Google Sans', 'Google Sans Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      --font-body: 'Google Sans', 'Google Sans Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      --font-mono: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-xl: 16px;
      
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
      --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.05);
      --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.08);
      --shadow-modal: 0 20px 45px rgba(0, 0, 0, 0.14);

      --sidebar-width: 280px;
      --header-height: 60px;
    }

    [data-theme="dark"] {
      --bg: #14171c;
      --bg-page: #101216;
      --bg-surface: #171b21;
      --bg-elevated: #1e232b;
      --bg-subtle: #252b35;
      --bg-nav: rgba(20, 23, 28, 0.94);
      --bg-sidebar: #121418;
      --bg-active-pill: #212731;
      --bg-code: #0b0d11;
      --bg-table-row-hover: #1b2027;
      
      --border-subtle: #262c36;
      --border-strong: #363e4d;
      --border-accent: #f97316;
      
      --ink-primary: #f8fafc;
      --ink-secondary: #cbd5e1;
      --ink-muted: #8896ab;
      --ink-subtle: #576375;
      --ink-inverse: #0f172a;
      
      --accent-saffron: #f97316;
      --accent-orange: #fb923c;
      --accent-orange-subtle: rgba(249, 115, 22, 0.12);
      --accent-orange-border: rgba(249, 115, 22, 0.35);
      --accent-emerald: #10b981;
      --accent-emerald-subtle: rgba(16, 185, 129, 0.12);
      --accent-cyan: #38bdf8;
      --accent-purple: #a78bfa;
      --accent-marigold: #fbbf24;
      
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
      --shadow-md: 0 6px 16px rgba(0, 0, 0, 0.35);
      --shadow-lg: 0 16px 36px rgba(0, 0, 0, 0.5);
      --shadow-modal: 0 25px 60px rgba(0, 0, 0, 0.7);
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
      background-color: var(--bg-page);
      color: var(--ink-primary);
      font-family: var(--font-body);
      font-size: 14.5px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      transition: background-color 0.18s ease, color 0.18s ease;
    }

    /* Scrollbars */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: var(--border-strong);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--ink-muted);
    }

    /* Links */
    a {
      color: inherit;
      text-decoration: none;
    }

    /* Top Fixed Header */
    .docs-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      z-index: 100;
      height: var(--header-height);
      background: var(--bg-nav);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2rem;
      transition: background 0.18s ease, border-color 0.18s ease;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .brand-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 800;
      font-size: 1.15rem;
      letter-spacing: -0.02em;
      color: var(--ink-primary);
      text-decoration: none;
    }

    .brand-logo-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      flex-shrink: 0;
      overflow: hidden;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: #ffffff;
    }

    .brand-logo-circle svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .brand-text {
      font-family: var(--font-display);
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: 0.01em;
      color: var(--ink-primary);
      white-space: nowrap;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }

    .free-pill {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: var(--accent-emerald-subtle);
      color: var(--accent-emerald);
      border: 1px solid rgba(5, 150, 105, 0.2);
    }

    .btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--ink-secondary);
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: all 0.15s ease;
    }

    .btn-icon:hover {
      background: var(--bg-elevated);
      color: var(--ink-primary);
      border-color: var(--border-strong);
    }

    .mobile-nav-toggle {
      display: none;
    }

    /* 2-Column Docs Layout */
    .docs-container {
      display: flex;
      max-width: 1440px;
      margin: 0 auto;
      padding-top: var(--header-height);
      min-height: 100vh;
    }

    /* Left Sidebar Navigation */
    .docs-sidebar {
      width: var(--sidebar-width);
      position: fixed;
      top: var(--header-height);
      left: 0;
      bottom: 0;
      height: calc(100vh - var(--header-height));
      overflow-y: auto;
      padding: 1.5rem 1.15rem 3rem 1.25rem;
      background: var(--bg-sidebar);
      border-right: 1px solid var(--border-subtle);
      z-index: 40;
      transition: background 0.18s ease, border-color 0.18s ease;
    }

    .nav-group {
      margin-bottom: 1.6rem;
    }

    .nav-group-title {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--ink-muted);
      padding: 0 0.75rem;
      margin-bottom: 0.45rem;
    }

    .nav-list {
      list-style: none;
    }

    .nav-item {
      margin-bottom: 2px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.45rem 0.75rem;
      font-size: 0.86rem;
      font-weight: 500;
      color: var(--ink-secondary);
      border-radius: var(--radius-sm);
      position: relative;
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .nav-link:hover {
      color: var(--ink-primary);
      background: var(--bg-elevated);
    }

    .nav-link.active {
      color: var(--ink-primary);
      font-weight: 600;
      background: var(--bg-active-pill);
    }

    .nav-link.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 15%;
      bottom: 15%;
      width: 3px;
      border-radius: 2px;
      background: var(--accent-orange);
    }

    .nav-badge-mini {
      font-family: var(--font-mono);
      font-size: 0.68rem;
      font-weight: 600;
      padding: 0.08rem 0.35rem;
      border-radius: 4px;
      background: var(--bg-elevated);
      color: var(--ink-muted);
    }

    .nav-badge-mini.get {
      color: var(--accent-cyan);
      background: rgba(2, 132, 199, 0.12);
    }

    /* Main Content Area */
    .docs-main {
      flex: 1;
      min-width: 0;
      margin-left: var(--sidebar-width);
      padding: 2.5rem 3.5rem 5rem 3.5rem;
      background: var(--bg);
      transition: background 0.18s ease;
    }

    .docs-content {
      max-width: 900px;
      margin: 0 auto;
    }

    .docs-section {
      margin-bottom: 3.5rem;
      scroll-margin-top: 5rem;
    }

    .section-divider {
      height: 1px;
      background: var(--border-subtle);
      margin: 2.5rem 0;
    }

    .docs-h1 {
      font-size: 2.15rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--ink-primary);
      margin-bottom: 0.85rem;
      line-height: 1.25;
    }

    .docs-h2 {
      font-size: 1.45rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--ink-primary);
      margin-top: 1.5rem;
      margin-bottom: 0.85rem;
      line-height: 1.35;
      scroll-margin-top: 5rem;
    }

    .docs-h3 {
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--ink-primary);
      margin-top: 1.25rem;
      margin-bottom: 0.65rem;
    }

    .docs-lead {
      font-size: 1.05rem;
      line-height: 1.7;
      color: var(--ink-secondary);
      margin-bottom: 1.25rem;
    }

    .docs-p {
      font-size: 0.95rem;
      line-height: 1.7;
      color: var(--ink-secondary);
      margin-bottom: 1.15rem;
    }

    .inline-code {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      font-weight: 500;
      padding: 0.15rem 0.42rem;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      color: var(--ink-primary);
    }

    /* Hero Quick Highlight Cards */
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin: 1.5rem 0 2rem 0;
    }

    .feature-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 1.15rem;
      box-shadow: var(--shadow-sm);
      transition: all 0.15s ease;
    }

    .feature-card:hover {
      border-color: var(--border-strong);
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .feature-icon {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      display: block;
    }

    .feature-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--ink-primary);
      margin-bottom: 0.35rem;
    }

    .feature-desc {
      font-size: 0.84rem;
      color: var(--ink-muted);
      line-height: 1.5;
    }

    /* Recipe / Cheat Sheet Grid */
    .recipe-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
      margin: 1.25rem 0 2rem 0;
    }

    .recipe-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 1rem 1.15rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.75rem;
      transition: all 0.15s ease;
    }

    .recipe-card:hover {
      border-color: var(--accent-orange-border);
      box-shadow: var(--shadow-md);
    }

    .recipe-label {
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--ink-primary);
    }

    .recipe-url {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      padding: 0.45rem 0.65rem;
      background: var(--bg-elevated);
      border-radius: var(--radius-sm);
      color: var(--accent-orange);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .recipe-url a {
      color: inherit;
      flex: 1 1 auto;
      min-width: 0;
      word-break: break-all;
    }

    .recipe-url a:hover {
      text-decoration: underline;
    }

    /* Structured Parameter Tables */
    .doc-table-container {
      width: 100%;
      margin: 1.15rem 0 1.75rem 0;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      overflow-x: auto;
      box-shadow: var(--shadow-sm);
      background: var(--bg-surface);
    }

    .doc-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.88rem;
      display: table;
    }

    .doc-table th {
      background: var(--bg-elevated);
      color: var(--ink-muted);
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-subtle);
    }

    .doc-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--ink-secondary);
      vertical-align: top;
      line-height: 1.55;
    }

    .doc-table tr:last-child td {
      border-bottom: none;
    }

    .entity-code {
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: 0.84rem;
      color: var(--accent-orange);
    }

    /* Endpoint Header Card */
    .endpoint-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      margin: 1.5rem 0 2rem 0;
      box-shadow: var(--shadow-sm);
      scroll-margin-top: 5rem;
    }

    .endpoint-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 0.92rem;
      font-weight: 600;
      padding: 0.65rem 0.95rem;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      margin-bottom: 1rem;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .endpoint-url-group {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex: 1 1 auto;
      min-width: 0;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .http-method {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.18rem 0.45rem;
      border-radius: var(--radius-sm);
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .http-method.get {
      background: rgba(2, 132, 199, 0.15);
      color: var(--accent-cyan);
    }

    .endpoint-path {
      color: var(--ink-primary);
      white-space: nowrap;
    }

    .btn-test-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      font-size: 0.76rem;
      font-family: var(--font-body);
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      background: var(--accent-orange-subtle);
      color: var(--accent-orange);
      border: 1px solid var(--accent-orange-border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .btn-test-action:hover {
      background: var(--accent-orange);
      color: #ffffff;
    }

    /* Code Snippet Box with Tabs */
    .code-box {
      background: var(--bg-code);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
      margin: 1.15rem 0;
      box-shadow: var(--shadow-md);
    }

    .code-box-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.95rem;
      background: rgba(255, 255, 255, 0.04);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .code-tabs {
      display: flex;
      gap: 0.35rem;
    }

    .code-tab {
      padding: 0.3rem 0.65rem;
      font-size: 0.76rem;
      font-family: var(--font-mono);
      font-weight: 600;
      border-radius: var(--radius-sm);
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .code-tab:hover {
      color: #ffffff;
    }

    .code-tab.active {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.12);
    }

    .btn-copy {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.72rem;
      font-family: var(--font-mono);
      padding: 0.22rem 0.55rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--radius-sm);
      color: #cbd5e1;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-copy:hover {
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
    }

    .code-content {
      padding: 1rem 1.15rem;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      line-height: 1.6;
      color: #e2e8f0;
      white-space: pre;
    }

    /* Interactive API Workbench / Tester */
    .workbench-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      margin: 1.5rem 0;
      box-shadow: var(--shadow-sm);
    }

    .wb-controls {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .form-label {
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--ink-muted);
    }

    .form-select, .form-input {
      width: 100%;
      height: 38px;
      padding: 0 0.75rem;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--ink-primary);
      font-family: inherit;
      font-size: 0.88rem;
      outline: none;
      transition: all 0.15s ease;
    }

    .form-select:focus, .form-input:focus {
      border-color: var(--accent-orange);
      box-shadow: 0 0 0 2px var(--accent-orange-subtle);
      background: var(--bg-surface);
    }

    .btn-send {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 40px;
      padding: 0 1.5rem;
      background: var(--accent-orange);
      color: #ffffff;
      border: none;
      border-radius: var(--radius-md);
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(234, 88, 12, 0.35);
      transition: all 0.15s ease;
    }

    .btn-send:hover {
      background: #c2410c;
      transform: translateY(-1px);
    }

    .btn-send:active {
      transform: translateY(0);
    }

    .wb-response-area {
      margin-top: 1.35rem;
      border-top: 1px solid var(--border-subtle);
      padding-top: 1.25rem;
    }

    .response-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .response-status-badge {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
      background: var(--accent-emerald-subtle);
      color: var(--accent-emerald);
      border: 1px solid rgba(5, 150, 105, 0.2);
    }

    .response-url-bar {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--ink-muted);
      background: var(--bg-elevated);
      padding: 0.25rem 0.6rem;
      border-radius: var(--radius-sm);
    }

    /* KPI Summary Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .kpi-card {
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.85rem;
      text-align: center;
    }

    .kpi-val {
      font-family: var(--font-mono);
      font-size: 1.45rem;
      font-weight: 800;
      color: var(--accent-orange);
      line-height: 1.2;
    }

    .kpi-label {
      font-size: 0.74rem;
      color: var(--ink-muted);
      margin-top: 0.25rem;
      font-weight: 500;
    }

    /* States Filter Pills */
    .states-filter-bar {
      margin-bottom: 1.15rem;
    }

    .states-pills-container {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-top: 0.75rem;
    }

    .state-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.65rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      color: var(--ink-secondary);
      cursor: pointer;
      transition: all 0.12s ease;
    }

    .state-pill:hover {
      background: var(--bg-active-pill);
      color: var(--accent-orange);
      border-color: var(--accent-orange-border);
      transform: translateY(-1px);
    }

    .state-code {
      font-family: var(--font-mono);
      font-weight: 700;
      color: var(--accent-orange);
    }

    /* Dark / Light Mode Toggle Button Styling */
    #themeToggleBtn #themeIconSun {
      display: none;
    }
    #themeToggleBtn #themeIconMoon {
      display: block;
    }
    [data-theme="dark"] #themeToggleBtn #themeIconSun {
      display: block !important;
    }
    [data-theme="dark"] #themeToggleBtn #themeIconMoon {
      display: none !important;
    }

    /* Mobile Off-Canvas Navigation Drawer Backdrop */
    .mobile-nav-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 150;
      display: none;
      opacity: 0;
      transition: opacity 0.22s ease;
    }
    .mobile-nav-backdrop.open {
      display: block;
      opacity: 1;
    }

    /* Media Queries & Resizable Viewport Breakpoints */
    @media (max-width: 992px) {
      .docs-main {
        padding: 2rem 2rem 4rem 2rem;
      }
      .feature-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 820px) {
      .header-left {
        width: auto;
      }
      .docs-sidebar {
        position: fixed;
        left: -320px;
        top: 0;
        bottom: 0;
        height: 100vh;
        z-index: 200;
        width: min(300px, 82vw);
        background: var(--bg-surface);
        box-shadow: var(--shadow-lg);
        transition: left 0.24s cubic-bezier(0.16, 1, 0.3, 1);
        padding-top: 1.25rem;
        padding-bottom: 3rem;
        -webkit-overflow-scrolling: touch;
      }
      .docs-sidebar.open {
        left: 0;
      }
      .mobile-nav-toggle {
        display: inline-flex;
      }
      .docs-main {
        margin-left: 0;
        padding: 1.75rem 1.25rem 4rem 1.25rem;
        width: 100%;
      }
      .docs-h1 {
        font-size: 1.75rem;
      }
    }

    @media (max-width: 768px) {
      .endpoint-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 0.65rem;
        padding: 0.75rem 0.85rem;
      }
      .endpoint-url-group {
        width: 100%;
        overflow-x: auto;
      }
      .btn-test-action {
        width: 100%;
        padding: 0.45rem 0.85rem;
        font-size: 0.82rem;
      }
      .doc-table-container {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .doc-table {
        display: block;
        min-width: 520px;
      }
      .wb-controls {
        grid-template-columns: 1fr;
      }
      .recipe-grid {
        grid-template-columns: 1fr;
      }
      .response-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
      .response-url-bar {
        width: 100%;
        word-break: break-all;
      }
    }

    @media (max-width: 480px) {
      .docs-header {
        padding: 0 0.75rem;
      }
      .brand-text {
        font-size: 0.92rem;
      }
      .brand-link {
        gap: 0.5rem;
      }
      .brand-logo-circle {
        width: 28px;
        height: 28px;
      }
      .btn-icon {
        width: 34px;
        height: 34px;
      }
      .free-pill {
        display: none;
      }
      .docs-main {
        padding: 1.25rem 0.85rem 3.5rem 0.85rem;
      }
      .docs-h1 {
        font-size: 1.45rem;
      }
      .docs-h2 {
        font-size: 1.18rem;
      }
      .feature-card, .endpoint-card, .workbench-card {
        padding: 1rem;
      }
      .kpi-grid {
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
      }
      .kpi-val {
        font-size: 1.25rem;
      }
      .states-pills-container {
        gap: 0.35rem;
      }
      .state-pill {
        padding: 0.3rem 0.5rem;
        font-size: 0.76rem;
      }
    }
  </style>
</head>
<body>

  <div id="mobileNavBackdrop" class="mobile-nav-backdrop" onclick="toggleMobileNav(false)"></div>

  <header class="docs-header">
    <div class="header-left">
      <button class="btn-icon mobile-nav-toggle" onclick="toggleMobileNav()" aria-label="Toggle navigation">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
      <a href="/" class="brand-link" aria-label="India Holidays API Home">
        <span class="brand-logo-circle">
          ${FAVICON_SVG}
        </span>
        <span class="brand-text">India Holidays API</span>
      </a>
    </div>

    <div class="header-right">
      <span class="free-pill">100% Free • No API Key</span>
      <button id="themeToggleBtn" class="btn-icon" onclick="toggleTheme()" aria-label="Toggle dark/light theme" title="Toggle dark/light mode">
        <svg id="themeIconSun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        <svg id="themeIconMoon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      </button>
      <a href="https://github.com/urunkarpm/holiday2api" target="_blank" rel="noopener noreferrer" class="btn-icon" title="View GitHub Repository" aria-label="GitHub">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
      </a>
    </div>
  </header>

  <div class="docs-container">

    <aside id="docsSidebar" class="docs-sidebar">
      <div class="nav-group">
        <div class="nav-group-title">Getting Started</div>
        <ul class="nav-list">
          <li class="nav-item"><a href="#intro" class="nav-link active" onclick="handleNavClick(this, 'intro')">Quick Start Guide</a></li>
          <li class="nav-item"><a href="#cheat-sheet" class="nav-link" onclick="handleNavClick(this, 'cheat-sheet')">Common Tasks & Recipes</a></li>
          <li class="nav-item"><a href="#holiday-concepts" class="nav-link" onclick="handleNavClick(this, 'holiday-concepts')">Holiday Types Explained</a></li>
        </ul>
      </div>

      <div class="nav-group">
        <div class="nav-group-title">Endpoints Reference</div>
        <ul class="nav-list">
          <li class="nav-item"><a href="#ep-holidays" class="nav-link" onclick="handleNavClick(this, 'ep-holidays')"><span>Get Holidays</span> <span class="nav-badge-mini get">GET</span></a></li>
          <li class="nav-item"><a href="#ep-upcoming" class="nav-link" onclick="handleNavClick(this, 'ep-upcoming')"><span>Upcoming Holidays</span> <span class="nav-badge-mini get">GET</span></a></li>
          <li class="nav-item"><a href="#ep-weekends" class="nav-link" onclick="handleNavClick(this, 'ep-weekends')"><span>Long Weekend Finder</span> <span class="nav-badge-mini get">GET</span></a></li>
          <li class="nav-item"><a href="#ep-business" class="nav-link" onclick="handleNavClick(this, 'ep-business')"><span>Working Days Calculator</span> <span class="nav-badge-mini get">GET</span></a></li>
          <li class="nav-item"><a href="#ep-calendar" class="nav-link" onclick="handleNavClick(this, 'ep-calendar')"><span>Google/Apple iCal Feed</span> <span class="nav-badge-mini get">GET</span></a></li>
          <li class="nav-item"><a href="#ep-states" class="nav-link" onclick="handleNavClick(this, 'ep-states')"><span>All 36 States & UTs</span> <span class="nav-badge-mini get">GET</span></a></li>
          <li class="nav-item"><a href="#ep-types" class="nav-link" onclick="handleNavClick(this, 'ep-types')"><span>Holiday Classifications</span> <span class="nav-badge-mini get">GET</span></a></li>
          <li class="nav-item"><a href="#ep-health" class="nav-link" onclick="handleNavClick(this, 'ep-health')"><span>Server Health</span> <span class="nav-badge-mini get">GET</span></a></li>
        </ul>
      </div>

      <div class="nav-group">
        <div class="nav-group-title">Developer Tools</div>
        <ul class="nav-list">
          <li class="nav-item"><a href="#workbench-section" class="nav-link" onclick="handleNavClick(this, 'workbench-section')">Live API Workbench</a></li>
          <li class="nav-item"><a href="#states-directory" class="nav-link" onclick="handleNavClick(this, 'states-directory')">State Code Directory</a></li>
          <li class="nav-item"><a href="#postman-openapi" class="nav-link" onclick="handleNavClick(this, 'postman-openapi')">Postman & OpenAPI 3.0</a></li>
        </ul>
      </div>
    </aside>

    <main class="docs-main">
      <div class="docs-content">

        <section id="intro" class="docs-section">
          <h1 class="docs-h1">India Holidays API</h1>
          <p class="docs-lead">
            The simplest, fastest way to get Indian holiday calendars in your apps. Get national, state, and bank holidays, calculate working days, and find long weekend vacation plans with clean JSON.
          </p>

          <div class="feature-grid">
            <div class="feature-card">
              <span class="feature-icon">⚡</span>
              <div class="feature-title">Zero Setup</div>
              <div class="feature-desc">No API keys, no registration, no rate limits. Simply make a GET request and get data instantly.</div>
            </div>
            <div class="feature-card">
              <span class="feature-icon">🇮🇳</span>
              <div class="feature-title">All 36 States & UTs</div>
              <div class="feature-desc">Complete coverage for 28 States and 8 Union Territories covering 2024 through 2036.</div>
            </div>
            <div class="feature-card">
              <span class="feature-icon">🏖️</span>
              <div class="feature-title">Smart Utilities</div>
              <div class="feature-desc">Includes automated long weekend finder, office working days calculator, and iCal calendar subscriptions.</div>
            </div>
          </div>

          <h2 class="docs-h2">30-Second Quick Start</h2>
          <p class="docs-p">
            Copy and paste this URL into your terminal or browser to get holidays for Telangana (<code class="inline-code">TG</code>) for 2026:
          </p>

          <div class="code-box">
            <div class="code-box-header">
              <div class="code-tabs">
                <button class="code-tab active" onclick="switchSnippetTab(this, 'qs-curl')">cURL</button>
                <button class="code-tab" onclick="switchSnippetTab(this, 'qs-fetch')">JavaScript (Fetch)</button>
                <button class="code-tab" onclick="switchSnippetTab(this, 'qs-python')">Python</button>
              </div>
              <button class="btn-copy" onclick="copySnippet(this)">Copy</button>
            </div>
            <div id="qs-curl" class="code-content">curl https://holiday2api.vercel.app/api/holidays/2026/TG</div>
            <div id="qs-fetch" class="code-content" style="display:none;">// In browser or Node.js 18+
const res = await fetch('https://holiday2api.vercel.app/api/holidays/2026/TG');
const holidays = await res.json();
console.log('Found holidays:', holidays.length);</div>
            <div id="qs-python" class="code-content" style="display:none;">import requests

response = requests.get('https://holiday2api.vercel.app/api/holidays/2026/TG')
holidays = response.json()
print(f"Total holidays: {len(holidays)}")</div>
          </div>

          <p class="docs-p" style="margin-top: 1rem;">
            Here is a sample of what the API returns:
          </p>

          <div class="code-box">
            <div class="code-box-header">
              <span style="font-size: 0.76rem; font-family: var(--font-mono); color: #94a3b8;">Sample JSON Response</span>
              <button class="btn-copy" onclick="copySnippet(this)">Copy JSON</button>
            </div>
            <div class="code-content">[
  {
    "date": "2026-01-26",
    "name": "Republic Day",
    "type": "national",
    "state_code": "IN",
    "description": "Celebrates the adoption of the Constitution of India"
  },
  {
    "date": "2026-03-19",
    "name": "Ugadi / Gudi Padwa",
    "type": "state",
    "state_code": "TG",
    "description": "Telugu and Kannada New Year celebration"
  }
]</div>
          </div>
        </section>

        <div class="section-divider"></div>

        <section id="cheat-sheet" class="docs-section">
          <h1 class="docs-h1">Common Tasks & Recipes</h1>
          <p class="docs-lead">
            Find the exact endpoint you need for your use case:
          </p>

          <div class="recipe-grid">
            <div class="recipe-card">
              <div class="recipe-label">📌 Get all holidays for a state</div>
              <div class="recipe-url">
                <a href="/api/holidays/2026/MH" target="_blank">GET /api/holidays/2026/MH</a>
                <button type="button" class="btn-test-action" style="padding: 0.18rem 0.5rem; font-size: 0.72rem;" onclick="testInWorkbench('/api/holidays/:year/:state', 'MH')">Test</button>
              </div>
            </div>
            <div class="recipe-card">
              <div class="recipe-label">⏳ Show next upcoming holidays from today</div>
              <div class="recipe-url">
                <a href="/api/holidays/upcoming?limit=5" target="_blank">GET /api/holidays/upcoming</a>
                <button type="button" class="btn-test-action" style="padding: 0.18rem 0.5rem; font-size: 0.72rem;" onclick="testInWorkbench('/api/holidays/upcoming', 'IN')">Test</button>
              </div>
            </div>
            <div class="recipe-card">
              <div class="recipe-label">🏖️ Find long weekends for vacation planning</div>
              <div class="recipe-url">
                <a href="/api/long-weekends/2026/KA" target="_blank">GET /api/long-weekends/2026/KA</a>
                <button type="button" class="btn-test-action" style="padding: 0.18rem 0.5rem; font-size: 0.72rem;" onclick="testInWorkbench('/api/long-weekends/:year/:state', 'KA')">Test</button>
              </div>
            </div>
            <div class="recipe-card">
              <div class="recipe-label">📊 Calculate working days between 2 dates</div>
              <div class="recipe-url">
                <a href="/api/business-days?from=2026-03-01&to=2026-03-31&state=MH" target="_blank">GET /api/business-days</a>
                <button type="button" class="btn-test-action" style="padding: 0.18rem 0.5rem; font-size: 0.72rem;" onclick="testInWorkbench('/api/business-days', 'MH')">Test</button>
              </div>
            </div>
            <div class="recipe-card">
              <div class="recipe-label">📅 Add holidays to Google or Apple Calendar</div>
              <div class="recipe-url">
                <a href="/api/calendar/2026/IN.ics" target="_blank">GET /api/calendar/2026/IN.ics</a>
                <button type="button" class="btn-test-action" style="padding: 0.18rem 0.5rem; font-size: 0.72rem;" onclick="testInWorkbench('/api/calendar/:year/:state.ics', 'IN')">Test</button>
              </div>
            </div>
            <div class="recipe-card">
              <div class="recipe-label">🗺️ List all 36 supported States & UTs</div>
              <div class="recipe-url">
                <a href="/api/meta/states" target="_blank">GET /api/meta/states</a>
                <button type="button" class="btn-test-action" style="padding: 0.18rem 0.5rem; font-size: 0.72rem;" onclick="testInWorkbench('/api/meta/states')">Test</button>
              </div>
            </div>
          </div>
        </section>

        <div class="section-divider"></div>

        <section id="holiday-concepts" class="docs-section">
          <h1 class="docs-h1">Holiday Types Explained</h1>
          <p class="docs-p">
            Indian holidays are classified into simple categories so you can filter exactly what your app needs:
          </p>

          <div class="doc-table-container">
            <table class="doc-table">
              <thead>
                <tr>
                  <th style="width: 25%;">Holiday Type</th>
                  <th style="width: 20%;">Type Code</th>
                  <th>Plain English Explanation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>🇮🇳 National Holidays</strong></td>
                  <td><code class="inline-code">national</code></td>
                  <td>Celebrated across all of India (Republic Day, Independence Day, Gandhi Jayanti). Central govt & schools are closed.</td>
                </tr>
                <tr>
                  <td><strong>🏛️ State Holidays</strong></td>
                  <td><code class="inline-code">state</code></td>
                  <td>Regional festival holidays specific to a state (e.g. Pongal in Tamil Nadu, Chhath Puja in Bihar, Onam in Kerala).</td>
                </tr>
                <tr>
                  <td><strong>🏦 Public & Bank Holidays</strong></td>
                  <td><code class="inline-code">public</code> / <code class="inline-code">bank</code></td>
                  <td>Mandatory commercial bank closures under the Negotiable Instruments Act.</td>
                </tr>
                <tr>
                  <td><strong>⭐ Optional / Restricted</strong></td>
                  <td><code class="inline-code">restricted</code></td>
                  <td>Optional festival holidays where employees can choose 2 to 3 days from a list.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="section-divider"></div>

        <section id="api-reference" class="docs-section">
          <h1 class="docs-h1">API Endpoints Reference</h1>
          <p class="docs-lead">
            Detailed guide for every available endpoint, including query parameters, code examples, and response schemas.
          </p>

          <div id="ep-holidays" class="endpoint-card">
            <div class="endpoint-bar">
              <div class="endpoint-url-group">
                <span class="http-method get">GET</span>
                <span class="endpoint-path">/api/holidays/:year/:state</span>
              </div>
              <button type="button" class="btn-test-action" onclick="testInWorkbench('/api/holidays/:year/:state', 'TG')">Test in Workbench</button>
            </div>
            <h2 class="docs-h2" style="margin-top:0;">Get Holidays for a Year and State</h2>
            <p class="docs-p">
              Returns all combined national and state-specific holidays for a given year and state. If state is omitted or set to <code class="inline-code">IN</code>, returns pan-India National holidays.
            </p>

            <h4 class="docs-h3">Parameters</h4>
            <div class="doc-table-container">
              <table class="doc-table">
                <thead>
                  <tr>
                    <th style="width: 20%;">Parameter</th>
                    <th style="width: 15%;">Location</th>
                    <th style="width: 15%;">Type</th>
                    <th>Description & Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span class="entity-code">year</span></td>
                    <td><span class="inline-code">path</span></td>
                    <td>string</td>
                    <td>4-digit year between <strong>2024 and 2036</strong> (e.g. <code class="inline-code">2026</code>).</td>
                  </tr>
                  <tr>
                    <td><span class="entity-code">state</span></td>
                    <td><span class="inline-code">path</span></td>
                    <td>string</td>
                    <td>2-letter state code (e.g. <code class="inline-code">TG</code>, <code class="inline-code">MH</code>, <code class="inline-code">KA</code>, <code class="inline-code">DL</code>, or <code class="inline-code">IN</code> for National).</td>
                  </tr>
                  <tr>
                    <td><span class="entity-code">type</span></td>
                    <td><span class="inline-code">query</span></td>
                    <td>string</td>
                    <td>Optional filter: <code class="inline-code">national</code>, <code class="inline-code">state</code>, <code class="inline-code">public</code>, <code class="inline-code">restricted</code>.</td>
                  </tr>
                  <tr>
                    <td><span class="entity-code">month</span></td>
                    <td><span class="inline-code">query</span></td>
                    <td>string</td>
                    <td>Filter by month number (<code class="inline-code">1</code> to <code class="inline-code">12</code> or <code class="inline-code">01</code> to <code class="inline-code">12</code>).</td>
                  </tr>
                  <tr>
                    <td><span class="entity-code">date</span></td>
                    <td><span class="inline-code">query</span></td>
                    <td>string</td>
                    <td>Filter by exact date in <code class="inline-code">YYYY-MM-DD</code> format (e.g. <code class="inline-code">2026-08-15</code>).</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="code-box">
              <div class="code-box-header">
                <div class="code-tabs">
                  <button class="code-tab active" onclick="switchSnippetTab(this, 'curl-holidays')">cURL</button>
                  <button class="code-tab" onclick="switchSnippetTab(this, 'js-holidays')">JavaScript</button>
                  <button class="code-tab" onclick="switchSnippetTab(this, 'py-holidays')">Python</button>
                </div>
                <button class="btn-copy" onclick="copySnippet(this)">Copy</button>
              </div>
              <div id="curl-holidays" class="code-content">curl https://holiday2api.vercel.app/api/holidays/2026/TG</div>
              <div id="js-holidays" class="code-content" style="display:none;">const res = await fetch('https://holiday2api.vercel.app/api/holidays/2026/TG');
const holidays = await res.json();
console.log(holidays);</div>
              <div id="py-holidays" class="code-content" style="display:none;">import requests

res = requests.get('https://holiday2api.vercel.app/api/holidays/2026/TG')
holidays = res.json()
print(f"Total holidays: {len(holidays)}")</div>
            </div>
          </div>

          <div id="ep-upcoming" class="endpoint-card">
            <div class="endpoint-bar">
              <div class="endpoint-url-group">
                <span class="http-method get">GET</span>
                <span class="endpoint-path">/api/holidays/upcoming</span>
              </div>
              <button type="button" class="btn-test-action" onclick="testInWorkbench('/api/holidays/upcoming', 'MH')">Test in Workbench</button>
            </div>
            <h2 class="docs-h2" style="margin-top:0;">Upcoming Holidays</h2>
            <p class="docs-p">
              Returns the next upcoming holidays starting from the current date in Indian Standard Time (<code class="inline-code">Asia/Kolkata</code>). Perfect for widgets, dashboards, and reminders.
            </p>
            <h4 class="docs-h3">Parameters</h4>
            <div class="doc-table-container">
              <table class="doc-table">
                <thead>
                  <tr>
                    <th style="width: 20%;">Parameter</th>
                    <th style="width: 15%;">Location</th>
                    <th style="width: 15%;">Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span class="entity-code">state</span></td>
                    <td><span class="inline-code">query</span></td>
                    <td>string</td>
                    <td>State code (e.g. <code class="inline-code">MH</code>, <code class="inline-code">KA</code>). Defaults to National (<code class="inline-code">IN</code>).</td>
                  </tr>
                  <tr>
                    <td><span class="entity-code">limit</span></td>
                    <td><span class="inline-code">query</span></td>
                    <td>integer</td>
                    <td>Number of upcoming holidays to return (default: <code class="inline-code">10</code>, max: <code class="inline-code">50</code>).</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="code-box">
              <div class="code-box-header">
                <div class="code-tabs">
                  <button class="code-tab active" onclick="switchSnippetTab(this, 'curl-upcoming')">cURL</button>
                  <button class="code-tab" onclick="switchSnippetTab(this, 'js-upcoming')">JavaScript</button>
                </div>
                <button class="btn-copy" onclick="copySnippet(this)">Copy</button>
              </div>
              <div id="curl-upcoming" class="code-content">curl "https://holiday2api.vercel.app/api/holidays/upcoming?state=MH&limit=5"</div>
              <div id="js-upcoming" class="code-content" style="display:none;">const res = await fetch('https://holiday2api.vercel.app/api/holidays/upcoming?state=MH&limit=5');
const upcoming = await res.json();
console.log(upcoming);</div>
            </div>
          </div>

          <div id="ep-weekends" class="endpoint-card">
            <div class="endpoint-bar">
              <div class="endpoint-url-group">
                <span class="http-method get">GET</span>
                <span class="endpoint-path">/api/long-weekends/:year/:state</span>
              </div>
              <button type="button" class="btn-test-action" onclick="testInWorkbench('/api/long-weekends/:year/:state', 'KA')">Test in Workbench</button>
            </div>
            <h2 class="docs-h2" style="margin-top:0;">Long Weekend Vacation Planner</h2>
            <p class="docs-p">
              Automatically scans the year to find 3-day weekends (Friday/Monday holidays) and 4-day bridge weekends (Thursday/Tuesday holidays where taking 1 leave day gives you a 4-day mini vacation).
            </p>
            <h4 class="docs-h3">Parameters</h4>
            <div class="doc-table-container">
              <table class="doc-table">
                <thead>
                  <tr>
                    <th style="width: 20%;">Parameter</th>
                    <th style="width: 15%;">Location</th>
                    <th style="width: 15%;">Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span class="entity-code">year</span></td>
                    <td><span class="inline-code">path</span></td>
                    <td>string</td>
                    <td>Calendar year (e.g. <code class="inline-code">2026</code>).</td>
                  </tr>
                  <tr>
                    <td><span class="entity-code">state</span></td>
                    <td><span class="inline-code">path</span></td>
                    <td>string</td>
                    <td>2-letter state code (e.g. <code class="inline-code">KA</code>, <code class="inline-code">TG</code>).</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="code-box">
              <div class="code-box-header">
                <span style="font-size: 0.76rem; font-family: var(--font-mono); color: #94a3b8;">Example Request</span>
                <button class="btn-copy" onclick="copySnippet(this)">Copy</button>
              </div>
              <div class="code-content">curl https://holiday2api.vercel.app/api/long-weekends/2026/KA</div>
            </div>
          </div>

          <div id="ep-business" class="endpoint-card">
            <div class="endpoint-bar">
              <div class="endpoint-url-group">
                <span class="http-method get">GET</span>
                <span class="endpoint-path">/api/business-days</span>
              </div>
              <button type="button" class="btn-test-action" onclick="testInWorkbench('/api/business-days', 'MH')">Test in Workbench</button>
            </div>
            <h2 class="docs-h2" style="margin-top:0;">Business & Working Days Calculator</h2>
            <p class="docs-p">
              Calculates the exact number of working days between two dates, excluding weekends and official state holidays. Also supports RBI bank rules (2nd and 4th Saturdays closed).
            </p>
            <h4 class="docs-h3">Parameters</h4>
            <div class="doc-table-container">
              <table class="doc-table">
                <thead>
                  <tr>
                    <th style="width: 22%;">Parameter</th>
                    <th style="width: 15%;">Location</th>
                    <th style="width: 15%;">Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span class="entity-code">from</span> <span style="color:var(--accent-orange); font-size:0.75rem;">(required)</span></td>
                    <td><span class="inline-code">query</span></td>
                    <td>string</td>
                    <td>Start date in <code class="inline-code">YYYY-MM-DD</code> (e.g. <code class="inline-code">2026-03-01</code>).</td>
                  </tr>
                  <tr>
                    <td><span class="entity-code">to</span> <span style="color:var(--accent-orange); font-size:0.75rem;">(required)</span></td>
                    <td><span class="inline-code">query</span></td>
                    <td>string</td>
                    <td>End date in <code class="inline-code">YYYY-MM-DD</code> (e.g. <code class="inline-code">2026-03-31</code>).</td>
                  </tr>
                  <tr>
                    <td><span class="entity-code">state</span></td>
                    <td><span class="inline-code">query</span></td>
                    <td>string</td>
                    <td>State code for regional holidays (defaults to National <code class="inline-code">IN</code>).</td>
                  </tr>
                  <tr>
                    <td><span class="entity-code">bank_rules</span></td>
                    <td><span class="inline-code">query</span></td>
                    <td>boolean</td>
                    <td>Set to <code class="inline-code">true</code> to apply RBI 2nd & 4th Saturday closures.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="code-box">
              <div class="code-box-header">
                <span style="font-size: 0.76rem; font-family: var(--font-mono); color: #94a3b8;">Example Request</span>
                <button class="btn-copy" onclick="copySnippet(this)">Copy</button>
              </div>
              <div class="code-content">curl "https://holiday2api.vercel.app/api/business-days?from=2026-03-01&to=2026-03-31&state=MH&bank_rules=true"</div>
            </div>
          </div>

          <div id="ep-calendar" class="endpoint-card">
            <div class="endpoint-bar">
              <div class="endpoint-url-group">
                <span class="http-method get">GET</span>
                <span class="endpoint-path">/api/calendar/:year/:state.ics</span>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <button type="button" class="btn-test-action" onclick="testInWorkbench('/api/calendar/:year/:state.ics', 'TG')">Test in Workbench</button>
                <a href="/api/calendar/2026/TG.ics" target="_blank" class="btn-test-action" style="background:var(--bg-elevated); color:var(--ink-secondary); border-color:var(--border-subtle);">Download .ics</a>
              </div>
            </div>
            <h2 class="docs-h2" style="margin-top:0;">iCalendar (.ics) Feed Export</h2>
            <p class="docs-p">
              Returns RFC 5545 compliant calendar data that can be imported or subscribed to directly in Google Calendar, Apple Calendar, or Microsoft Outlook.
            </p>
            <div class="code-box">
              <div class="code-box-header">
                <span style="font-size: 0.76rem; font-family: var(--font-mono); color: #94a3b8;">Calendar Subscription Link</span>
                <button class="btn-copy" onclick="copySnippet(this)">Copy URL</button>
              </div>
              <div class="code-content">https://holiday2api.vercel.app/api/calendar/2026/TG.ics</div>
            </div>
          </div>

          <div id="ep-states" class="endpoint-card">
            <div class="endpoint-bar">
              <div class="endpoint-url-group">
                <span class="http-method get">GET</span>
                <span class="endpoint-path">/api/meta/states</span>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <button type="button" class="btn-test-action" onclick="testInWorkbench('/api/meta/states')">Test in Workbench</button>
                <a href="/api/meta/states" target="_blank" class="btn-test-action" style="background:var(--bg-elevated); color:var(--ink-secondary); border-color:var(--border-subtle);">Raw JSON</a>
              </div>
            </div>
            <h2 class="docs-h2" style="margin-top:0;">States & Union Territories List</h2>
            <p class="docs-p">
              Returns all 36 supported Indian States and Union Territories with their 2-letter ISO codes and official names.
            </p>
          </div>

          <div id="ep-types" class="endpoint-card">
            <div class="endpoint-bar">
              <div class="endpoint-url-group">
                <span class="http-method get">GET</span>
                <span class="endpoint-path">/api/meta/types</span>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <button type="button" class="btn-test-action" onclick="testInWorkbench('/api/meta/types')">Test in Workbench</button>
                <a href="/api/meta/types" target="_blank" class="btn-test-action" style="background:var(--bg-elevated); color:var(--ink-secondary); border-color:var(--border-subtle);">Raw JSON</a>
              </div>
            </div>
            <h2 class="docs-h2" style="margin-top:0;">Holiday Classifications</h2>
            <p class="docs-p">
              Returns definitions of all supported holiday classifications (<code class="inline-code">national</code>, <code class="inline-code">state</code>, <code class="inline-code">public</code>, <code class="inline-code">restricted</code>).
            </p>
          </div>

          <div id="ep-health" class="endpoint-card">
            <div class="endpoint-bar">
              <div class="endpoint-url-group">
                <span class="http-method get">GET</span>
                <span class="endpoint-path">/api/health</span>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <button type="button" class="btn-test-action" onclick="testInWorkbench('/api/health')">Test in Workbench</button>
                <a href="/api/health" target="_blank" class="btn-test-action" style="background:var(--bg-elevated); color:var(--ink-secondary); border-color:var(--border-subtle);">Raw JSON</a>
              </div>
            </div>
            <h2 class="docs-h2" style="margin-top:0;">API Health & Uptime Status</h2>
            <p class="docs-p">
              Real-time health check endpoint reporting server status, timezone (<code class="inline-code">Asia/Kolkata</code>), and version.
            </p>
          </div>
        </section>

        <div class="section-divider"></div>

        <section id="workbench-section" class="docs-section">
          <h1 class="docs-h1">Interactive API Workbench</h1>
          <p class="docs-lead">
            Test any API endpoint right in your browser with real-time JSON responses:
          </p>

          <div class="workbench-card" id="workbench">
            <div class="wb-controls">
              <div class="form-group">
                <label class="form-label" for="endpointSelect">Endpoint</label>
                <select id="endpointSelect" class="form-select" onchange="updateFormFields()">
                  <option value="/api/holidays/:year/:state">GET /api/holidays/:year/:state</option>
                  <option value="/api/holidays/upcoming">GET /api/holidays/upcoming</option>
                  <option value="/api/long-weekends/:year/:state">GET /api/long-weekends/:year/:state</option>
                  <option value="/api/business-days">GET /api/business-days</option>
                  <option value="/api/calendar/:year/:state.ics">GET /api/calendar/:year/:state.ics</option>
                  <option value="/api/meta/states">GET /api/meta/states</option>
                  <option value="/api/meta/types">GET /api/meta/types</option>
                  <option value="/api/health">GET /api/health</option>
                </select>
              </div>

              <div class="form-group" id="yearGroup">
                <label class="form-label" for="yearSelect">Year</label>
                <select id="yearSelect" class="form-select">
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026" selected>2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                  <option value="2029">2029</option>
                  <option value="2030">2030</option>
                </select>
              </div>

              <div class="form-group" id="stateGroup">
                <label class="form-label" for="stateSelect">State / UT</label>
                <select id="stateSelect" class="form-select">
                  <option value="IN">National (Pan-India)</option>
                  <option value="AN">Andaman & Nicobar (AN)</option>
                  <option value="AP">Andhra Pradesh (AP)</option>
                  <option value="AR">Arunachal Pradesh (AR)</option>
                  <option value="AS">Assam (AS)</option>
                  <option value="BR">Bihar (BR)</option>
                  <option value="CH">Chandigarh (CH)</option>
                  <option value="CT">Chhattisgarh (CT)</option>
                  <option value="DH">Dadra & Nagar Haveli (DH)</option>
                  <option value="DL">Delhi (DL)</option>
                  <option value="GA">Goa (GA)</option>
                  <option value="GJ">Gujarat (GJ)</option>
                  <option value="HR">Haryana (HR)</option>
                  <option value="HP">Himachal Pradesh (HP)</option>
                  <option value="JK">Jammu & Kashmir (JK)</option>
                  <option value="JH">Jharkhand (JH)</option>
                  <option value="KA">Karnataka (KA)</option>
                  <option value="KL">Kerala (KL)</option>
                  <option value="LA">Ladakh (LA)</option>
                  <option value="LD">Lakshadweep (LD)</option>
                  <option value="MP">Madhya Pradesh (MP)</option>
                  <option value="MH">Maharashtra (MH)</option>
                  <option value="MN">Manipur (MN)</option>
                  <option value="ML">Meghalaya (ML)</option>
                  <option value="MZ">Mizoram (MZ)</option>
                  <option value="NL">Nagaland (NL)</option>
                  <option value="OR">Odisha (OR)</option>
                  <option value="PY">Puducherry (PY)</option>
                  <option value="PB">Punjab (PB)</option>
                  <option value="RJ">Rajasthan (RJ)</option>
                  <option value="SK">Sikkim (SK)</option>
                  <option value="TN">Tamil Nadu (TN)</option>
                  <option value="TG" selected>Telangana (TG)</option>
                  <option value="TR">Tripura (TR)</option>
                  <option value="UP">Uttar Pradesh (UP)</option>
                  <option value="UT">Uttarakhand (UT)</option>
                  <option value="WB">West Bengal (WB)</option>
                </select>
              </div>

              <div class="form-group" id="typeGroup">
                <label class="form-label" for="typeSelect">Type Filter</label>
                <select id="typeSelect" class="form-select">
                  <option value="">All Types</option>
                  <option value="national">National Only</option>
                  <option value="gazetted">Gazetted Only</option>
                  <option value="public">Public / Bank Only</option>
                  <option value="restricted">Restricted / Optional</option>
                </select>
              </div>

              <div class="form-group" id="dateRangeGroup" style="display:none;">
                <label class="form-label">Date Range (From → To)</label>
                <div style="display: flex; gap: 0.5rem;">
                  <input type="date" id="fromDateInput" class="form-input" value="2026-03-01">
                  <input type="date" id="toDateInput" class="form-input" value="2026-03-31">
                </div>
              </div>
            </div>

            <button type="button" class="btn-send" onclick="executeWorkbenchRequest()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span>Send Request</span>
            </button>

            <div class="wb-response-area">
              <div class="response-header">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <span id="responseStatusBadge" class="response-status-badge">200 OK</span>
                  <span id="responseTimeBadge" style="font-size: 0.76rem; font-family: var(--font-mono); color: var(--ink-muted);">⚡ 12ms</span>
                </div>
                <div class="response-url-bar" id="responseUrlBar">/api/holidays/2026/TG</div>
              </div>

              <div id="visualResultsContainer" style="margin-bottom: 1rem;"></div>

              <div class="code-box" style="margin-top: 0.75rem;">
                <div class="code-box-header">
                  <span style="font-size: 0.76rem; font-family: var(--font-mono); color: #94a3b8;">Response Body (JSON)</span>
                  <button class="btn-copy" onclick="copyResponseJson(this)">Copy JSON</button>
                </div>
                <div id="responseJsonContent" class="code-content" style="max-height: 420px; overflow-y: auto;">Loading data...</div>
              </div>
            </div>
          </div>
        </section>

        <div class="section-divider"></div>

        <section id="states-directory" class="docs-section">
          <h1 class="docs-h1">State & UT Code Directory</h1>
          <p class="docs-lead">
            Click any State or Union Territory below to immediately test its holiday calendar:
          </p>

          <div class="states-filter-bar">
            <input type="text" id="stateSearchInput" class="form-input" placeholder="Search state name or code (e.g. Maharashtra, TG, Delhi)..." oninput="filterStatePills(this.value)" style="width: 100%; max-width: 420px;">
          </div>

          <div class="states-pills-container" id="statesContainer">
            <div class="state-pill" data-code="IN" data-name="National Pan-India" onclick="quickSelectState('IN')"><span class="state-code">IN</span><span>National (All-India)</span></div>
            <div class="state-pill" data-code="AN" data-name="Andaman and Nicobar" onclick="quickSelectState('AN')"><span class="state-code">AN</span><span>Andaman & Nicobar</span></div>
            <div class="state-pill" data-code="AP" data-name="Andhra Pradesh" onclick="quickSelectState('AP')"><span class="state-code">AP</span><span>Andhra Pradesh</span></div>
            <div class="state-pill" data-code="AR" data-name="Arunachal Pradesh" onclick="quickSelectState('AR')"><span class="state-code">AR</span><span>Arunachal Pradesh</span></div>
            <div class="state-pill" data-code="AS" data-name="Assam" onclick="quickSelectState('AS')"><span class="state-code">AS</span><span>Assam</span></div>
            <div class="state-pill" data-code="BR" data-name="Bihar" onclick="quickSelectState('BR')"><span class="state-code">BR</span><span>Bihar</span></div>
            <div class="state-pill" data-code="CH" data-name="Chandigarh" onclick="quickSelectState('CH')"><span class="state-code">CH</span><span>Chandigarh</span></div>
            <div class="state-pill" data-code="CT" data-name="Chhattisgarh" onclick="quickSelectState('CT')"><span class="state-code">CT</span><span>Chhattisgarh</span></div>
            <div class="state-pill" data-code="DH" data-name="Dadra and Nagar Haveli" onclick="quickSelectState('DH')"><span class="state-code">DH</span><span>Dadra & Nagar Haveli</span></div>
            <div class="state-pill" data-code="DL" data-name="Delhi" onclick="quickSelectState('DL')"><span class="state-code">DL</span><span>Delhi (NCT)</span></div>
            <div class="state-pill" data-code="GA" data-name="Goa" onclick="quickSelectState('GA')"><span class="state-code">GA</span><span>Goa</span></div>
            <div class="state-pill" data-code="GJ" data-name="Gujarat" onclick="quickSelectState('GJ')"><span class="state-code">GJ</span><span>Gujarat</span></div>
            <div class="state-pill" data-code="HR" data-name="Haryana" onclick="quickSelectState('HR')"><span class="state-code">HR</span><span>Haryana</span></div>
            <div class="state-pill" data-code="HP" data-name="Himachal Pradesh" onclick="quickSelectState('HP')"><span class="state-code">HP</span><span>Himachal Pradesh</span></div>
            <div class="state-pill" data-code="JK" data-name="Jammu and Kashmir" onclick="quickSelectState('JK')"><span class="state-code">JK</span><span>Jammu & Kashmir</span></div>
            <div class="state-pill" data-code="JH" data-name="Jharkhand" onclick="quickSelectState('JH')"><span class="state-code">JH</span><span>Jharkhand</span></div>
            <div class="state-pill" data-code="KA" data-name="Karnataka" onclick="quickSelectState('KA')"><span class="state-code">KA</span><span>Karnataka</span></div>
            <div class="state-pill" data-code="KL" data-name="Kerala" onclick="quickSelectState('KL')"><span class="state-code">KL</span><span>Kerala</span></div>
            <div class="state-pill" data-code="LA" data-name="Ladakh" onclick="quickSelectState('LA')"><span class="state-code">LA</span><span>Ladakh</span></div>
            <div class="state-pill" data-code="LD" data-name="Lakshadweep" onclick="quickSelectState('LD')"><span class="state-code">LD</span><span>Lakshadweep</span></div>
            <div class="state-pill" data-code="MP" data-name="Madhya Pradesh" onclick="quickSelectState('MP')"><span class="state-code">MP</span><span>Madhya Pradesh</span></div>
            <div class="state-pill" data-code="MH" data-name="Maharashtra" onclick="quickSelectState('MH')"><span class="state-code">MH</span><span>Maharashtra</span></div>
            <div class="state-pill" data-code="MN" data-name="Manipur" onclick="quickSelectState('MN')"><span class="state-code">MN</span><span>Manipur</span></div>
            <div class="state-pill" data-code="ML" data-name="Meghalaya" onclick="quickSelectState('ML')"><span class="state-code">ML</span><span>Meghalaya</span></div>
            <div class="state-pill" data-code="MZ" data-name="Mizoram" onclick="quickSelectState('MZ')"><span class="state-code">MZ</span><span>Mizoram</span></div>
            <div class="state-pill" data-code="NL" data-name="Nagaland" onclick="quickSelectState('NL')"><span class="state-code">NL</span><span>Nagaland</span></div>
            <div class="state-pill" data-code="OR" data-name="Odisha" onclick="quickSelectState('OR')"><span class="state-code">OR</span><span>Odisha</span></div>
            <div class="state-pill" data-code="PY" data-name="Puducherry" onclick="quickSelectState('PY')"><span class="state-code">PY</span><span>Puducherry</span></div>
            <div class="state-pill" data-code="PB" data-name="Punjab" onclick="quickSelectState('PB')"><span class="state-code">PB</span><span>Punjab</span></div>
            <div class="state-pill" data-code="RJ" data-name="Rajasthan" onclick="quickSelectState('RJ')"><span class="state-code">RJ</span><span>Rajasthan</span></div>
            <div class="state-pill" data-code="SK" data-name="Sikkim" onclick="quickSelectState('SK')"><span class="state-code">SK</span><span>Sikkim</span></div>
            <div class="state-pill" data-code="TN" data-name="Tamil Nadu" onclick="quickSelectState('TN')"><span class="state-code">TN</span><span>Tamil Nadu</span></div>
            <div class="state-pill" data-code="TG" data-name="Telangana" onclick="quickSelectState('TG')"><span class="state-code">TG</span><span>Telangana</span></div>
            <div class="state-pill" data-code="TR" data-name="Tripura" onclick="quickSelectState('TR')"><span class="state-code">TR</span><span>Tripura</span></div>
            <div class="state-pill" data-code="UP" data-name="Uttar Pradesh" onclick="quickSelectState('UP')"><span class="state-code">UP</span><span>Uttar Pradesh</span></div>
            <div class="state-pill" data-code="UT" data-name="Uttarakhand" onclick="quickSelectState('UT')"><span class="state-code">UT</span><span>Uttarakhand</span></div>
            <div class="state-pill" data-code="WB" data-name="West Bengal" onclick="quickSelectState('WB')"><span class="state-code">WB</span><span>West Bengal</span></div>
          </div>
        </section>

        <div class="section-divider"></div>

        <section id="postman-openapi" class="docs-section">
          <h1 class="docs-h1">OpenAPI Spec & Postman</h1>
          <p class="docs-p">
            Import our standard OpenAPI 3.0 specification directly into Postman, Insomnia, or code generation tools:
          </p>

          <div class="endpoint-card">
            <div class="endpoint-bar">
              <div class="endpoint-url-group">
                <span class="http-method get">GET</span>
                <span class="endpoint-path">/api/openapi.json</span>
              </div>
              <a href="/api/openapi.json" target="_blank" class="btn-test-action">Open Raw JSON</a>
            </div>
            <p class="docs-p">
              Official OpenAPI 3.0.3 specification containing complete schema definitions, parameter documentation, and response structures.
            </p>
          </div>
        </section>

      </div>
    </main>
  </div>

  <script>
    function initTheme() {
      const savedTheme = localStorage.getItem('holiday2api_theme');
      const theme = savedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
    }

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('holiday2api_theme', next); } catch (e) {}
    }

    function toggleMobileNav(forceState) {
      const sidebar = document.getElementById('docsSidebar');
      const backdrop = document.getElementById('mobileNavBackdrop');
      if (!sidebar) return;
      const isOpen = (typeof forceState === 'boolean') ? !forceState : sidebar.classList.contains('open');
      if (isOpen) {
        sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
        document.body.style.overflow = '';
      } else {
        sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('open');
        if (window.innerWidth <= 820) document.body.style.overflow = 'hidden';
      }
    }

    function handleNavClick(el, targetId) {
      document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
      el.classList.add('active');
      toggleMobileNav(false);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') toggleMobileNav(false);
    });

    function switchSnippetTab(btn, targetId) {
      const parent = btn.closest('.code-box');
      if (!parent) return;
      parent.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
      parent.querySelectorAll('.code-content').forEach(c => c.style.display = 'none');
      btn.classList.add('active');
      const target = document.getElementById(targetId);
      if (target) target.style.display = 'block';
    }

    function copySnippet(btn) {
      const parent = btn.closest('.code-box');
      if (!parent) return;
      const activeContent = parent.querySelector('.code-content[style*="display: block"], .code-content:not([style*="display: none"])');
      if (activeContent) {
        navigator.clipboard.writeText(activeContent.innerText).then(() => {
          const orig = btn.innerText;
          btn.innerText = 'Copied!';
          setTimeout(() => btn.innerText = orig, 1800);
        });
      }
    }

    function copyResponseJson(btn) {
      const content = document.getElementById('responseJsonContent');
      if (content) {
        navigator.clipboard.writeText(content.innerText).then(() => {
          const orig = btn.innerText;
          btn.innerText = 'Copied!';
          setTimeout(() => btn.innerText = orig, 1800);
        });
      }
    }

    function initScrollSpy() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            document.querySelectorAll('.nav-link').forEach(link => {
              if (link.getAttribute('href') === '#' + id) {
                link.classList.add('active');
              } else {
                link.classList.remove('active');
              }
            });
          }
        });
      }, { rootMargin: '-10% 0px -75% 0px' });
      document.querySelectorAll('section[id], div[id]').forEach(sec => {
        if (sec.id) observer.observe(sec);
      });
    }

    function updateFormFields() {
      const epSelect = document.getElementById('endpointSelect');
      if (!epSelect) return;
      const ep = epSelect.value;
      const yearGroup = document.getElementById('yearGroup');
      const stateGroup = document.getElementById('stateGroup');
      const typeGroup = document.getElementById('typeGroup');
      const dateRangeGroup = document.getElementById('dateRangeGroup');

      if (yearGroup) yearGroup.style.display = (ep.includes(':year') ? 'flex' : 'none');
      if (stateGroup) stateGroup.style.display = (ep.includes(':state') || ep === '/api/holidays/upcoming' || ep === '/api/business-days' ? 'flex' : 'none');
      if (typeGroup) typeGroup.style.display = (ep === '/api/holidays/:year/:state' ? 'flex' : 'none');
      if (dateRangeGroup) dateRangeGroup.style.display = (ep === '/api/business-days' ? 'flex' : 'none');
    }

    function testInWorkbench(endpoint, state, extra) {
      const epSelect = document.getElementById('endpointSelect');
      if (epSelect && endpoint) {
        epSelect.value = endpoint;
      }
      if (state) {
        const stateSelect = document.getElementById('stateSelect');
        if (stateSelect) stateSelect.value = state;
      }
      if (extra && extra.year) {
        const yearSelect = document.getElementById('yearSelect');
        if (yearSelect) yearSelect.value = extra.year;
      }
      if (extra && extra.type !== undefined) {
        const typeSelect = document.getElementById('typeSelect');
        if (typeSelect) typeSelect.value = extra.type;
      }
      if (extra && extra.from) {
        const fromInput = document.getElementById('fromDateInput');
        if (fromInput) fromInput.value = extra.from;
      }
      if (extra && extra.to) {
        const toInput = document.getElementById('toDateInput');
        if (toInput) toInput.value = extra.to;
      }

      updateFormFields();
      executeWorkbenchRequest();

      const wbSection = document.getElementById('workbench-section');
      if (wbSection) {
        wbSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const card = document.getElementById('workbench');
        if (card) {
          card.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
          card.style.boxShadow = '0 0 0 4px rgba(234, 88, 12, 0.45)';
          card.style.transform = 'translateY(-2px)';
          setTimeout(() => {
            card.style.boxShadow = '';
            card.style.transform = '';
          }, 1200);
        }
      }
    }

    async function executeWorkbenchRequest() {
      const epSelect = document.getElementById('endpointSelect');
      if (!epSelect) return;
      const epTemplate = epSelect.value;
      const year = (document.getElementById('yearSelect')?.value) || '2026';
      const state = (document.getElementById('stateSelect')?.value) || 'IN';
      const type = (document.getElementById('typeSelect')?.value) || '';
      const fromDate = (document.getElementById('fromDateInput')?.value) || '2026-03-01';
      const toDate = (document.getElementById('toDateInput')?.value) || '2026-03-31';

      let targetUrl = epTemplate;

      if (epTemplate === '/api/holidays/:year/:state') {
        targetUrl = '/api/holidays/' + year + '/' + state;
        if (type) targetUrl += '?type=' + encodeURIComponent(type);
      } else if (epTemplate === '/api/long-weekends/:year/:state') {
        targetUrl = '/api/long-weekends/' + year + '/' + state;
      } else if (epTemplate === '/api/calendar/:year/:state.ics') {
        targetUrl = '/api/calendar/' + year + '/' + state + '.ics';
      } else if (epTemplate === '/api/holidays/upcoming') {
        targetUrl = '/api/holidays/upcoming?limit=10';
        if (state && state !== 'IN') targetUrl += '&state=' + encodeURIComponent(state);
      } else if (epTemplate === '/api/business-days') {
        targetUrl = '/api/business-days?from=' + encodeURIComponent(fromDate) + '&to=' + encodeURIComponent(toDate);
        if (state && state !== 'IN') targetUrl += '&state=' + encodeURIComponent(state);
      }

      const urlBar = document.getElementById('responseUrlBar');
      if (urlBar) urlBar.innerText = targetUrl;

      const statusBadge = document.getElementById('responseStatusBadge');
      const timeBadge = document.getElementById('responseTimeBadge');
      const jsonContent = document.getElementById('responseJsonContent');
      const visualContainer = document.getElementById('visualResultsContainer');

      if (jsonContent) jsonContent.innerText = 'Fetching holiday data...';

      const startTime = performance.now();
      try {
        const fetchUrl = (window.location.protocol === 'http:' || window.location.protocol === 'https:') ? targetUrl : ('https://holiday2api.vercel.app' + targetUrl);
        const res = await fetch(fetchUrl);
        const duration = Math.round(performance.now() - startTime);

        if (statusBadge) {
          statusBadge.innerText = res.status + ' ' + res.statusText;
          statusBadge.style.color = res.ok ? 'var(--accent-emerald)' : '#ef4444';
        }
        if (timeBadge) timeBadge.innerText = '⚡ ' + duration + 'ms';

        if (targetUrl.endsWith('.ics')) {
          const text = await res.text();
          if (jsonContent) jsonContent.innerText = text;
          if (visualContainer) visualContainer.innerHTML = '<div class="kpi-card"><div class="kpi-val" style="color: var(--accent-cyan); font-size:1.1rem;">RFC 5545 iCal Feed</div><div class="kpi-label">Ready for Calendar Sync</div></div>';
          return;
        }

        const data = await res.json();
        if (jsonContent) jsonContent.innerText = JSON.stringify(data, null, 2);

        if (visualContainer) {
          let visualHtml = '';
          if (Array.isArray(data)) {
            visualHtml = '<div class="kpi-grid">' +
              '<div class="kpi-card"><div class="kpi-val">' + data.length + '</div><div class="kpi-label">Items Returned</div></div>' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--accent-cyan);">' + (state || 'IN') + '</div><div class="kpi-label">State / Region</div></div>' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--accent-emerald);">' + (year || '2026') + '</div><div class="kpi-label">Year</div></div>' +
            '</div>';
          } else if (Array.isArray(data.holidays)) {
            visualHtml = '<div class="kpi-grid">' +
              '<div class="kpi-card"><div class="kpi-val">' + data.holidays.length + '</div><div class="kpi-label">Total Holidays</div></div>' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--accent-cyan);">' + (data.state_code || state) + '</div><div class="kpi-label">Region Code</div></div>' +
              '<div class="kpi-card"><div class="kpi-val" style="color: var(--accent-emerald);">' + (data.year || year) + '</div><div class="kpi-label">Year</div></div>' +
            '</div>';
          }
          visualContainer.innerHTML = visualHtml;
        }
      } catch (err) {
        if (statusBadge) statusBadge.innerText = 'Error';
        if (jsonContent) jsonContent.innerText = 'Network error: ' + err.message;
      }
    }

    function filterStatePills(query) {
      const q = (query || '').toLowerCase().trim();
      const pills = document.querySelectorAll('#statesContainer .state-pill');
      pills.forEach(pill => {
        const code = (pill.getAttribute('data-code') || '').toLowerCase();
        const name = (pill.getAttribute('data-name') || '').toLowerCase();
        pill.style.display = (!q || code.includes(q) || name.includes(q)) ? 'inline-flex' : 'none';
      });
    }

    function quickSelectState(code) {
      testInWorkbench('/api/holidays/:year/:state', code);
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      initScrollSpy();
      updateFormFields();
      executeWorkbenchRequest();
    });
  </script>
</body>
</html>`;
}

