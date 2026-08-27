# India Holidays API - REST API Design Specification

## Overview

This document defines the REST API endpoints for the India Holidays API. The API provides access to Indian holiday data including national, state, bank, and regional holidays.

**Base URL**: `https://india-holidays.pages.dev/api`

**Timezone**: All dates use Asia/Kolkata (IST/UTC+5:30)

**Authentication**: None required

**Rate Limits**: None (free tier)

---

## Common Response Headers

```http
Content-Type: application/json
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=3600
```

---

## Endpoints

### 1. Health Check

Check if the API is operational.

**HTTP Method**: `GET`  
**Path**: `/health` or `/api/health`

**Query Parameters**: None

**Example Request**:
```bash
curl https://india-holidays.pages.dev/api/health
```

**Success Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00+05:30",
  "version": "1.0.0",
  "timezone": "Asia/Kolkata"
}
```

**Error Responses**: None expected for health check

---

### 2. Get Holidays by Year

Retrieve all holidays for a specific year (includes national holidays and optionally state holidays).

**HTTP Method**: `GET`  
**Path**: `/holidays/:year` or `/holidays/:year.json`

**Query Parameters**:
| Parameter | Type   | Required | Description                          | Example |
|-----------|--------|----------|--------------------------------------|---------|
| `state`   | string | No       | Filter by state code (ISO 3166-2:IN) | `MH`, `KA` |
| `type`    | string | No       | Filter by holiday type               | `national`, `bank` |

**Example Requests**:
```bash
# Get all holidays for 2024 (national only by default)
curl https://india-holidays.pages.dev/api/holidays/2024

# Get holidays for 2024 including Maharashtra state holidays
curl https://india-holidays.pages.dev/api/holidays/2024?state=MH

# Get only national holidays for 2024
curl https://india-holidays.pages.dev/api/holidays/2024?type=national

# Get only bank holidays for 2024 in Karnataka
curl https://india-holidays.pages.dev/api/holidays/2024?state=KA&type=bank
```

**Success Response** (200 OK):
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
  },
  {
    "date": "2024-04-14",
    "name": "Dr. Ambedkar Jayanti",
    "type": "state",
    "state_code": "MH",
    "description": "Birth anniversary of Dr. B.R. Ambedkar"
  }
]
```

**Error Responses**:

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 Bad Request | `{"error": "Invalid year format. Use YYYY format."}` | Year parameter is not a valid 4-digit year |
| 404 Not Found | `{"error": "No data available for year 2010"}` | Requested year has no holiday data |
| 400 Bad Request | `{"error": "Invalid state code: XX"}` | State code is not recognized |
| 500 Internal Server Error | `{"error": "Failed to load holidays for 2024: <details>"}` | Server error loading data |

---

### 3. Get Holidays by Year and State

Retrieve holidays for a specific year and state (includes both national and state-specific holidays).

**HTTP Method**: `GET`  
**Path**: `/holidays/:year/:state` or `/holidays/:year/:state.json`

**Path Parameters**:
| Parameter | Type   | Required | Description                          | Example |
|-----------|--------|----------|--------------------------------------|---------|
| `year`    | string | Yes      | Year in YYYY format                  | `2024`  |
| `state`   | string | Yes      | State code (ISO 3166-2:IN)           | `MH`, `KA`, `DL` |

**Query Parameters**:
| Parameter | Type   | Required | Description            | Example |
|-----------|--------|----------|------------------------|---------|
| `type`    | string | No       | Filter by holiday type | `national`, `state`, `bank` |

**Example Requests**:
```bash
# Get all holidays for Maharashtra in 2024
curl https://india-holidays.pages.dev/api/holidays/2024/MH

# Get all holidays for Delhi in 2024
curl https://india-holidays.pages.dev/api/holidays/2024/DL

# Get only state-specific holidays for Karnataka in 2024
curl https://india-holidays.pages.dev/api/holidays/2024/KA?type=state

# Get national holidays only for Tamil Nadu in 2024
curl https://india-holidays.pages.dev/api/holidays/2024/TN?type=national
```

