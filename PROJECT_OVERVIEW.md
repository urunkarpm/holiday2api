# India Holidays API - Project Overview

## Problem Statement
Developers and organizations need accurate, free, and reliable access to Indian holiday data (national, state, bank, and regional) without depending on paid APIs or complex database infrastructure. Existing solutions often lack granularity for Indian states, require authentication, or impose rate limits/costs.

## Target Users
- Frontend/backend developers building calendars, scheduling apps, or HR systems
- Data analysts processing business days vs holidays
- Government/civic tech projects requiring public holiday data
- Open-source contributors maintaining India-focused applications

## API Goals
- **Free**: Zero cost for hosting and data access
- **Fast**: Sub-100ms response times via CDN-edge caching
- **Reliable**: 99.9% uptime through static file serving
- **Simple**: RESTful endpoints with JSON responses, no authentication required
- **Maintainable**: Automated updates via GitHub Actions, static JSON data files
- **Timezone-aware**: All date logic uses Asia/Kolkata (IST/UTC+5:30)

## Non-Goals
- User authentication or API keys
- Real-time holiday creation/modification APIs
- Support for countries other than India
- Historical data prior to 2020 (unless easily available)
- Complex query languages (GraphQL, SQL-like filters)
- Paid tier or premium features

## Free Deployment Constraints
- **Hosting**: Cloudflare Pages (static JSON) or Cloudflare Workers (dynamic routes)
- **Storage**: Git-managed static JSON files only; no databases
- **CI/CD**: GitHub Actions for automated builds and data updates
- **Bandwidth**: Leverage Cloudflare's free tier (100k requests/day on Workers, unlimited on Pages)
- **Build Time**: Keep GitHub Actions under free tier limits (<2000 min/month)

## Supported Holiday Types
| Type | Description | Source |
|------|-------------|--------|
| `national` | Republic Day, Independence Day, Gandhi Jayanti | Govt of India |
| `public` | Nationwide public holidays (varies by year) | Ministry of Personnel |
| `state` | State-specific holidays (e.g., Ugadi, Pongal, Onam) | State Govt Notifications |
| `bank` | RBI declared bank holidays | Reserve Bank of India |
| `regional` | District/city-specific observances | Local administration |
| `optional` | Restricted/Gazetted holidays (optional for employers) | Central Govt List |

## Supported Regions
- **National**: All India
- **States**: All 28 states + 8 Union Territories
  - Major states: Maharashtra, Karnataka, Tamil Nadu, Kerala, Andhra Pradesh, Telangana, Gujarat, Rajasthan, Uttar Pradesh, Bihar, West Bengal, Madhya Pradesh, Punjab, Haryana, Delhi, etc.
- **Granularity**: Data tagged by state code (ISO 3166-2:IN) and optional district codes

## Supported Years
- **Range**: 2020–2030 (initial release)
- **Extension**: Easily extendable via annual GitHub Actions update workflow
- **Data Freshness**: Updated within 48 hours of official government notifications

## High-Level Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Data Sources  │────▶│  GitHub Repo     │────▶│  GitHub Actions │
│ (Govt Websites, │     │  /data/*.json    │     │  (Build &       │
│  RBI, CSVs)     │     │                  │     │   Deploy)       │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌──────────────────┐
                                                 │  Cloudflare Pages│
                                                 │  (Static JSON)   │
                                                 │  OR              │
                                                 │  Cloudflare Workers│
                                                 │  (Route Handling)│
                                                 └────────┬─────────┘
                                                          │
                                                          ▼
                                                 ┌──────────────────┐
                                                 │   Global CDN     │
                                                 │   (Edge Cached)  │
                                                 └────────┬─────────┘
                                                          │
                                                          ▼
                                                 ┌──────────────────┐
                                                 │   API Consumers  │
                                                 │   GET /holidays? │
                                                 │   year=2025&     │
                                                 │   state=MH       │
                                                 └──────────────────┘
```

### Data Flow
1. **Source**: Official holiday lists scraped/collected manually or via scripts
2. **Storage**: Static JSON files in `/data/{year}/{state}.json` structure
3. **Automation**: GitHub Actions validates JSON, merges updates, triggers deploy
4. **Deployment**: Cloudflare Pages serves `/data` directory directly
5. **Routing** (Optional): Cloudflare Worker adds query param filtering (`?state=KA&type=bank`)
6. **Delivery**: CDN caches responses globally; cache invalidates on new commits

### API Endpoints (Proposed)
```
GET /holidays                    # All holidays (current year, national)
GET /holidays?year=2025          # Filter by year
GET /holidays?state=MH           # Filter by state code
GET /holidays?type=bank          # Filter by holiday type
GET /holidays?date=2025-01-26    # Get holidays on specific date
GET /years                       # List available years
GET /states                      # List supported state codes
```

### File Structure
```
/
├── data/
│   ├── 2024/
│   │   ├── national.json
│   │   ├── MH.json
│   │   ├── KA.json
│   │   └── ...
│   └── 2025/
├── src/
│   └── worker.js (optional Cloudflare Worker for routing)
├── .github/
│   └── workflows/
│       ├── validate-json.yml
│       └── auto-update.yml
├── package.json
├── wrangler.toml (if using Workers)
└── README.md
```

---
**Status**: Ready for implementation  
**License**: MIT (Open Data encouraged)  
**Maintenance**: Community-driven with automated validation
