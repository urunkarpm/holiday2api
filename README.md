# India Holidays API

[![Validate JSON](https://github.com/yourusername/india-holidays-api/actions/workflows/validate-json.yml/badge.svg)](https://github.com/yourusername/india-holidays-api/actions/workflows/validate-json.yml)
[![Deploy](https://github.com/yourusername/india-holidays-api/actions/workflows/deploy.yml/badge.svg)](https://github.com/yourusername/india-holidays-api/actions/workflows/deploy.yml)

A free, fast, and reliable API for Indian holidays. No authentication required. No rate limits.

## Features

- ✅ **Free**: Zero cost hosting via Cloudflare Pages
- ✅ **Fast**: Sub-100ms response times via CDN edge caching
- ✅ **Reliable**: 99.9% uptime through static file serving
- ✅ **Simple**: RESTful JSON endpoints, no auth required
- ✅ **Timezone-aware**: All dates use Asia/Kolkata (IST/UTC+5:30)

## Quick Start

### Get all national holidays for 2024
```bash
curl https://india-holidays.pages.dev/api/holidays/2024
```

### Get holidays for a specific state
```bash
curl https://india-holidays.pages.dev/api/holidays/2024/MH
```

### Filter by query parameters
```bash
curl "https://india-holidays.pages.dev/api/holidays?year=2024&state=KA&type=public"
```

### Get supported states
```bash
curl https://india-holidays.pages.dev/api/meta/states
```

### Get holiday types
```bash
curl https://india-holidays.pages.dev/api/meta/types
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/holidays/:year` | Get all holidays for a year (national + optional state) |
| `GET /api/holidays/:year/:state` | Get holidays for a specific state |
| `GET /api/holidays?year=&state=&type=&date=` | Filter holidays by query params |
| `GET /api/meta/states` | List all supported states and union territories |
| `GET /api/meta/types` | List all holiday types |
| `GET /` | API information and available endpoints |

## Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `year` | Filter by year (YYYY format) | `2024` |
| `state` | Filter by state code (ISO 3166-2:IN) | `MH`, `KA`, `DL` |
| `type` | Filter by holiday type | `national`, `public`, `state`, `bank` |
| `date` | Filter by specific date | `2024-01-26` |

## Holiday Types

| Type | Description |
|------|-------------|
| `national` | Mandatory holidays observed across India |
| `public` | Gazetted holidays declared by Central Government |
| `state` | State-specific holidays |
| `bank` | RBI declared bank holidays |
| `regional` | District/city-specific observances |
| `optional` | Restricted holidays (optional for employers) |

## Supported States (MVP)

- **National**: IN (All India)
- **Major States**: MH (Maharashtra), KA (Karnataka), TN (Tamil Nadu), DL (Delhi), UP (Uttar Pradesh), WB (West Bengal), GJ (Gujarat)
- **All 28 states + 8 Union Territories** supported via `/api/meta/states`

## Response Format

### Holiday Object
```json
{
  "date": "2024-01-26",
  "name": "Republic Day",
  "type": "national",
  "state_code": "IN",
  "description": "Celebrates the adoption of the Constitution of India"
}
```

### Example Response
```json
[
  {
    "date": "2024-01-26",
    "name": "Republic Day",
    "type": "national",
    "state_code": "IN",
    "description": "Celebrates the adoption of the Constitution of India"
  },
  {
    "date": "2024-08-15",
    "name": "Independence Day",
    "type": "national",
    "state_code": "IN",
    "description": "Marks India's independence from British rule in 1947"
  }
]
```

## Data Update Frequency

- **Annual**: Main holiday lists updated at year start
- **Ad-hoc**: Government notifications within 48 hours
- **Source**: Ministry of Personnel, RBI, State Government circulars

## Deployment Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ GitHub Repo │────▶│ GitHub Actions│────▶│ Cloudflare    │
│ /data/*.json│     │ Validate &    │     │ Pages (CDN)   │
│ /src/*.js   │     │ Deploy        │     │               │
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                  │
                                                  ▼
                                         ┌───────────────┐
                                         │ Global CDN    │
                                         │ Edge Cached   │
                                         └───────┬───────┘
                                                 │
                                                 ▼
                                        ┌───────────────┐
                                        │ API Consumers │
                                        └───────────────┘
```

## Local Development

### Prerequisites
- Node.js 20+
- Wrangler CLI (`npm install -g wrangler`)

### Run Locally
```bash
# Install dependencies
npm install

# Start local development server
wrangler dev

# Test endpoints
curl http://localhost:8787/api/holidays/2024
```

### Add New Holiday Data
1. Create/edit JSON files in `data/{year}/{state}.json`
2. Run validation: `python3 -m json.tool data/2024/MH.json`
3. Commit and push to trigger deployment

## Contributing

Contributions welcome! Please ensure:
1. JSON files are valid (run validation workflow)
2. Dates follow YYYY-MM-DD format
3. State codes match ISO 3166-2:IN
4. Sources are official government notifications

## License

MIT License - Free for commercial and personal use

## Data Sources

- Ministry of Personnel, Public Grievances and Pensions
- Reserve Bank of India (RBI)
- State Government Official Notifications