**Success Response** (200 OK):
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
    "date": "2024-03-25",
    "name": "Gudi Padwa",
    "type": "state",
    "state_code": "MH",
    "description": "Maharashtra New Year"
  },
  {
    "date": "2024-04-14",
    "name": "Dr. Ambedkar Jayanti",
    "type": "state",
    "state_code": "MH",
    "description": "Birth anniversary of Dr. B.R. Ambedkar"
  },
  {
    "date": "2024-05-01",
    "name": "Maharashtra Day",
    "type": "state",
    "state_code": "MH",
    "description": "Commemorates the formation of Maharashtra state"
  }
]
```

**Error Responses**:

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 Bad Request | `{"error": "Invalid year format. Use YYYY format."}` | Year parameter is not a valid 4-digit year |
| 400 Bad Request | `{"error": "Invalid state code: XX. Use ISO 3166-2:IN codes."}` | State code is not recognized |
| 404 Not Found | `{"error": "No data available for year 2010"}` | Requested year has no holiday data |
| 404 Not Found | `{"error": "No data available for state XX in year 2024"}` | State data not available for requested year |
| 500 Internal Server Error | `{"error": "Failed to load holidays for 2024/MH: <details>"}` | Server error loading data |

---

### 4. Get Holidays by Year and Type

Retrieve holidays filtered by year and holiday type.

**HTTP Method**: `GET`  
**Path**: `/holidays` (with query parameters)

**Query Parameters**:
| Parameter | Type   | Required | Description                          | Example |
|-----------|--------|----------|--------------------------------------|---------|
| `year`    | string | Yes      | Year in YYYY format                  | `2024`  |
| `type`    | string | Yes      | Holiday type                         | `national`, `public`, `state`, `bank`, `regional`, `optional` |
| `state`   | string | No       | Filter by state code                 | `MH`, `KA` |

**Example Requests**:
```bash
# Get all national holidays for 2024
curl https://india-holidays.pages.dev/api/holidays?year=2024&type=national

# Get all bank holidays for 2024
curl https://india-holidays.pages.dev/api/holidays?year=2024&type=bank

# Get all state holidays for Karnataka in 2024
curl https://india-holidays.pages.dev/api/holidays?year=2024&type=state&state=KA

# Get all optional holidays for 2024
curl https://india-holidays.pages.dev/api/holidays?year=2024&type=optional
```

**Success Response** (200 OK):
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
  },
  {
    "date": "2024-10-02",
    "name": "Gandhi Jayanti",
    "type": "national",
    "state_code": "IN",
    "description": "Birthday of Mahatma Gandhi, Father of the Nation"
  }
]
```

**Error Responses**:

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 Bad Request | `{"error": "Missing required parameter: year"}` | Year parameter not provided |
| 400 Bad Request | `{"error": "Missing required parameter: type"}` | Type parameter not provided |
| 400 Bad Request | `{"error": "Invalid year format. Use YYYY format."}` | Year parameter is not a valid 4-digit year |
| 400 Bad Request | `{"error": "Invalid holiday type: xyz. Valid types: national, public, state, bank, regional, optional"}` | Unrecognized holiday type |
| 400 Bad Request | `{"error": "Invalid state code: XX"}` | State code is not recognized |
| 404 Not Found | `{"error": "No data available for year 2010"}` | Requested year has no holiday data |
| 500 Internal Server Error | `{"error": "Failed to load holidays: <details>"}` | Server error loading data |

---

### 5. Get Holiday by Date

Retrieve holidays occurring on a specific date.

**HTTP Method**: `GET`  
**Path**: `/holidays` (with date query parameter)

**Query Parameters**:
| Parameter | Type   | Required | Description                          | Example |
|-----------|--------|----------|--------------------------------------|---------|
| `date`    | string | Yes      | Date in YYYY-MM-DD format            | `2024-01-26` |
| `year`    | string | No       | Year (can be inferred from date)     | `2024`  |
| `state`   | string | No       | Filter by state code                 | `MH`, `KA` |

**Example Requests**:
```bash
# Get holidays on Republic Day 2024
curl https://india-holidays.pages.dev/api/holidays?date=2024-01-26

# Get holidays on a specific date in Maharashtra
curl https://india-holidays.pages.dev/api/holidays?date=2024-04-14&state=MH

# Get holidays on Diwali 2024
curl https://india-holidays.pages.dev/api/holidays?date=2024-10-31
```

**Success Response** (200 OK):
```json
[
  {
    "date": "2024-01-26",
    "name": "Republic Day",
    "type": "national",
    "state_code": "IN",
    "description": "Celebrates the adoption of the Constitution of India"
  }
]
```

**Note**: Returns an empty array `[]` if no holidays exist on the specified date.

**Error Responses**:

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 Bad Request | `{"error": "Missing required parameter: date"}` | Date parameter not provided |
| 400 Bad Request | `{"error": "Invalid date format. Use YYYY-MM-DD format."}` | Date is not in correct format |
| 400 Bad Request | `{"error": "Invalid date: 2024-02-30"}` | Date is not a valid calendar date |
| 400 Bad Request | `{"error": "Invalid state code: XX"}` | State code is not recognized |
| 500 Internal Server Error | `{"error": "Failed to load holidays: <details>"}` | Server error loading data |

---

### 6. Get List of States

Retrieve all supported states and union territories with their codes.

**HTTP Method**: `GET`  
**Path**: `/meta/states` or `/meta/states.json`

**Query Parameters**: None

**Example Request**:
```bash
curl https://india-holidays.pages.dev/api/meta/states
```

