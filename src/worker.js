// Cloudflare Worker & Universal Edge Router for India Holidays API
// Handles routing, filtering, calendar (.ics), long weekends, business days, OpenAPI spec, and interactive UI

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const acceptHeader = request.headers.get('accept') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: JSON_HEADERS }
      );
    }

    try {
      // 1. Root & Interactive HTML UI / Discovery
      if (path === '/' || path === '/api') {
        if (acceptHeader.includes('text/html') && !url.searchParams.has('json')) {
          return new Response(renderInteractiveHtml(env), {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
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

      // 13. Direct static asset binding fallback
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

      // 14. 404 Handler
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
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message || 'Internal server error' }),
        { status: 500, headers: JSON_HEADERS }
      );
    }
  },
};

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

  const fromDate = new Date(`${fromStr}T00:00:00+05:30`);
  const toDate = new Date(`${toStr}T00:00:00+05:30`);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) {
    return new Response(
      JSON.stringify({ error: 'Invalid date range. "from" must be before or equal to "to" in YYYY-MM-DD format.' }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  // Collect holidays across all years in date range
  const startYear = fromDate.getFullYear();
  const endYear = toDate.getFullYear();
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;500;600;700;800&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400;1,6..72,600&display=swap" rel="stylesheet">
  <style>
    :root {
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
      
      --font-display: 'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-serif: 'Newsreader', Georgia, serif;
      --font-mono: 'IBM Plex Mono', monospace;
      
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --shadow-crisp: 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.25);
      --shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.45);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      color: var(--ink-primary);
      font-family: var(--font-display);
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(249, 115, 22, 0.04) 0%, transparent 60%),
        linear-gradient(to right, rgba(255, 255, 255, 0.015) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
      background-size: 100% 100%, 32px 32px, 32px 32px;
    }

    /* Top Utility Bar */
    .top-nav {
      border-bottom: 1px solid var(--border-subtle);
      background: rgba(14, 16, 19, 0.85);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .top-nav-inner {
      max-width: 1240px;
      margin: 0 auto;
      padding: 0.75rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      text-decoration: none;
      color: var(--ink-primary);
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: -0.02em;
    }
    .brand-flag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: var(--radius-sm);
      background: var(--bg-elevated);
      border: 1px solid var(--border-strong);
      font-size: 0.95rem;
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
      gap: 1.25rem;
    }
    .nav-link {
      color: var(--ink-secondary);
      text-decoration: none;
      font-size: 0.88rem;
      font-weight: 500;
      transition: color 0.15s;
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
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
    }
    .ping-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-emerald);
      box-shadow: 0 0 8px var(--accent-emerald);
    }

    .container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem 4rem;
    }

    /* Hero Section */
    .hero {
      padding: 3rem 0 3.5rem;
      position: relative;
    }
    .meta-stamp {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--accent-saffron);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 1.25rem;
      background: var(--accent-saffron-subtle);
      border: 1px solid rgba(249, 115, 22, 0.25);
      padding: 0.3rem 0.8rem;
      border-radius: var(--radius-sm);
    }
    h1 {
      font-size: clamp(2.4rem, 5vw, 3.8rem);
      font-weight: 800;
      line-height: 1.08;
      letter-spacing: -0.035em;
      margin-bottom: 1.25rem;
      color: #ffffff;
    }
    h1 .serif-accent {
      font-family: var(--font-serif);
      font-weight: 400;
      font-style: italic;
      color: var(--accent-marigold);
      letter-spacing: -0.01em;
    }
    .hero-lead {
      font-size: 1.15rem;
      line-height: 1.65;
      color: var(--ink-secondary);
      max-width: 780px;
      margin-bottom: 2rem;
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
    }
    .terminal-cmd {
      font-family: var(--font-mono);
      font-size: 0.88rem;
      color: var(--accent-cyan);
      overflow-x: auto;
      white-space: nowrap;
      padding-right: 1rem;
    }
    .terminal-cmd span { color: var(--ink-muted); }

    /* Button styles */
    .btn {
      display: inline-flex;
      align-items: center;
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
    }
    .btn-primary {
      background: var(--accent-saffron);
      color: #ffffff;
      border-color: #ea580c;
    }
    .btn-primary:hover {
      background: #f86704;
      transform: translateY(-1px);
    }
    .btn-outline {
      background: var(--bg-surface);
      color: var(--ink-primary);
      border-color: var(--border-strong);
    }
    .btn-outline:hover {
      background: var(--bg-elevated);
      border-color: var(--ink-secondary);
    }
    .btn-sm {
      font-size: 0.78rem;
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
    }
    .btn-icon {
      padding: 0.35rem 0.55rem;
    }

    /* Key Spec Badges Grid */
    .specs-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1px;
      background: var(--border-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      overflow: hidden;
      margin: 1.5rem 0 3.5rem;
    }
    .spec-item {
      background: var(--bg-surface);
      padding: 1.25rem 1.25rem;
    }
    .spec-val {
      font-family: var(--font-display);
      font-size: 1.55rem;
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
    }
    .section-title {
      font-size: 1.45rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .section-desc {
      font-size: 0.88rem;
      color: var(--ink-secondary);
      margin-top: 0.2rem;
    }

    /* Quick Preset Chips */
    .presets-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      overflow-x: auto;
      padding: 0.25rem 0 1.25rem;
      scrollbar-width: none;
    }
    .presets-bar::-webkit-scrollbar { display: none; }
    .preset-label {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--ink-muted);
      white-space: nowrap;
      text-transform: uppercase;
    }
    .preset-chip {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--ink-secondary);
      font-family: var(--font-mono);
      font-size: 0.78rem;
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .preset-chip:hover {
      background: var(--bg-elevated);
      color: var(--ink-primary);
      border-color: var(--border-strong);
    }
    .preset-chip.active {
      background: var(--accent-saffron-subtle);
      color: var(--accent-saffron);
      border-color: rgba(249, 115, 22, 0.4);
    }

    /* Interactive Workbench Layout */
    .workbench {
      display: grid;
      grid-template-columns: 420px 1fr;
      gap: 1.5rem;
      margin-bottom: 3.5rem;
    }
    @media (max-width: 990px) {
      .workbench { grid-template-columns: 1fr; }
    }

    /* Panel & Controls */
    .panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-crisp);
    }
    .panel-header {
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-subtle);
      padding: 0.85rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .panel-header-title {
      font-family: var(--font-mono);
      font-size: 0.82rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ink-primary);
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .panel-body {
      padding: 1.25rem;
    }

    .form-row {
      margin-bottom: 1.15rem;
    }
    .field-label {
      display: block;
      font-family: var(--font-mono);
      font-size: 0.74rem;
      color: var(--ink-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.4rem;
    }
    .control-select, .control-input {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--ink-primary);
      font-family: var(--font-mono);
      font-size: 0.85rem;
      padding: 0.65rem 0.85rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .control-select:focus, .control-input:focus {
      border-color: var(--accent-saffron);
    }
    .grid-duo {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    .checkbox-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      padding: 0.55rem 0.85rem;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      font-family: var(--font-mono);
      color: var(--ink-secondary);
      cursor: pointer;
      width: 100%;
    }
    .checkbox-pill input { accent-color: var(--accent-saffron); }

    .url-preview-bar {
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      padding: 0.6rem 0.85rem;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--accent-cyan);
      overflow-x: auto;
      white-space: nowrap;
      margin-top: 0.25rem;
    }

    /* Response Panel & Dual View Mode */
    .view-toggle-group {
      display: flex;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      padding: 2px;
      gap: 2px;
    }
    .view-toggle-btn {
      background: transparent;
      border: none;
      color: var(--ink-secondary);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      padding: 0.25rem 0.65rem;
      border-radius: 2px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .view-toggle-btn.active {
      background: var(--bg-subtle);
      color: var(--ink-primary);
      font-weight: 600;
    }

    /* Visual Holiday Cards Grid */
    .visual-cards-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 0.85rem;
      max-height: 520px;
      overflow-y: auto;
      padding-right: 0.35rem;
    }
    .holiday-card {
      background: var(--bg);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.9rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: border-color 0.15s, transform 0.15s;
      position: relative;
    }
    .holiday-card:hover {
      border-color: var(--border-strong);
      transform: translateY(-1px);
    }
    .holiday-date-strip {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 0.45rem;
    }
    .holiday-day-num {
      font-size: 1.25rem;
      font-weight: 800;
      color: #ffffff;
      font-family: var(--font-display);
    }
    .holiday-month-name {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--accent-saffron);
      text-transform: uppercase;
      font-weight: 600;
    }
    .holiday-weekday {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--ink-muted);
    }
    .holiday-name {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--ink-primary);
      line-height: 1.35;
      margin-bottom: 0.65rem;
    }
    .holiday-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .tag-badge {
      font-family: var(--font-mono);
      font-size: 0.68rem;
      padding: 0.15rem 0.45rem;
      border-radius: var(--radius-sm);
      background: var(--bg-subtle);
      color: var(--ink-secondary);
      border: 1px solid var(--border-subtle);
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

    /* Long weekend specific card */
    .lw-card {
      background: var(--bg);
      border: 1px solid rgba(249, 115, 22, 0.25);
      border-left: 3px solid var(--accent-saffron);
      border-radius: var(--radius-md);
      padding: 1rem;
      margin-bottom: 0.75rem;
    }
    .lw-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--ink-primary);
      margin-bottom: 0.35rem;
    }
    .lw-meta {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--accent-marigold);
      margin-bottom: 0.5rem;
    }
    .lw-advice {
      font-size: 0.85rem;
      color: var(--ink-secondary);
      line-height: 1.45;
    }

    /* Raw Code Box */
    .raw-code-box {
      background: var(--bg);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      line-height: 1.5;
      color: #cbd5e1;
      max-height: 520px;
      overflow: auto;
      white-space: pre;
    }

    /* Code Snippets Bar */
    .snippets-container {
      margin-top: 1.25rem;
      border-top: 1px solid var(--border-subtle);
      padding-top: 1.25rem;
    }
    .snippet-tabs {
      display: flex;
      gap: 0.4rem;
      margin-bottom: 0.65rem;
    }
    .snippet-tab {
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      color: var(--ink-secondary);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      padding: 0.3rem 0.7rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
    }
    .snippet-tab.active {
      background: var(--bg-subtle);
      color: var(--accent-cyan);
      border-color: var(--border-strong);
    }
    .snippet-display {
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      padding: 0.75rem 0.9rem;
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--ink-primary);
      position: relative;
      overflow-x: auto;
      white-space: pre;
    }
    .snippet-copy-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
    }

    /* Feature Grid (Editorial Style) */
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
      margin: 2.5rem 0 4rem;
    }
    .feature-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1.75rem;
      position: relative;
    }
    .feature-num {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--accent-saffron);
      margin-bottom: 0.75rem;
      display: block;
    }
    .feature-title {
      font-size: 1.2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.6rem;
      color: #ffffff;
    }
    .feature-desc {
      font-size: 0.9rem;
      color: var(--ink-secondary);
      line-height: 1.55;
    }

    /* Postman Section */
    .postman-section {
      background: linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-lg);
      padding: 2rem;
      margin: 3rem 0;
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 2rem;
      align-items: center;
    }
    @media (max-width: 860px) {
      .postman-section { grid-template-columns: 1fr; }
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
    }
    .postman-heading {
      font-size: 1.5rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 0.65rem;
      letter-spacing: -0.02em;
    }
    .postman-text {
      font-size: 0.92rem;
      color: var(--ink-secondary);
      line-height: 1.55;
      margin-bottom: 1.25rem;
    }
    .postman-box {
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      padding: 1.25rem;
    }
    .step-list {
      list-style: none;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--ink-secondary);
    }
    .step-list li {
      margin-bottom: 0.65rem;
      display: flex;
      gap: 0.6rem;
    }
    .step-list li strong { color: var(--ink-primary); }
    .step-num {
      color: var(--accent-saffron);
      font-weight: 700;
    }

    /* States Directory Filter */
    .states-filter-bar {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
    }
    .state-pill {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      padding: 0.35rem 0.7rem;
      border-radius: var(--radius-sm);
      color: var(--ink-secondary);
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.15s;
    }
    .state-pill:hover {
      background: var(--bg-elevated);
      color: var(--ink-primary);
      border-color: var(--border-strong);
    }
    .state-pill span {
      color: var(--accent-saffron);
      font-weight: 600;
    }

    /* Documentation Table */
    .doc-table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      background: var(--bg-surface);
      margin-top: 1.5rem;
    }
    .doc-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.88rem;
    }
    .doc-table th {
      background: var(--bg-elevated);
      padding: 0.85rem 1.15rem;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ink-muted);
      border-bottom: 1px solid var(--border-subtle);
    }
    .doc-table td {
      padding: 1rem 1.15rem;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--ink-secondary);
      vertical-align: middle;
    }
    .doc-table tr:last-child td { border-bottom: none; }
    .doc-table tr:hover td { background: var(--bg-elevated); }
    .method-get {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--accent-emerald);
      background: var(--accent-emerald-subtle);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 0.15rem 0.45rem;
      border-radius: var(--radius-sm);
      display: inline-block;
    }
    .endpoint-code {
      font-family: var(--font-mono);
      color: var(--ink-primary);
      font-weight: 500;
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
    }
    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }

    /* Human-crafted Footer */
    footer {
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      padding: 3.5rem 1.5rem;
      margin-top: 5rem;
    }
    .footer-inner {
      max-width: 1240px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 2rem;
    }
    .footer-col-main {
      max-width: 440px;
    }
    .footer-brand {
      font-size: 1.1rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.65rem;
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
      font-size: 0.75rem;
      color: var(--ink-muted);
      flex-wrap: wrap;
      gap: 1rem;
    }
  </style>
