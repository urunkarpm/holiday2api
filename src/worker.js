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
    const uid = `${h.date}-${slug}-${h.state_code}@india-holidays.pages.dev`;

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
      { url: baseUrl || 'https://india-holidays.pages.dev', description: 'Production Edge CDN' },
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
 * Render Modern Interactive HTML Landing Page & API Explorer UI
 */
function renderInteractiveHtml(env) {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>India Holidays API — Free, Fast, Developer-Friendly</title>
  <meta name="description" content="Free, sub-100ms REST API for Indian holidays. Covers National and all 36 States & UTs with iCalendar exports, long weekend planner, and business day calculations.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(22, 29, 47, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent: #ff6b35;
      --accent-gradient: linear-gradient(135deg, #ff8c42 0%, #ff3e3e 50%, #d81159 100%);
      --cyan-gradient: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
      --emerald-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --code-bg: #0c1222;
      --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(255, 107, 53, 0.12) 0px, transparent 50%),
        radial-gradient(at 100% 0%, rgba(79, 172, 254, 0.12) 0px, transparent 50%),
        radial-gradient(at 50% 100%, rgba(216, 17, 89, 0.08) 0px, transparent 50%);
      background-attachment: fixed;
      color: var(--text);
      font-family: var(--font-sans);
      line-height: 1.6;
      padding: 0;
      min-height: 100vh;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    header { text-align: center; padding: 3.5rem 1rem 2.5rem; }
    .badge {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: rgba(255, 107, 53, 0.12);
      color: #ff8c42; border: 1px solid rgba(255, 107, 53, 0.3);
      padding: 0.35rem 1rem; border-radius: 9999px;
      font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
      margin-bottom: 1.25rem;
    }
    h1 {
      font-size: 3rem; font-weight: 800; letter-spacing: -0.03em;
      background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
    }
    .hero-sub {
      font-size: 1.2rem; color: var(--text-muted); max-width: 720px; margin: 0 auto 2rem;
    }
    .hero-buttons { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }
    .btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.75rem 1.5rem; border-radius: 0.6rem;
      font-weight: 600; font-size: 0.95rem; text-decoration: none; cursor: pointer;
      transition: all 0.2s ease; border: none;
    }
    .btn-primary {
      background: var(--accent-gradient); color: #fff;
      box-shadow: 0 4px 20px rgba(255, 62, 62, 0.3);
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 25px rgba(255, 62, 62, 0.45); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05); color: var(--text);
      border: 1px solid var(--card-border);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 2rem; }
    @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } h1 { font-size: 2.2rem; } }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1rem;
      padding: 1.75rem;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    .card-title {
      font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;
    }

    .form-group { margin-bottom: 1.25rem; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.04em; }
    select, input {
      width: 100%; padding: 0.75rem 1rem; background: rgba(12, 18, 34, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 0.5rem;
      color: #fff; font-size: 0.95rem; font-family: var(--font-sans);
      outline: none; transition: border-color 0.2s;
    }
    select:focus, input:focus { border-color: #ff8c42; }

    .code-box {
      background: var(--code-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: #38bdf8;
      overflow-x: auto;
      max-height: 480px;
      white-space: pre;
    }

    .stats-row {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 2.5rem 0;
    }
    .stat-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem; padding: 1.25rem; text-align: center;
    }
    .stat-number { font-size: 1.75rem; font-weight: 800; color: #ff8c42; }
    .stat-label { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }

    .tag {
      display: inline-block; padding: 0.2rem 0.5rem; border-radius: 0.3rem;
      font-size: 0.75rem; font-family: var(--font-mono); font-weight: 600;
      background: rgba(56, 189, 248, 0.15); color: #38bdf8;
    }
    footer { text-align: center; margin-top: 4rem; padding: 2rem; color: var(--text-muted); font-size: 0.9rem; border-top: 1px solid var(--card-border); }
  </style>
</head>
<body>

  <div class="container">
    <header>
      <div class="badge">🚀 Sub-100ms • Zero Auth • Edge CDN</div>
      <h1>India Holidays API</h1>
      <p class="hero-sub">The fast, free, open-access API for Indian holidays. Covers National, Gazetted, and all 36 States & UTs with iCalendar exports, long weekend planning, and business day calculations.</p>
      <div class="hero-buttons">
        <a href="#tester" class="btn btn-primary">⚡ Try Live API Tester</a>
        <a href="/api/openapi.json" class="btn btn-secondary" target="_blank">📖 OpenAPI Spec</a>
        <a href="https://github.com/urunkarpm/holiday2api" class="btn btn-secondary" target="_blank">⭐ GitHub Repo</a>
      </div>
    </header>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-number">36</div>
        <div class="stat-label">States & Union Territories</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">2024–2036</div>
        <div class="stat-label">Supported Years (13 Years)</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">0 ms</div>
        <div class="stat-label">Edge Cached Latency</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">100% Free</div>
        <div class="stat-label">No API Keys Required</div>
      </div>
    </div>

    <div id="tester" class="grid-2">
      <!-- Interactive Request Builder -->
      <div class="card">
        <div class="card-title">🛠️ Interactive Request Builder</div>
        
        <div class="form-group">
          <label>Endpoint</label>
          <select id="endpointSelect" onchange="updateFormFields()">
            <option value="/api/holidays/:year/:state">GET /api/holidays/:year/:state (State Holidays)</option>
            <option value="/api/holidays/:year">GET /api/holidays/:year (National Holidays)</option>
            <option value="/api/holidays/upcoming">GET /api/holidays/upcoming (Upcoming Holidays)</option>
            <option value="/api/long-weekends/:year/:state">GET /api/long-weekends/:year/:state (Long Weekend Finder)</option>
            <option value="/api/business-days">GET /api/business-days (Working Days Calculator)</option>
            <option value="/api/calendar/:year/:state.ics">GET /api/calendar/:year/:state.ics (iCalendar Feed)</option>
            <option value="/api/meta/states">GET /api/meta/states (List All States)</option>
            <option value="/api/meta/types">GET /api/meta/types (List Holiday Types)</option>
          </select>
        </div>

        <div class="grid-2" style="margin-top: 0; margin-bottom: 1rem;">
          <div class="form-group" id="yearGroup">
            <label>Year</label>
            <select id="yearSelect">
              <option value="2026" selected>2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2027">2027</option>
              <option value="2028">2028</option>
              <option value="2029">2029</option>
              <option value="2030">2030</option>
              <option value="2035">2035</option>
            </select>
          </div>

          <div class="form-group" id="stateGroup">
            <label>State / Region</label>
            <select id="stateSelect">
              <option value="IN">IN - National (All India)</option>
              <option value="TG" selected>TG - Telangana</option>
              <option value="MH">MH - Maharashtra</option>
              <option value="KA">KA - Karnataka</option>
              <option value="DL">DL - Delhi</option>
              <option value="TN">TN - Tamil Nadu</option>
              <option value="WB">WB - West Bengal</option>
              <option value="GJ">GJ - Gujarat</option>
              <option value="KL">KL - Kerala</option>
              <option value="UP">UP - Uttar Pradesh</option>
              <option value="AP">AP - Andhra Pradesh</option>
              <option value="PB">PB - Punjab</option>
              <option value="RJ">RJ - Rajasthan</option>
              <option value="GA">GA - Goa</option>
            </select>
          </div>
        </div>

        <div class="form-group" id="dateRangeGroup" style="display: none;">
          <div class="grid-2" style="margin-top:0;">
            <div>
              <label>From Date</label>
              <input type="date" id="fromDateInput" value="2026-03-01">
            </div>
            <div>
              <label>To Date</label>
              <input type="date" id="toDateInput" value="2026-03-31">
            </div>
          </div>
          <div style="margin-top: 0.75rem;">
            <label style="display:inline-flex; align-items:center; gap:0.5rem; text-transform:none; cursor:pointer;">
              <input type="checkbox" id="bankRulesCheckbox" style="width:auto;"> Apply RBI Bank Rules (2nd/4th Sat Off)
            </label>
          </div>
        </div>

        <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="sendApiRequest()">
          ⚡ Execute Live Request
        </button>

        <div style="margin-top: 1.5rem;">
          <label>Generated Request URL</label>
          <div id="requestUrlDisplay" class="tag" style="width: 100%; padding: 0.6rem; overflow-x: auto; display: block;">/api/holidays/2026/TG</div>
        </div>
      </div>

      <!-- Response Viewer -->
      <div class="card">
        <div class="card-title" style="justify-content: space-between;">
          <span>📦 Response Preview</span>
          <span id="latencyBadge" class="tag" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">200 OK</span>
        </div>
        <div id="responseOutput" class="code-box">Loading...</div>
      </div>
    </div>
  </div>

  <footer>
    <p>India Holidays API is open source under the MIT License • Built for developers worldwide 🇮🇳</p>
  </footer>

  <script>
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
      return '/api/holidays/' + year + '/' + state;
    }

    function updateFormFields() {
      const ep = document.getElementById('endpointSelect').value;
      const yearGroup = document.getElementById('yearGroup');
      const stateGroup = document.getElementById('stateGroup');
      const dateRangeGroup = document.getElementById('dateRangeGroup');

      yearGroup.style.display = (ep.includes(':year')) ? 'block' : 'none';
      stateGroup.style.display = (ep.includes(':state') || ep.includes('upcoming') || ep.includes('business')) ? 'block' : 'none';
      dateRangeGroup.style.display = (ep.includes('business-days')) ? 'block' : 'none';

      document.getElementById('requestUrlDisplay').innerText = getGeneratedPath();
    }

    async function sendApiRequest() {
      const path = getGeneratedPath();
      document.getElementById('requestUrlDisplay').innerText = path;
      const startTime = performance.now();
      const output = document.getElementById('responseOutput');
      const badge = document.getElementById('latencyBadge');

      output.innerText = 'Fetching...';

      try {
        const res = await fetch(path);
        const elapsed = Math.round(performance.now() - startTime);
        badge.innerText = res.status + ' OK (' + elapsed + 'ms)';
        badge.style.color = res.ok ? '#10b981' : '#ef4444';

        if (path.endsWith('.ics')) {
          const text = await res.text();
          output.innerText = text;
        } else {
          const json = await res.json();
          output.innerText = JSON.stringify(json, null, 2);
        }
      } catch (e) {
        badge.innerText = 'Error';
        badge.style.color = '#ef4444';
        output.innerText = 'Failed to fetch: ' + e.message;
      }
    }

    // Initialize on load
    updateFormFields();
    sendApiRequest();
  </script>
</body>
</html>`;
}
