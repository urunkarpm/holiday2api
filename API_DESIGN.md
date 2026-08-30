# India Holidays API - REST API Specification

## 1. Overview

The **India Holidays API** is an open, high-performance RESTful service delivering Indian holiday calendars across national, central gazetted, state-specific, bank, and restricted holiday categories for all 28 Indian States and 8 Union Territories.

- **Base URL**: `https://holiday2api.vercel.app` (or custom Vercel / Cloudflare / localhost domain)
- **Timezone**: `Asia/Kolkata` (`IST` / `UTC+5:30`)
- **Authentication**: None (open public API)
- **Rate Limits**: None
- **Formats**: JSON (`application/json`) and iCalendar (`text/calendar`)

---

## 2. Standard Response Headers

```http
Content-Type: application/json; charset=utf-8
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 86400
Cache-Control: public, max-age=3600
```

---

## 3. Endpoints

### 3.1 Interactive Web Explorer & Discovery
- **Path**: `GET /`
- **Behavior**:
  - If requested from a web browser (`Accept: text/html`), renders the Interactive Web Playground UI.
  - If requested as JSON (`Accept: application/json` or `?json=true`), returns the API directory and endpoint index.

---

### 3.2 OpenAPI 3.0.3 Specification
- **Path**: `GET /api/openapi.json`
- **Description**: Returns complete OpenAPI 3.0.3 schema for SDK generation, Swagger UI, and Postman collections.

---

### 3.3 State Holidays
- **Path**: `GET /api/holidays/:year/:state`
- **Path Parameters**:
  - `year`: 4-digit year (`2024`–`2036`)
  - `state`: 2-letter ISO 3166-2:IN code (`TG`, `MH`, `KA`, etc.)
- **Query Parameters**:
  - `type`: Filter by type (`national`, `state`, `bank`, `public`, `optional`)
  - `month`: Filter by month (`01`–`12`)
  - `date`: Filter by exact date (`YYYY-MM-DD`)
- **Example Response (200 OK)**:
  ```json
  [
    {
      "date": "2026-01-14",
      "name": "Bhogi / Makar Sankranti",
      "type": "state",
      "state_code": "TG",
      "description": "Harvest festival dedicated to the Sun God Surya"
    },
    {
      "date": "2026-01-26",
      "name": "Republic Day",
      "type": "national",
      "state_code": "IN",
      "description": "Celebrates the adoption of the Constitution of India"
    }
  ]
  ```

---

### 3.4 Upcoming Holidays
- **Path**: `GET /api/holidays/upcoming`
- **Query Parameters**:
  - `state`: 2-letter state code (default: `IN`)
  - `limit`: Number of holidays to return (default: `10`, max: `50`)
  - `type`: Optional holiday type filter
  - `date`: Optional starting date override (default: current date in IST)
- **Example Response (200 OK)**:
  ```json
  [
    {
      "date": "2026-10-02",
      "name": "Gandhi Jayanti",
      "type": "national",
      "state_code": "IN",
      "description": "Birthday of Mahatma Gandhi, Father of the Nation",
      "day_of_week": "Friday",
      "days_until": 33
    }
  ]
  ```

---

### 3.5 Long Weekend & Vacation Finder
- **Path**: `GET /api/long-weekends/:year/:state`
- **Description**: Analyzes holiday calendar to find natural 3-day weekends and bridge 4-day weekends with recommended leave days.
- **Example Response (200 OK)**:
  ```json
  {
    "year": 2026,
    "state_code": "TG",
    "total_long_weekends": 17,
    "long_weekends": [
      {
        "type": "natural_long_weekend",
        "start_date": "2026-04-03",
        "end_date": "2026-04-05",
        "total_days": 3,
        "holidays_included": [
          {
            "date": "2026-04-03",
            "name": "Good Friday",
            "type": "public",
            "state_code": "IN"
          }
        ],
        "bridge_days_needed": 0,
        "recommendation": "3-day weekend (Friday to Sunday)"
      },
      {
        "type": "bridge_weekend",
        "start_date": "2026-03-19",
        "end_date": "2026-03-22",
        "total_days": 4,
        "holidays_included": [
          {
            "date": "2026-03-19",
            "name": "Gudi Padwa / Ugadi",
            "type": "state",
            "state_code": "TG"
          }
        ],
        "bridge_days_needed": 1,
        "bridge_dates": ["2026-03-20"],
        "recommendation": "Take leave on Friday (2026-03-20) for a 4-day weekend (Thursday to Sunday)"
      }
    ]
  }
  ```

---

### 3.6 Business & Working Days Calculator
- **Path**: `GET /api/business-days`
- **Query Parameters**:
  - `from` (required): Start date (`YYYY-MM-DD`)
  - `to` (required): End date (`YYYY-MM-DD`)
  - `state` (optional): State code (`IN`, `MH`, `KA`, etc.)
  - `bank_rules` (optional): Set to `true` to apply RBI bank holiday rules (2nd/4th Saturdays are off; 1st, 3rd, 5th are working days)
  - `include_saturdays` (optional): Set to `true` to treat all Saturdays as working days
- **Example Response (200 OK)**:
  ```json
  {
    "from": "2026-03-01",
    "to": "2026-03-31",
    "state_code": "MH",
    "rules": "RBI Bank Rules (2nd/4th Sat off)",
    "total_calendar_days": 31,
    "working_days": 21,
    "weekend_days": 8,
    "holiday_days_count": 4,
    "holidays_on_weekdays": [
      { "date": "2026-03-04", "name": "Holi", "day": "Wednesday" },
      { "date": "2026-03-19", "name": "Gudi Padwa", "day": "Thursday" }
    ],
    "holidays_on_weekends": [
      { "date": "2026-03-21", "name": "Eid ul-Fitr", "day": "Saturday" }
    ]
  }
  ```

---

### 3.7 iCalendar (.ics) Feed Export
- **Path**: `GET /api/calendar/:year/:state.ics` (or `GET /api/holidays/:year/:state.ics`)
- **Response Format**: `text/calendar; charset=utf-8` (RFC 5545)
- **Usage**: Directly subscribable in Google Calendar, Apple Calendar, and Outlook.