</head>
<body>

  <!-- Top Navigation -->
  <nav class="top-nav">
    <div class="top-nav-inner">
      <a href="/" class="brand">
        <span class="brand-flag">🇮🇳</span>
        <span>India Holidays API</span>
        <span class="version-tag">v1.0</span>
      </a>
      <div class="nav-links">
        <a href="#workbench" class="nav-link">Sandbox</a>
        <a href="#postman" class="nav-link">Postman Spec</a>
        <a href="#states" class="nav-link">36 States</a>
        <a href="#docs" class="nav-link">Endpoints</a>
        <div class="status-indicator">
          <span class="ping-dot"></span>
          <span>Global Edge Live</span>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    
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
          <span>$ </span>curl <span id="heroTerminalUrl">https://your-domain.com/api/holidays/2026/TG</span>
        </div>
        <button class="btn btn-sm btn-outline" onclick="copyHeroCurl()">
          📋 Copy cURL
        </button>
      </div>

      <div style="display: flex; gap: 0.85rem; flex-wrap: wrap;">
        <a href="#workbench" class="btn btn-primary">⚡ Test Live in Workbench</a>
        <a href="#postman" class="btn btn-outline">🚀 Import to Postman</a>
        <a href="https://github.com/urunkarpm/holiday2api" target="_blank" class="btn btn-outline">⭐ GitHub Repository</a>
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
        <button class="preset-chip active" onclick="applyPreset('tg-2026')">Telangana 2026</button>
        <button class="preset-chip" onclick="applyPreset('mh-lw')">Maharashtra Long Weekends</button>
        <button class="preset-chip" onclick="applyPreset('upcoming')">Upcoming 5 Holidays</button>
        <button class="preset-chip" onclick="applyPreset('rbi-working')">Q1 RBI Working Days</button>
        <button class="preset-chip" onclick="applyPreset('national-2026')">All-India National 2026</button>
        <button class="preset-chip" onclick="applyPreset('ics-feed')">Apple/Google .ICS Feed</button>
        <button class="preset-chip" onclick="applyPreset('meta-states')">36 States Directory</button>
      </div>

      <!-- The Workbench Grid -->
      <div class="workbench">
        <!-- Controls Column -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-header-title">⚙️ Request Configuration</span>
            <span class="version-tag" id="methodBadge">GET</span>
          </div>
          <div class="panel-body">
            
            <div class="form-row">
              <label class="field-label">Target Endpoint</label>
              <select id="endpointSelect" class="control-select" onchange="updateFormFields()">
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
                <label class="field-label">Year (2024–2036)</label>
                <select id="yearSelect" class="control-select" onchange="updateFormFields()">
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
                <label class="field-label">State / UT (36 Regions)</label>
                <select id="stateSelect" class="control-select" onchange="updateFormFields()">
                  <option value="TG" selected>TG — Telangana</option>
                  <option value="IN">IN — National (All India)</option>
                  <option value="MH">MH — Maharashtra</option>
                  <option value="KA">KA — Karnataka</option>
                  <option value="DL">DL — Delhi NCR</option>
                  <option value="TN">TN — Tamil Nadu</option>
                  <option value="WB">WB — West Bengal</option>
                  <option value="KL">KL — Kerala</option>
                  <option value="GJ">GJ — Gujarat</option>
                  <option value="UP">UP — Uttar Pradesh</option>
                  <option value="AP">AP — Andhra Pradesh</option>
                  <option value="AR">AR — Arunachal Pradesh</option>
                  <option value="AS">AS — Assam</option>
                  <option value="BR">BR — Bihar</option>
                  <option value="CH">CH — Chandigarh</option>
                  <option value="CT">CT — Chhattisgarh</option>
                  <option value="DN">DN — Dadra & Nagar Haveli / Daman & Diu</option>
                  <option value="GA">GA — Goa</option>
                  <option value="HR">HR — Haryana</option>
                  <option value="HP">HP — Himachal Pradesh</option>
                  <option value="JK">JK — Jammu and Kashmir</option>
                  <option value="JH">JH — Jharkhand</option>
                  <option value="LA">LA — Ladakh</option>
                  <option value="LD">LD — Lakshadweep</option>
                  <option value="MP">MP — Madhya Pradesh</option>
                  <option value="MN">MN — Manipur</option>
                  <option value="ML">ML — Meghalaya</option>
                  <option value="MZ">MZ — Mizoram</option>
                  <option value="NL">NL — Nagaland</option>
                  <option value="OR">OR — Odisha</option>
                  <option value="PY">PY — Puducherry</option>
                  <option value="PB">PB — Punjab</option>
                  <option value="RJ">RJ — Rajasthan</option>
                  <option value="SK">SK — Sikkim</option>
                  <option value="TR">TR — Tripura</option>
                  <option value="UT">UT — Uttarakhand</option>
                </select>
              </div>
            </div>

            <!-- Date Range Controls for Business Days -->
            <div id="dateRangeGroup" style="display: none;" class="form-row">
              <div class="grid-duo" style="margin-bottom: 0.75rem;">
                <div>
                  <label class="field-label">From Date</label>
                  <input type="date" id="fromDateInput" class="control-input" value="2026-03-01" onchange="updateFormFields()">
                </div>
                <div>
                  <label class="field-label">To Date</label>
                  <input type="date" id="toDateInput" class="control-input" value="2026-03-31" onchange="updateFormFields()">
                </div>
              </div>
              <label class="checkbox-pill">
                <input type="checkbox" id="bankRulesCheckbox" onchange="updateFormFields()">
                <span>Apply RBI Bank Rules (2nd & 4th Sat Off)</span>
              </label>
            </div>

            <div class="form-row">
              <label class="field-label">Calculated Request Path</label>
              <div id="urlPreviewDisplay" class="url-preview-bar">/api/holidays/2026/TG</div>
            </div>

            <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="executeWorkbenchRequest()">
              ⚡ Send API Request
            </button>

            <!-- Code Snippet Generator Tabs -->
            <div class="snippets-container">
              <label class="field-label">Integration Snippet</label>
              <div class="snippet-tabs">
                <button class="snippet-tab active" onclick="switchSnippetTab('curl')">cURL</button>
                <button class="snippet-tab" onclick="switchSnippetTab('js')">JS Fetch</button>
                <button class="snippet-tab" onclick="switchSnippetTab('python')">Python</button>
                <button class="snippet-tab" onclick="switchSnippetTab('go')">Go</button>
              </div>
              <div class="snippet-display" id="snippetDisplayArea">
                <code id="snippetCode">curl https://holiday2api.vercel.app/api/holidays/2026/TG</code>
                <button class="btn btn-sm btn-outline snippet-copy-btn" onclick="copyCurrentSnippet()">Copy</button>
              </div>
            </div>

          </div>
        </div>

        <!-- Response Viewer Column -->
        <div class="panel">
          <div class="panel-header">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span class="panel-header-title">📦 Payload Inspector</span>
              <span id="responseStatusBadge" class="status-indicator">200 OK</span>
              <span id="responseTimeBadge" style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--ink-muted);">-- ms</span>
            </div>

            <!-- View Switcher -->
            <div class="view-toggle-group">
              <button id="btnViewVisual" class="view-toggle-btn active" onclick="setViewMode('visual')">✦ Visual Cards</button>
              <button id="btnViewRaw" class="view-toggle-btn" onclick="setViewMode('raw')">{ } Raw JSON</button>
            </div>
          </div>
          <div class="panel-body">
            
            <!-- Visual Container -->
            <div id="visualDisplayArea" class="visual-cards-container">
              <div style="color: var(--ink-muted); font-family: var(--font-mono); font-size: 0.85rem; padding: 2rem 0; text-align: center;">
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
        <strong style="color: #ffffff; font-family: var(--font-display); font-size: 0.92rem; display: block; margin-bottom: 0.75rem;">
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

      <div class="states-filter-bar" id="statesContainer">
        <button class="state-pill" onclick="quickSelectState('TG')"><span>TG</span> Telangana</button>
        <button class="state-pill" onclick="quickSelectState('MH')"><span>MH</span> Maharashtra</button>
        <button class="state-pill" onclick="quickSelectState('KA')"><span>KA</span> Karnataka</button>
        <button class="state-pill" onclick="quickSelectState('DL')"><span>DL</span> Delhi NCR</button>
        <button class="state-pill" onclick="quickSelectState('TN')"><span>TN</span> Tamil Nadu</button>
        <button class="state-pill" onclick="quickSelectState('WB')"><span>WB</span> West Bengal</button>
        <button class="state-pill" onclick="quickSelectState('KL')"><span>KL</span> Kerala</button>
        <button class="state-pill" onclick="quickSelectState('GJ')"><span>GJ</span> Gujarat</button>
        <button class="state-pill" onclick="quickSelectState('UP')"><span>UP</span> Uttar Pradesh</button>
        <button class="state-pill" onclick="quickSelectState('AP')"><span>AP</span> Andhra Pradesh</button>
        <button class="state-pill" onclick="quickSelectState('AR')"><span>AR</span> Arunachal Pradesh</button>
        <button class="state-pill" onclick="quickSelectState('AS')"><span>AS</span> Assam</button>
        <button class="state-pill" onclick="quickSelectState('BR')"><span>BR</span> Bihar</button>
        <button class="state-pill" onclick="quickSelectState('CH')"><span>CH</span> Chandigarh</button>
        <button class="state-pill" onclick="quickSelectState('CT')"><span>CT</span> Chhattisgarh</button>
        <button class="state-pill" onclick="quickSelectState('GA')"><span>GA</span> Goa</button>
        <button class="state-pill" onclick="quickSelectState('HR')"><span>HR</span> Haryana</button>
        <button class="state-pill" onclick="quickSelectState('HP')"><span>HP</span> Himachal Pradesh</button>
        <button class="state-pill" onclick="quickSelectState('JK')"><span>JK</span> Jammu & Kashmir</button>
        <button class="state-pill" onclick="quickSelectState('JH')"><span>JH</span> Jharkhand</button>
        <button class="state-pill" onclick="quickSelectState('LA')"><span>LA</span> Ladakh</button>
        <button class="state-pill" onclick="quickSelectState('MP')"><span>MP</span> Madhya Pradesh</button>
        <button class="state-pill" onclick="quickSelectState('MN')"><span>MN</span> Manipur</button>
        <button class="state-pill" onclick="quickSelectState('ML')"><span>ML</span> Meghalaya</button>
        <button class="state-pill" onclick="quickSelectState('MZ')"><span>MZ</span> Mizoram</button>
        <button class="state-pill" onclick="quickSelectState('NL')"><span>NL</span> Nagaland</button>
        <button class="state-pill" onclick="quickSelectState('OR')"><span>OR</span> Odisha</button>
        <button class="state-pill" onclick="quickSelectState('PB')"><span>PB</span> Punjab</button>
        <button class="state-pill" onclick="quickSelectState('RJ')"><span>RJ</span> Rajasthan</button>
        <button class="state-pill" onclick="quickSelectState('SK')"><span>SK</span> Sikkim</button>
        <button class="state-pill" onclick="quickSelectState('TR')"><span>TR</span> Tripura</button>
        <button class="state-pill" onclick="quickSelectState('UT')"><span>UT</span> Uttarakhand</button>
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
          <thead>
            <tr>
              <th>Method</th>
              <th>Endpoint Structure</th>
              <th>Description & Key Query Params</th>
              <th>Live Sample</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="method-get">GET</span></td>
              <td><code class="endpoint-code">/api/holidays/:year/:state</code></td>
              <td>Merged state and national holidays for a region (<code>year</code>: 2024–2036, <code>state</code>: 2-letter ISO)</td>
              <td><a href="/api/holidays/2026/TG" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">/api/holidays/2026/TG</a></td>
            </tr>
            <tr>
              <td><span class="method-get">GET</span></td>
              <td><code class="endpoint-code">/api/holidays/:year</code></td>
              <td>All national gazetted holidays for India in a given year</td>
              <td><a href="/api/holidays/2026" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">/api/holidays/2026</a></td>
            </tr>
            <tr>
              <td><span class="method-get">GET</span></td>
              <td><code class="endpoint-code">/api/holidays/upcoming</code></td>
              <td>Upcoming holidays starting from today in IST (<code>?state=XX</code>, <code>?limit=5</code>)</td>
              <td><a href="/api/holidays/upcoming?state=MH&limit=5" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">/api/holidays/upcoming?state=MH</a></td>
            </tr>
            <tr>
              <td><span class="method-get">GET</span></td>
              <td><code class="endpoint-code">/api/long-weekends/:year/:state</code></td>
              <td>Identifies 3-day and 4-day bridge weekends with leave advice</td>
              <td><a href="/api/long-weekends/2026/KA" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">/api/long-weekends/2026/KA</a></td>
            </tr>
            <tr>
              <td><span class="method-get">GET</span></td>
              <td><code class="endpoint-code">/api/business-days</code></td>
              <td>Calculates working days vs holidays (<code>from=YYYY-MM-DD</code>, <code>to=YYYY-MM-DD</code>, <code>bank_rules=true</code>)</td>
              <td><a href="/api/business-days?from=2026-03-01&to=2026-03-31&state=MH" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">/api/business-days?from=...</a></td>
            </tr>
            <tr>
              <td><span class="method-get">GET</span></td>
              <td><code class="endpoint-code">/api/calendar/:year/:state.ics</code></td>
              <td>RFC 5545 iCalendar feed for Google Calendar, Apple Calendar, Outlook</td>
              <td><a href="/api/calendar/2026/TG.ics" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">/api/calendar/2026/TG.ics</a></td>
            </tr>
            <tr>
              <td><span class="method-get">GET</span></td>
              <td><code class="endpoint-code">/api/meta/states</code></td>
              <td>List all 36 supported States & Union Territories with ISO codes</td>
              <td><a href="/api/meta/states" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">/api/meta/states</a></td>
            </tr>
            <tr>
              <td><span class="method-get">GET</span></td>
              <td><code class="endpoint-code">/api/meta/types</code></td>
              <td>List all holiday classifications (<code>national</code>, <code>gazetted</code>, <code>restricted</code>, <code>bank</code>)</td>
              <td><a href="/api/meta/types" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">/api/meta/types</a></td>
            </tr>
            <tr>
              <td><span class="method-get">GET</span></td>
              <td><code class="endpoint-code">/api/openapi.json</code></td>
              <td>OpenAPI 3.0.3 specification for SDKs and Postman collections</td>
              <td><a href="/api/openapi.json" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">/api/openapi.json</a></td>
            </tr>
            <tr>
              <td><span class="method-get">GET</span></td>
              <td><code class="endpoint-code">/api/health</code></td>
              <td>Health check status, timezone, and edge version</td>
              <td><a href="/api/health" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">/api/health</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </div>

  <!-- Toast Notification Element -->
  <div id="toastNotification" class="toast">
    <span>✓</span>
    <span id="toastMessage">Copied to clipboard</span>
  </div>

  <!-- Human Crafted Footer -->
  <footer>
    <div class="footer-inner">
      <div class="footer-col-main">
        <div class="footer-brand">India Holidays API 🇮🇳</div>
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
        <a href="https://github.com/urunkarpm/holiday2api" target="_blank" class="footer-link">GitHub Repository</a>
        <a href="/api/health" target="_blank" class="footer-link">System Health</a>
      </div>
    </div>
    <div class="footer-bottom">
      <div>© 2026 India Holidays API • Open Source MIT</div>
      <div>Timezone: Asia/Kolkata (IST • UTC+05:30)</div>
    </div>
  </footer>

  <script>
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
      dateRangeGroup.style.display = hasDateRange ? 'block' : 'none';

      const path = getGeneratedPath();
      document.getElementById('urlPreviewDisplay').innerText = path;
      updateSnippetDisplay();
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

    function switchSnippetTab(type) {
      activeSnippetType = type;
      document.querySelectorAll('.snippet-tab').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');
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

    async function executeWorkbenchRequest() {
      const path = getGeneratedPath();
      const startTime = performance.now();
      const visualContainer = document.getElementById('visualDisplayArea');
      const rawContainer = document.getElementById('rawDisplayArea');
      const statusBadge = document.getElementById('responseStatusBadge');
      const timeBadge = document.getElementById('responseTimeBadge');

      visualContainer.innerHTML = '<div style="color: var(--ink-muted); font-family: var(--font-mono); font-size: 0.85rem; padding: 2rem 0; text-align: center;">Fetching data...</div>';
      rawContainer.innerText = 'Fetching data...';

      try {
        const res = await fetch(path);
        const elapsed = Math.round(performance.now() - startTime);
        timeBadge.innerText = elapsed + ' ms';
        statusBadge.innerText = res.status + ' OK';
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
        visualContainer.innerHTML = '<div style="color: #ef4444; font-family: var(--font-mono); padding: 1rem;">Failed to fetch: ' + err.message + '</div>';
        rawContainer.innerText = 'Error: ' + err.message;
      }
    }

    function renderPayloadViews(data, isIcs) {
      const visualContainer = document.getElementById('visualDisplayArea');
      const rawContainer = document.getElementById('rawDisplayArea');

      if (isIcs) {
        rawContainer.innerText = data;
        visualContainer.innerHTML = '<div style="grid-column: 1/-1; padding: 1.5rem; background: var(--bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);"><strong style="color: var(--accent-saffron); font-size: 1rem; display: block; margin-bottom: 0.5rem;">📅 RFC 5545 iCalendar Subscription Feed</strong><p style="color: var(--ink-secondary); font-size: 0.88rem; margin-bottom: 1rem;">This raw .ics calendar feed is compatible with Apple Calendar, Google Calendar, and Microsoft Outlook.</p><button class="btn btn-sm btn-primary" onclick="window.open(\\'' + getGeneratedPath() + '\\', \\'_blank\\')">📥 Download .ics File</button></div>';
        return;
      }

      rawContainer.innerText = JSON.stringify(data, null, 2);

      // Render Visual representation
      if (Array.isArray(data)) {
        if (data.length === 0) {
          visualContainer.innerHTML = '<div style="grid-column: 1/-1; color: var(--ink-muted); padding: 1.5rem; text-align: center;">No holidays matched the selected criteria.</div>';
          return;
        }

        // Check if long weekends array
        if (data[0] && (data[0].long_weekend_type || data[0].recommendation)) {
          let html = '';
          data.forEach(lw => {
            html += '<div class="lw-card" style="grid-column: 1/-1;">' +
              '<div class="lw-title">' + (lw.name || 'Long Weekend') + '</div>' +
              '<div class="lw-meta">🗓️ ' + lw.start_date + ' → ' + lw.end_date + ' (' + lw.total_days + ' Days Total) • ' + (lw.long_weekend_type || 'Weekend') + '</div>' +
              '<div class="lw-advice">💡 ' + (lw.recommendation || lw.leave_required || 'No leave required') + '</div>' +
            '</div>';
          });
          visualContainer.innerHTML = html;
          return;
        }

        // Standard Holiday Array
        let html = '';
        data.forEach(h => {
          const dateObj = new Date(h.date + 'T00:00:00+05:30');
          const monthStr = dateObj.toLocaleDateString('en-US', { month: 'short' });
          const dayNum = dateObj.getDate();
          const weekday = h.day || dateObj.toLocaleDateString('en-US', { weekday: 'short' });

          const typeBadge = (h.type === 'national' || h.type === 'gazetted') ? 
            '<span class="tag-badge gazetted">' + h.type + '</span>' : 
            '<span class="tag-badge">' + (h.type || 'holiday') + '</span>';

          const stateBadge = h.state_code ? '<span class="tag-badge">' + h.state_code + '</span>' : '';

          html += '<div class="holiday-card">' +
            '<div>' +
              '<div class="holiday-date-strip">' +
                '<div><span class="holiday-day-num">' + dayNum + '</span> <span class="holiday-month-name">' + monthStr + '</span></div>' +
                '<span class="holiday-weekday">' + weekday + '</span>' +
              '</div>' +
              '<div class="holiday-name">' + h.name + '</div>' +
            '</div>' +
            '<div class="holiday-tags">' + typeBadge + stateBadge + '</div>' +
          '</div>';
        });
        visualContainer.innerHTML = html;
      } else if (typeof data === 'object' && data !== null) {
        // Business days or Metadata object
        let html = '<div style="grid-column: 1/-1; background: var(--bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem;">';
        
        if (data.working_days !== undefined) {
          html += '<h4 style="font-size: 1.1rem; color: #fff; margin-bottom: 0.75rem;">💼 Working Days Breakdown</h4>' +
            '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1rem;">' +
              '<div style="background: var(--bg-surface); padding: 0.75rem; border-radius: var(--radius-sm);"><div style="font-size: 1.35rem; font-weight: 800; color: var(--accent-emerald);">' + data.working_days + '</div><div style="font-size: 0.75rem; color: var(--ink-muted); font-family: var(--font-mono);">Working Days</div></div>' +
              '<div style="background: var(--bg-surface); padding: 0.75rem; border-radius: var(--radius-sm);"><div style="font-size: 1.35rem; font-weight: 800; color: var(--accent-saffron);">' + (data.holiday_days_count || 0) + '</div><div style="font-size: 0.75rem; color: var(--ink-muted); font-family: var(--font-mono);">Holidays</div></div>' +
              '<div style="background: var(--bg-surface); padding: 0.75rem; border-radius: var(--radius-sm);"><div style="font-size: 1.35rem; font-weight: 800; color: var(--ink-primary);">' + (data.total_calendar_days || 0) + '</div><div style="font-size: 0.75rem; color: var(--ink-muted); font-family: var(--font-mono);">Total Span</div></div>' +
            '</div>' +
            '<div style="font-size: 0.82rem; font-family: var(--font-mono); color: var(--ink-secondary);">Rules Applied: ' + (data.rules || 'Standard') + '</div>';
        } else {
          html += '<pre style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--accent-cyan);">' + JSON.stringify(data, null, 2) + '</pre>';
        }
        
        html += '</div>';
        visualContainer.innerHTML = html;
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('toastNotification');
      document.getElementById('toastMessage').innerText = msg;
      toast.classList.add('show');
      setTimeout(() => { toast.classList.remove('show'); }, 2200);
    }

    function copyHeroCurl() {
      const url = window.location.origin + '/api/holidays/2026/TG';
      navigator.clipboard.writeText('curl ' + url);
      showToast('Copied cURL command');
    }

    function copySnippetText(txt) {
      navigator.clipboard.writeText(txt);
      showToast('Copied cURL command');
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

    function applyPreset(type) {
      document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');

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
      }

      updateFormFields();
      executeWorkbenchRequest();
    }

    function quickSelectState(st) {
      document.getElementById('endpointSelect').value = '/api/holidays/:year/:state';
      document.getElementById('stateSelect').value = st;
      updateFormFields();
      executeWorkbenchRequest();
      document.getElementById('workbench').scrollIntoView({ behavior: 'smooth' });
    }

    // Initialize on page ready
    document.addEventListener('DOMContentLoaded', () => {
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
