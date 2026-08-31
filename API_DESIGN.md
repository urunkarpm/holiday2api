# India Holidays API — API Design Specification

## 1. Overview

The **India Holidays API** is an open, fast REST service providing Indian holiday calendars across national, state-specific, bank, and restricted categories for all 28 Indian States and 8 Union Territories.

- **Base URL**: `https://holiday2api.vercel.app`
- **Timezone**: `Asia/Kolkata` (`IST` / `UTC+5:30`)
- **Authentication**: None (100% open public API, no API keys needed)
- **Rate Limits**: None
- **Formats**: JSON (`application/json`) and iCalendar (`text/calendar`)

---

## 2. Standard Response Headers

```http
Content-Type: application/json; charset=utf-8
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: Content-Type
Cache-Control: public, max-age=3600
```

---

## 3. Endpoints

### 3.1 Get Holidays by Year and State
- **Path**: `GET /api/holidays/:year/:state`
- **Parameters**:
  - `year`: 4-digit year (`2024`–`2036`)
  - `state`: 2-letter state code (`TG`, `MH`, `KA`, `DL`, or `IN` for National)
  - `type` *(optional)*: `national`, `state`, `public`, `restricted`
  - `month` *(optional)*: `1`–`12`
  - `date` *(optional)*: `YYYY-MM-DD`
- **Example Response (200 OK)**:
```json
[
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
]
```

---

### 3.2 Upcoming Holidays
- **Path**: `GET /api/holidays/upcoming`
- **Parameters**:
  - `state` *(optional)*: State code (default: `IN`)
  - `limit` *(optional)*: Number of holidays to return (default: `10`, max: `50`)
- **Example Response (200 OK)**:
```json
[
  {
    "date": "2026-10-02",
    "name": "Gandhi Jayanti",
    "type": "national",
    "state_code": "IN",
    "description": "Birthday of Mahatma Gandhi",
    "day_of_week": "Friday",
    "days_until": 32
  }
]
```

---

### 3.3 Long Weekend Vacation Planner
- **Path**: `GET /api/long-weekends/:year/:state`
- **Description**: Finds natural 3-day weekends and 4-day bridge weekends with leave day recommendations.
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
          "name": "Ugadi / Gudi Padwa",
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

### 3.4 Working / Business Days Calculator
- **Path**: `GET /api/business-days`
- **Parameters**:
  - `from` *(required)*: Start date in `YYYY-MM-DD`
  - `to` *(required)*: End date in `YYYY-MM-DD`
  - `state` *(optional)*: State code (default: `IN`)
  - `bank_rules` *(optional)*: `true` to close 2nd and 4th Saturdays
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

### 3.5 iCalendar (.ics) Feed Export
- **Path**: `GET /api/calendar/:year/:state.ics`
- **Format**: `text/calendar; charset=utf-8` (RFC 5545)
- **Usage**: Directly subscribable in Google Calendar, Apple Calendar, and Outlook.
