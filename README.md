# 🇮🇳 India Holidays API

[![Validate JSON](https://github.com/urunkarpm/holiday2api/actions/workflows/validate-json.yml/badge.svg)](https://github.com/urunkarpm/holiday2api/actions/workflows/validate-json.yml)
[![Deploy](https://github.com/urunkarpm/holiday2api/actions/workflows/deploy.yml/badge.svg)](https://github.com/urunkarpm/holiday2api/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A free, fast, and dead-simple REST API for Indian holidays. Get national, state, and bank holidays, calculate working days, and find long weekend vacation recommendations with clean JSON.

**Zero setup. No API keys. No rate limits. Free forever.**

---

## ⚡ Quick Start (Copy & Paste)

### Get holidays for any state:
```bash
# Telangana (TG) for 2026
curl https://holiday2api.vercel.app/api/holidays/2026/TG

# Maharashtra (MH) for 2026
curl https://holiday2api.vercel.app/api/holidays/2026/MH

# Delhi (DL) for 2026
curl https://holiday2api.vercel.app/api/holidays/2026/DL
```

### Sample JSON Output:
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

## 💡 What Can You Do With This API?

| What do you want to do? | Endpoint URL | Example |
|---|---|---|
| 📌 **Get holidays for a state** | `GET /api/holidays/:year/:state` | [`/api/holidays/2026/MH`](https://holiday2api.vercel.app/api/holidays/2026/MH) |
| ⏳ **Get next upcoming holidays from today** | `GET /api/holidays/upcoming` | [`/api/holidays/upcoming?limit=5`](https://holiday2api.vercel.app/api/holidays/upcoming?limit=5) |
| 🏖️ **Find long weekends for vacation planning** | `GET /api/long-weekends/:year/:state` | [`/api/long-weekends/2026/KA`](https://holiday2api.vercel.app/api/long-weekends/2026/KA) |
| 📊 **Calculate working days between 2 dates** | `GET /api/business-days?from=...&to=...` | [`/api/business-days?from=2026-03-01&to=2026-03-31&state=MH`](https://holiday2api.vercel.app/api/business-days?from=2026-03-01&to=2026-03-31&state=MH) |
| 📅 **Subscribe via Google / Apple Calendar** | `GET /api/calendar/:year/:state.ics` | [`/api/calendar/2026/TG.ics`](https://holiday2api.vercel.app/api/calendar/2026/TG.ics) |
| 🗺️ **List all 36 States & UTs** | `GET /api/meta/states` | [`/api/meta/states`](https://holiday2api.vercel.app/api/meta/states) |
| 🏷️ **List holiday classifications** | `GET /api/meta/types` | [`/api/meta/types`](https://holiday2api.vercel.app/api/meta/types) |
| 💚 **Check API server health** | `GET /api/health` | [`/api/health`](https://holiday2api.vercel.app/api/health) |

---

## 📖 Endpoints Guide

### 1. Get Holidays
**`GET /api/holidays/:year/:state`**

Returns all holidays (national + state-specific) for a given year and state.
- **`year`**: `2024` through `2036`
- **`state`**: 2-letter state code (e.g. `MH`, `TG`, `DL`, `KA`, or `IN` for pan-India)
- **Optional filters**:
  - `?type=national` (or `state`, `public`, `restricted`)
  - `?month=3` (or `03`)
  - `?date=2026-08-15`

### 2. Upcoming Holidays
**`GET /api/holidays/upcoming`**

Returns the next upcoming holidays starting from the current date in IST (`Asia/Kolkata`).
- **`state`** *(optional)*: 2-letter state code (default: `IN`)
- **`limit`** *(optional)*: number of holidays to return (default: `10`, max: `50`)

### 3. Long Weekend Finder
**`GET /api/long-weekends/:year/:state`**

Finds natural 3-day weekends (Friday/Monday holidays) and 4-day bridge weekends (Thursday/Tuesday holidays with 1 leave day).
```json
{
  "year": 2026,
  "state_code": "TG",
  "total_long_weekends": 17,
  "long_weekends": [
    {
      "type": "bridge_weekend",
      "start_date": "2026-03-19",
      "end_date": "2026-03-22",
      "total_days": 4,
      "bridge_days_needed": 1,
      "bridge_dates": ["2026-03-20"],
      "recommendation": "Take leave on Friday (2026-03-20) for a 4-day weekend (Thursday to Sunday)"
    }
  ]
}
```

### 4. Working Days Calculator
**`GET /api/business-days`**

Calculates working days between two dates, excluding weekends and official holidays.
- **`from`** *(required)*: Start date in `YYYY-MM-DD`
- **`to`** *(required)*: End date in `YYYY-MM-DD`
- **`state`** *(optional)*: State code for regional holidays (default: `IN`)
- **`bank_rules`** *(optional)*: Set to `true` to follow RBI rules (2nd and 4th Saturdays closed)

---

## 🗺️ 2-Letter State & Union Territory Codes

| Code | State / UT | Code | State / UT | Code | State / UT |
|---|---|---|---|---|---|
| `IN` | **National (All India)** | `GA` | Goa | `NL` | Nagaland |
| `AN` | Andaman & Nicobar | `GJ` | Gujarat | `OR` | Odisha |
| `AP` | Andhra Pradesh | `HR` | Haryana | `PY` | Puducherry |
| `AR` | Arunachal Pradesh | `HP` | Himachal Pradesh | `PB` | Punjab |
| `AS` | Assam | `JK` | Jammu & Kashmir | `RJ` | Rajasthan |
| `BR` | Bihar | `JH` | Jharkhand | `SK` | Sikkim |
| `CH` | Chandigarh | `KA` | Karnataka | `TN` | Tamil Nadu |
| `CT` | Chhattisgarh | `KL` | Kerala | `TG` | Telangana |
| `DH` | Dadra & Nagar Haveli | `LA` | Ladakh | `TR` | Tripura |
| `DL` | Delhi (NCT) | `MP` | Madhya Pradesh | `UP` | Uttar Pradesh |
| `MH` | Maharashtra | `ML` | Meghalaya | `UT` | Uttarakhand |
| `MN` | Manipur | `MZ` | Mizoram | `WB` | West Bengal |

---

## 💻 Code Examples

### JavaScript (Fetch)
```javascript
const res = await fetch('https://holiday2api.vercel.app/api/holidays/2026/TG');
const holidays = await res.json();
console.log(holidays);
```

### Python (Requests)
```python
import requests

res = requests.get('https://holiday2api.vercel.app/api/holidays/2026/TG')
holidays = res.json()
print(f"Total holidays: {len(holidays)}")
```

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite (24 tests)
npm test

# 3. Validate JSON holiday datasets
npm run validate

# 4. Start local development server
npm run dev
```

---

## 📄 License

MIT License — free for personal and commercial use.