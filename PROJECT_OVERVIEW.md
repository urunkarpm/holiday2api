# India Holidays API - Project Overview

## Problem Statement
Developers, enterprise HRMS platforms, payroll engines, fintech applications, and data analysts need fast, free, and accurate access to Indian holiday schedules (National, State-specific gazetted holidays, RBI bank holidays, and regional festivals) without relying on paywalled services, complex database infrastructures, or rate-limited endpoints.

Indian holidays vary significantly across 28 states and 8 Union Territories due to regional calendars, astronomical lunar calculations (Hindu, Islamic, Sikh, Jain, Buddhist), and independent state government notifications.

## Target Users
- **Frontend & Mobile Developers**: Calendar widgets, date-pickers, travel booking interfaces, event planners.
- **Fintech & Banking Systems**: Settlement day calculations, trading day validation, RBI holiday compliance.
- **HRMS & Payroll Platforms**: Attendance management, working day computations, leave planning.
- **Data Analysts & Civic Tech**: Business metrics normalization, public sector tracking.

## Key Design Principles & Goals
- **100% Free**: Zero subscription or API key barriers for end users.
- **Sub-100ms Latency**: Edge-cached responses globally via Cloudflare CDN.
- **High Reliability (99.9%+)**: Static-first JSON architecture with zero database dependencies.
- **Timezone Native**: Standardized on Indian Standard Time (`Asia/Kolkata`, `IST` / `UTC+5:30`).
- **Granular Coverage**: Covers national holidays and all 36 Indian administrative jurisdictions.
- **Extensible & Maintainable**: Pre-calculated static datasets with automated GitHub Actions continuous delivery.

## Non-Goals
- User authentication, token issuance, or paid tiers.
- Real-time user holiday creation/CRUD operations (this is a read-only authoritative dataset).
- International/non-Indian holiday coverage.
- Complex graph or ad-hoc SQL querying over the wire.

## Technical Architecture

### 1. Data Generation (`scripts/generate_holidays.py`)
- Calculates lunar, solar, and astronomical tithis alongside gazetted notifications.
- Outputs clean, schema-validated JSON files partitioned by year and ISO 3166-2:IN state codes into `data/{year}/{state}.json`.

### 2. Edge Routing (`src/worker.js`)
- Cloudflare Worker runtime routing incoming requests.
- Reads static assets via Cloudflare's `env.ASSETS` binding.
- Performs runtime dynamic combining (e.g. combining national holidays with state-specific files for a unified state holiday list).
- Applies query filtering (`type`, `date`, `state`), sorts events chronologically, and handles CORS preflights.

### 3. Edge CDN & Caching
- Every successful JSON response is tagged with `Cache-Control: public, max-age=3600`.
- Cache invalidates instantly upon new code or data deployment via Cloudflare Pages / Workers.

## Supported Holiday Types
| Type | Description | Primary Sources |
|---|---|---|
| `national` | Republic Day, Independence Day, Gandhi Jayanti | Government of India |
| `public` | Central Government Gazetted Holidays | Ministry of Personnel, Public Grievances & Pensions |
| `state` | State-specific festivals and state formation days | Official State Government Gazettes |
| `bank` | Holidays under the Negotiable Instruments Act, 1881 | Reserve Bank of India (RBI) |
| `regional` | District or regional observances | Local district administrations |
| `optional` | Restricted holidays that employees can choose to observe | Central/State Government circulars |

## Supported Regions (All 36 States & UTs)
- **National**: `IN` (All India)
- **28 States**: `AP`, `AR`, `AS`, `BR`, `CT`, `GA`, `GJ`, `HR`, `HP`, `JH`, `KA`, `KL`, `MP`, `MH`, `MN`, `ML`, `MZ`, `NL`, `OR`, `PB`, `RJ`, `SK`, `TN`, `TG`, `TR`, `UP`, `UT`, `WB`
- **8 Union Territories**: `AN`, `CH`, `DN`, `DL`, `JK`, `LA`, `LD`, `PY`

## Supported Years
- Current range: **2024** and **2026–2036**.
- Extended dynamically using `scripts/generate_holidays.py`.

## Directory Structure
```
holiday2api/
├── .github/
│   └── workflows/
│       ├── validate-json.yml     # Validates JSON files on PRs and pushes
│       └── deploy.yml            # Deploys Worker to Cloudflare
├── data/
│   ├── meta/
│   │   ├── states.json           # All 36 states + UTs metadata
│   │   └── types.json            # Holiday types taxonomy
│   ├── 2024/                     # Pre-generated holiday JSON files
│   ├── 2026/
│   └── 2027-2036/
├── scripts/
│   └── generate_holidays.py      # Holiday calendar generator script
├── src/
│   └── worker.js                 # Cloudflare Worker API router
├── test/
│   └── worker.test.js            # Automated endpoint & routing test suite
├── package.json                  # Scripts & devDependencies
├── wrangler.toml                 # Cloudflare Worker configuration
├── API_DESIGN.md                 # Complete REST API specification
├── PROJECT_OVERVIEW.md           # Project architecture & goals overview
└── README.md                     # Main user guide and documentation
```

## Current Status
- ✅ Core API worker fully implemented in `src/worker.js`.
- ✅ Complete test suite verified in `test/worker.test.js`.
- ✅ Data generated for all 36 states across 2024 and 2026–2036.
- ✅ Full CI validation scripts configured.
