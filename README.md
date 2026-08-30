# India Holidays API

[![Validate JSON](https://github.com/urunkarpm/holiday2api/actions/workflows/validate-json.yml/badge.svg)](https://github.com/urunkarpm/holiday2api/actions/workflows/validate-json.yml)
[![Deploy](https://github.com/urunkarpm/holiday2api/actions/workflows/deploy.yml/badge.svg)](https://github.com/urunkarpm/holiday2api/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A free, fast, and reliable REST API for Indian holidays (national, gazetted, state-specific, bank, and restricted). Features long weekend vacation planners, iCalendar (.ics) exports, business days calculations, and a built-in interactive playground UI. No authentication required. No rate limits.

---

## ✨ Features

- ⚡ **Sub-100ms Responses**: Edge-cached globally on Cloudflare CDN and Vercel Edge.
- 💸 **100% Free & Open**: Zero authentication, no API keys, no rate limits.
- 🌐 **All 36 States & UTs**: Full coverage for 28 States + 8 Union Territories + National (All India).
- 📅 **13-Year Dataset**: Pre-calculated holiday data covering **2024 through 2036**.
- 🏖️ **Long Weekend Finder**: Automatically finds 3-day and 4-day bridge long weekends with leave recommendations.
- ⏱️ **Upcoming Holidays**: Instant lookup for upcoming holidays starting from current date in IST (`Asia/Kolkata`).
- 📆 **iCalendar (.ics) Subscriptions**: 1-click subscription for Google Calendar, Apple Calendar, and Microsoft Outlook.
- 💼 **Business / Working Days Calculator**: Accurate working days calculator with standard 5-day week and RBI Bank rules (2nd/4th Saturdays).
- 📖 **OpenAPI 3.0 Spec**: Standard OpenAPI JSON specification at `/api/openapi.json`.
- 🛠️ **Interactive Web Playground**: Built-in visual API explorer at `/` with live requests and formatted code snippets.

---

## 🚀 Quick Start Examples

### 1. Get Holidays for a State
```bash
# Telangana (TG) for 2026
curl https://holiday2api.vercel.app/api/holidays/2026/TG

# Maharashtra (MH) for 2026
curl https://holiday2api.vercel.app/api/holidays/2026/MH
```

### 2. Find Long Weekends & Vacation Recommendations
```bash
# Long weekends in Karnataka (KA) for 2026
curl https://holiday2api.vercel.app/api/long-weekends/2026/KA
```

### 3. Get Upcoming Holidays (from Today in IST)
```bash
curl "https://holiday2api.vercel.app/api/holidays/upcoming?state=TG&limit=5"
```

### 4. Calculate Business / Working Days
```bash
# Calculate working days in March 2026 with RBI Bank rules
curl "https://holiday2api.vercel.app/api/business-days?from=2026-03-01&to=2026-03-31&state=MH&bank_rules=true"
```

### 5. Subscribe via Google / Apple Calendar (.ics)
```bash
# Import or subscribe directly in calendar apps:
https://holiday2api.vercel.app/api/calendar/2026/TG.ics
```

---

## 📡 API Endpoints Directory

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Interactive Web Playground (Browser) / API Directory (JSON) |
| `GET` | `/api/health` | Health check and uptime status |
| `GET` | `/api/openapi.json` | OpenAPI 3.0.3 Specification |
| `GET` | `/api/meta/states` | List all 36 supported States & Union Territories |
| `GET` | `/api/meta/types` | List all holiday classifications (`national`, `public`, `state`, `bank`, etc.) |
| `GET` | `/api/holidays/:year` | National holidays for a year (optional `?state=` query) |
| `GET` | `/api/holidays/:year/:state` | Combined National + State-specific holidays for a region |
| `GET` | `/api/holidays/upcoming` | Next upcoming holidays from current IST date |
| `GET` | `/api/long-weekends/:year/:state` | Find 3-day and 4-day bridge long weekends |
| `GET` | `/api/business-days` | Calculate working days between two dates |
| `GET` | `/api/calendar/:year/:state.ics` | Download/Subscribe to RFC 5545 iCalendar feed |

---

## 🔎 Query Parameters

### `/api/holidays` & `/api/holidays/:year`
| Parameter | Type | Description | Example |
|---|---|---|---|
| `year` | string | 4-digit year (`2024`–`2036`) | `2026` |
| `state` | string | 2-letter ISO 3166-2:IN code | `TG`, `MH`, `KA`, `DL` |
| `type` | string | Filter by holiday type | `national`, `public`, `state`, `bank` |
| `date` | string | Filter by exact date (`YYYY-MM-DD`) | `2026-08-15` |
| `month` | string | Filter by month number (`1`–`12`) | `08` |

### `/api/business-days`
| Parameter | Type | Description | Default |
|---|---|---|---|
| `from` | string (required) | Start date in `YYYY-MM-DD` | — |
| `to` | string (required) | End date in `YYYY-MM-DD` | — |
| `state` | string | State code for regional holidays | `IN` |
| `bank_rules` | boolean | Enable RBI rules (2nd/4th Sat off, 1st/3rd/5th working) | `false` |
| `include_saturdays` | boolean | Treat all Saturdays as working days | `false` |

---

## 🗺️ Supported States & Union Territories (36 Total)

| Code | State / Union Territory | Type | Code | State / Union Territory | Type |
|---|---|---|---|---|---|
| `IN` | **National (All India)** | National | `LD` | Lakshadweep | UT |
| `AN` | Andaman & Nicobar Islands | UT | `MP` | Madhya Pradesh | State |
| `AP` | Andhra Pradesh | State | `MH` | Maharashtra | State |
| `AR` | Arunachal Pradesh | State | `MN` | Manipur | State |
| `AS` | Assam | State | `ML` | Meghalaya | State |
| `BR` | Bihar | State | `MZ` | Mizoram | State |
| `CH` | Chandigarh | UT | `NL` | Nagaland | State |
| `CT` | Chhattisgarh | State | `OR` | Odisha | State |
| `DN` | Dadra & Nagar Haveli and Daman & Diu | UT | `PY` | Puducherry | UT |
| `DL` | Delhi | UT | `PB` | Punjab | State |
| `GA` | Goa | State | `RJ` | Rajasthan | State |
| `GJ` | Gujarat | State | `SK` | Sikkim | State |
| `HR` | Haryana | State | `TN` | Tamil Nadu | State |
| `HP` | Himachal Pradesh | State | `TG` | Telangana | State |
| `JK` | Jammu & Kashmir | UT | `TR` | Tripura | State |
| `JH` | Jharkhand | State | `UP` | Uttar Pradesh | State |
| `KA` | Karnataka | State | `UT` | Uttarakhand | State |
| `KL` | Kerala | State | `WB` | West Bengal | State |
| `LA` | Ladakh | UT | | | |

---

## 💻 Local Development & Testing

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite (15 integration tests)
npm test

# 3. Validate all JSON datasets (10,000+ holiday entries)
npm run validate

# 4. Start local development server
npm run dev
```

---

## 🚀 Deploying to Cloudflare or Vercel

### Deploy to Cloudflare Workers
```bash
npx wrangler login
npm run deploy
```

### Deploy to Vercel
```bash
npx vercel --prod
```
*(Or connect your GitHub repository directly in the Vercel Dashboard for 1-click automatic deployments).*

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).