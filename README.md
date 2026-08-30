# India Holidays API

[![Validate JSON](https://github.com/urunkarpm/holiday2api/actions/workflows/validate-json.yml/badge.svg)](https://github.com/urunkarpm/holiday2api/actions/workflows/validate-json.yml)
[![Deploy](https://github.com/urunkarpm/holiday2api/actions/workflows/deploy.yml/badge.svg)](https://github.com/urunkarpm/holiday2api/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A free, fast, and reliable REST API for Indian holidays (national, gazetted, state-specific, bank, and restricted). No authentication required. No rate limits.

---

## ✨ Features

- ⚡ **Ultra Fast**: Sub-100ms response times globally via Cloudflare CDN edge caching.
- 💸 **100% Free**: Zero cost, public access, no API keys or registration needed.
- 🌐 **Comprehensive Coverage**: All 28 Indian States + 8 Union Territories (36 regional jurisdictions) + National (All India).
- 📅 **Multi-Year Support**: Data pre-calculated for years **2024** and **2026–2036**.
- ⏰ **Timezone-Aware**: All dates use **Asia/Kolkata** (`IST` / `UTC+5:30`).
- 🔍 **Flexible Querying**: Query by year, state code, holiday type, or specific calendar date.
- 🛡️ **Zero Database Overhead**: Built on static JSON partitions with automated GitHub Actions updates.

---

## 🚀 Quick Start

### 1. Get all national holidays for a year
```bash
curl https://india-holidays.pages.dev/api/holidays/2026
```

### 2. Get holidays for a specific state (National + State-specific)
```bash
# Telangana (TG)
curl https://india-holidays.pages.dev/api/holidays/2026/TG

# Maharashtra (MH)
curl https://india-holidays.pages.dev/api/holidays/2026/MH

# Karnataka (KA)
curl https://india-holidays.pages.dev/api/holidays/2026/KA
```

### 3. Filter holidays by query parameters
```bash
# Filter by state and holiday type
curl "https://india-holidays.pages.dev/api/holidays?year=2026&state=TN&type=state"

# Check if a specific date is a holiday
curl "https://india-holidays.pages.dev/api/holidays?year=2026&date=2026-01-26"
```

### 4. Fetch metadata
```bash
# List all supported states and UTs
curl https://india-holidays.pages.dev/api/meta/states

# List all holiday types
curl https://india-holidays.pages.dev/api/meta/types
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` or `/api` | API directory and service metadata |
| `GET` | `/api/health` | Health check and status |
| `GET` | `/api/meta/states` | List all 36 supported states and union territories with codes |
| `GET` | `/api/meta/types` | List all holiday classifications (`national`, `public`, `state`, `bank`, etc.) |
| `GET` | `/api/holidays/:year` | Get all national holidays for a given year (plus state holidays if `?state=XX` is passed) |
| `GET` | `/api/holidays/:year/:state` | Get holidays for a specific state code (e.g. `MH`, `DL`, `KA`, `TG`) |
| `GET` | `/api/holidays?year=&state=&type=&date=` | Dynamic search and filter across holiday datasets |

---

## 🔎 Query Parameters

| Parameter | Type | Description | Example |
|---|---|---|---|
| `year` | string | Year in `YYYY` format (default: current year) | `2026` |
| `state` | string | 2-letter ISO 3166-2:IN state code | `TG`, `MH`, `KA`, `DL` |
| `type` | string | Filter by holiday classification | `national`, `public`, `state`, `bank`, `regional`, `optional` |
| `date` | string | Filter by specific date (`YYYY-MM-DD`) | `2026-08-15` |

---

## 🏷️ Holiday Types

| Type | Description |
|---|---|
| `national` | Mandatory holidays observed across all of India (Republic Day, Independence Day, Gandhi Jayanti). |
| `public` | Gazetted holidays declared by the Central Government. |
| `state` | State-specific festivals and official state establishment days. |
| `bank` | Bank holidays as per Section 25 of the Negotiable Instruments Act (RBI). |
| `regional` | District or regional observances. |
| `optional` | Restricted holidays (employees may choose from list). |

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

## 📦 JSON Response Schema

### Single Holiday Object
```json
{
  "date": "2026-01-26",
  "name": "Republic Day",
  "type": "national",
  "state_code": "IN",
  "description": "Celebrates the adoption of the Constitution of India"
}
```

### Example Response (`GET /api/holidays/2026/TG`)
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
  },
  {
    "date": "2026-03-20",
    "name": "Ugadi",
    "type": "state",
    "state_code": "TG",
    "description": "Telugu New Year Day"
  },
  {
    "date": "2026-08-15",
    "name": "Independence Day",
    "type": "national",
    "state_code": "IN",
    "description": "Marks India's independence from British rule in 1947"
  },
  {
    "date": "2026-10-02",
    "name": "Gandhi Jayanti",
    "type": "national",
    "state_code": "IN",
    "description": "Birthday of Mahatma Gandhi, Father of the Nation"
  }
]
```

---

## 🏗️ Architecture & Deployment

```
┌──────────────────────────────┐
│ scripts/generate_holidays.py │ (Generates astronomical/gazetted calendar data)
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│  data/{year}/{state}.json    │ (Git-managed static JSON files)
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│      src/worker.js           │ (Cloudflare Worker routing & dynamic filtering)
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│   Cloudflare Edge Network    │ (Cached with Cache-Control: public, max-age=3600)
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│        API Consumers         │ (Sub-100ms response time)
└──────────────────────────────┘
```

---

## 💻 Local Development

### Prerequisites
- Node.js (v18+)
- Python 3.9+ (for running calendar generator / validator)
- Wrangler CLI (`npm install -g wrangler` or via local devDependencies)

### Installation & Testing
```bash
# 1. Clone the repository
git clone https://github.com/urunkarpm/holiday2api.git
cd holiday2api

# 2. Install dependencies
npm install

# 3. Run automated tests
npm test

# 4. Validate all data JSON files
npm run validate

# 5. Start local development server (Cloudflare Worker)
npm run dev
```

### Regenerating Holiday Data
To re-generate or extend the calendar data across all 36 states and union territories for years 2026–2036:
```bash
python scripts/generate_holidays.py
```

---

## 🤝 Contributing

Contributions and corrections are welcome!
1. Verify official state gazette circulars or RBI notifications.
2. Update/add the respective files under `data/{year}/{state}.json` or enhance `scripts/generate_holidays.py`.
3. Run `npm test` and `npm run validate`.
4. Open a Pull Request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).