**Success Response** (200 OK):
```json
{
  "states": [
    {
      "code": "IN",
      "name": "National",
      "type": "national"
    },
    {
      "code": "AN",
      "name": "Andaman and Nicobar Islands",
      "type": "union_territory"
    },
    {
      "code": "AP",
      "name": "Andhra Pradesh",
      "type": "state"
    },
    {
      "code": "DL",
      "name": "Delhi",
      "type": "union_territory"
    },
    {
      "code": "KA",
      "name": "Karnataka",
      "type": "state"
    },
    {
      "code": "MH",
      "name": "Maharashtra",
      "type": "state"
    },
    {
      "code": "TN",
      "name": "Tamil Nadu",
      "type": "state"
    }
    // ... more states
  ],
  "timezone": "Asia/Kolkata",
  "last_updated": "2025-01-01T00:00:00+05:30"
}
```

**Error Responses**:

| Status Code | Error | Description |
|-------------|-------|-------------|
| 500 Internal Server Error | `{"error": "Failed to load states: <details>"}` | Server error loading data |

---

### 7. Get List of Holiday Types

Retrieve all supported holiday types with descriptions.

**HTTP Method**: `GET`  
**Path**: `/meta/types` or `/meta/types.json`

**Query Parameters**: None

**Example Request**:
```bash
curl https://india-holidays.pages.dev/api/meta/types
```

**Success Response** (200 OK):
```json
{
  "types": [
    {
      "id": "national",
      "name": "National Holiday",
      "description": "Mandatory holidays observed across all India (Republic Day, Independence Day, Gandhi Jayanti)"
    },
    {
      "id": "public",
      "name": "Public Holiday",
      "description": "Gazetted holidays declared by the Central Government"
    },
    {
      "id": "state",
      "name": "State Holiday",
      "description": "Holidays specific to a particular state or union territory"
    },
    {
      "id": "bank",
      "name": "Bank Holiday",
      "description": "Holidays when banks are closed as per RBI guidelines"
    },
    {
      "id": "regional",
      "name": "Regional Holiday",
      "description": "District or city-specific observances"
    },
    {
      "id": "optional",
      "name": "Optional/Restricted Holiday",
      "description": "Restricted holidays that employees can choose to avail"
    }
  ],
  "timezone": "Asia/Kolkata",
  "last_updated": "2025-01-01T00:00:00+05:30"
}
```

**Error Responses**:

| Status Code | Error | Description |
|-------------|-------|-------------|
| 500 Internal Server Error | `{"error": "Failed to load types: <details>"}` | Server error loading data |

---

## Summary Table

| Endpoint | HTTP Method | Path | Description |
|----------|-------------|------|-------------|
| Health Check | GET | `/api/health` | Check API status |
| Holidays by Year | GET | `/api/holidays/:year` | Get all holidays for a year |
| Holidays by Year & State | GET | `/api/holidays/:year/:state` | Get holidays for year and state |
| Holidays by Filters | GET | `/api/holidays` | Get holidays with query filters |
| Holiday by Date | GET | `/api/holidays?date=YYYY-MM-DD` | Get holidays on specific date |
| List States | GET | `/api/meta/states` | Get all supported states |
| List Types | GET | `/api/meta/types` | Get all holiday types |

---

## Query Parameter Combinations

The `/api/holidays` endpoint supports multiple query parameter combinations:

| Parameters | Description | Example |
|------------|-------------|---------|
| `year` + `type` | Get holidays by year and type | `?year=2024&type=national` |
| `year` + `state` | Get holidays by year and state | `?year=2024&state=MH` |
| `year` + `type` + `state` | Get holidays by year, type, and state | `?year=2024&type=state&state=KA` |
| `date` | Get holidays on specific date | `?date=2024-01-26` |
| `date` + `state` | Get holidays on date in specific state | `?date=2024-04-14&state=MH` |

---

## Holiday Object Schema

```typescript
interface Holiday {
  date: string;        // ISO 8601 date format: YYYY-MM-DD
  name: string;        // Name of the holiday
  type: string;        // Holiday type: national, public, state, bank, regional, optional
  state_code: string;  // ISO 3166-2:IN state code (e.g., "IN", "MH", "KA")
  description: string; // Brief description of the holiday
}
```

---

## Error Response Format

All errors follow a consistent JSON format:

```json
{
  "error": "Human-readable error message"
}
```

HTTP status codes indicate the type of error:
- `400 Bad Request`: Invalid or missing parameters
- `404 Not Found`: Resource not found
- `405 Method Not Allowed`: Unsupported HTTP method
- `500 Internal Server Error`: Server-side error

---

## CORS Support

All endpoints support Cross-Origin Resource Sharing (CORS) for browser-based applications:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 86400
```

For preflight requests, send an `OPTIONS` request to any endpoint.

---

## Caching

Responses include cache headers for optimal performance:

```http
Cache-Control: public, max-age=3600
```

This allows CDN and browser caching for up to 1 hour. Cache is invalidated automatically when new data is deployed.

---

## Rate Limiting

**No rate limiting** is enforced. The API is free to use without authentication. However, please be considerate and implement client-side caching to reduce unnecessary requests.

---

## Versioning

Current API version: **1.0.0**

Version information is included in:
- Health check endpoint response
- Root endpoint response (`/` or `/api`)

Breaking changes will increment the major version number and be documented in release notes.
