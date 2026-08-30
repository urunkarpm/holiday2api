# India Holidays API - REST API Design Specification

## 1. Overview

This document specifies the REST API design for the **India Holidays API**. The API provides public access to Indian holiday data including national, gazetted, state-specific, bank, and restricted holidays across all 28 Indian States and 8 Union Territories.

- **Base URL**: `https://india-holidays.pages.dev/api`
- **Timezone**: `Asia/Kolkata` (`IST` / `UTC+5:30`)
- **Authentication**: None (open public API)
- **Rate Limits**: None (unlimited CDN edge-cached requests)
- **Protocol**: HTTP/1.1 and HTTP/2 over TLS (HTTPS)

---

## 2. Common HTTP Response Headers

Every successful API response returns standard CORS and caching headers:

```http
Content-Type: application/json
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 86400
Cache-Control: public, max-age=3600
```

---

## 3. Data Schemas

### 3.1 Holiday Object

```typescript
interface Holiday {
  date: string;        // ISO 8601 calendar date format: "YYYY-MM-DD"
  name: string;        // Official name of the holiday
  type: HolidayType;   // Holiday classification
  state_code: string;  // "IN" for national, or 2-letter ISO 3166-2:IN state code
  description: string; // Brief description or significance
}

type HolidayType = 
  | "national"  // Mandatory national holidays (Republic Day, Independence Day, Gandhi Jayanti)
  | "public"    // Central Government Gazetted holidays
  | "state"     // State-specific celebrations and state formation days
  | "bank"      // Negotiable Instruments Act bank holidays declared by RBI
  | "regional"  // Local / district level observances
  | "optional"; // Restricted / optional holidays
```

### 3.2 State Metadata Object

```typescript
interface StateMetadata {
  code: string;        // 2-letter ISO 3166-2:IN code (e.g. "TG", "MH", "KA", "DL", "IN")
  name: string;        // Full name of State or Union Territory
  type: "national" | "state" | "union_territory";
}
```

---

## 4. Endpoints

### 4.1 Service & Health Check

#### API Root
Returns API discovery metadata and list of available endpoints.

- **Method**: `GET`
- **Path**: `/` or `/api`
- **Example Request**:
  ```bash
  curl https://india-holidays.pages.dev/api
  ```
- **Response (200 OK)**:
  ```json
  {
    "name": "India Holidays API",
    "version": "1.0.0",
    "description": "Free, fast, reliable API for Indian holidays",
    "timezone": "Asia/Kolkata",
    "endpoints": {
      "GET /api/holidays/:year": "Get all holidays for a year",
      "GET /api/holidays/:year/:state": "Get holidays for a specific state",
      "GET /api/holidays?year=&state=&type=&date=": "Filter holidays by query params",
      "GET /api/meta/states": "List supported states",
      "GET /api/meta/types": "List holiday types",
      "GET /api/health": "Health check status"
    }
  }
  ```

#### Health Check
- **Method**: `GET`
- **Path**: `/api/health` or `/health`
- **Example Request**:
  ```bash
  curl https://india-holidays.pages.dev/api/health
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-08-30T09:15:00.000Z",
    "version": "1.0.0",
    "timezone": "Asia/Kolkata"
  }
  ```

---

### 4.2 Metadata Endpoints

#### List Supported States & Union Territories
- **Method**: `GET`
- **Path**: `/api/meta/states`
- **Example Request**:
  ```bash
  curl https://india-holidays.pages.dev/api/meta/states
  ```
- **Response (200 OK)**:
  ```json
  {
    "states": [
      {
        "code": "IN",
        "name": "National",
        "type": "national"
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
        "code": "MH",
        "name": "Maharashtra",
        "type": "state"
      },
      {
        "code": "TG",
        "name": "Telangana",
        "type": "state"
      }
    ],
    "timezone": "Asia/Kolkata",
    "last_updated": "2026-01-01T00:00:00+05:30"
  }
  ```

#### List Holiday Classifications
- **Method**: `GET`
- **Path**: `/api/meta/types`
- **Example Request**:
  ```bash
  curl https://india-holidays.pages.dev/api/meta/types
  ```
- **Response (200 OK)**:
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
    "last_updated": "2026-01-01T00:00:00+05:30"
  }
  ```

---

### 4.3 Holiday Data Endpoints

#### Get Holidays by Year
Retrieves national holidays for a given year. If the `?state=` query parameter is supplied, it automatically includes that state's holidays.

- **Method**: `GET`
- **Path**: `/api/holidays/:year`
- **Path Parameters**:
  - `year` (string, required): 4-digit year (e.g. `2026`).
- **Query Parameters**:
  - `state` (string, optional): 2-letter ISO 3166-2:IN code (e.g. `MH`, `KA`, `TG`).
  - `type` (string, optional): Filter by holiday type (e.g. `national`, `public`, `state`, `bank`).
  - `date` (string, optional): Filter by specific date in `YYYY-MM-DD` format.
- **Example Request**:
  ```bash
  curl https://india-holidays.pages.dev/api/holidays/2026
  ```
- **Response (200 OK)**:
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

#### Get Holidays by Year and State
Retrieves combined national and state-specific holidays for a specific region.

- **Method**: `GET`
- **Path**: `/api/holidays/:year/:state`
- **Path Parameters**:
  - `year` (string, required): 4-digit year (`2026`).
  - `state` (string, required): 2-letter state code (e.g., `TG`, `MH`, `KA`, `DL`, `TN`, `WB`).
- **Query Parameters**:
  - `type` (string, optional): Filter by holiday type (`national`, `state`, `bank`, `public`, `optional`).
  - `date` (string, optional): Filter by date `YYYY-MM-DD`.
- **Example Request**:
  ```bash
  curl https://india-holidays.pages.dev/api/holidays/2026/TG
  ```
- **Response (200 OK)**:
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
    }
  ]
  ```

---

#### Query Holidays with Filters
Dynamic search endpoint that accepts any combination of query parameters.

- **Method**: `GET`
- **Path**: `/api/holidays`
- **Query Parameters**:
  - `year` (string, optional, defaults to current year): e.g. `2026`
  - `state` (string, optional): e.g. `MH`, `KA`, `DL`
  - `type` (string, optional): e.g. `national`, `public`, `state`, `bank`
  - `date` (string, optional): e.g. `2026-01-26`
- **Example Requests**:
  ```bash
  # Filter by state and type
  curl "https://india-holidays.pages.dev/api/holidays?year=2026&state=MH&type=state"

  # Find if a particular date is a holiday
  curl "https://india-holidays.pages.dev/api/holidays?year=2026&date=2026-01-26"
  ```

---

## 5. Error Handling

Errors return JSON responses with appropriate HTTP status codes:

```json
{
  "error": "Detailed description of error"
}
```

| HTTP Status | Reason | Example |
|---|---|---|
| `404 Not Found` | Unknown route or no data found for specified year/state | `{"error": "No holiday data found for year: 1999"}` |
| `405 Method Not Allowed` | Non-GET/OPTIONS request method used | `{"error": "Method not allowed"}` |
| `500 Internal Server Error` | Unexpected worker exception | `{"error": "Failed to parse data"}` |

---

## 6. Supported Regional State Codes Reference

| Code | State / UT Name | Category | Code | State / UT Name | Category |
|---|---|---|---|---|---|
| `IN` | National (All India) | National | `LD` | Lakshadweep | Union Territory |
| `AN` | Andaman and Nicobar Islands | Union Territory | `MP` | Madhya Pradesh | State |
| `AP` | Andhra Pradesh | State | `MH` | Maharashtra | State |
| `AR` | Arunachal Pradesh | State | `MN` | Manipur | State |
| `AS` | Assam | State | `ML` | Meghalaya | State |
| `BR` | Bihar | State | `MZ` | Mizoram | State |
| `CH` | Chandigarh | Union Territory | `NL` | Nagaland | State |
| `CT` | Chhattisgarh | State | `OR` | Odisha | State |
| `DN` | Dadra & Nagar Haveli and Daman & Diu | Union Territory | `PY` | Puducherry | Union Territory |
| `DL` | Delhi | Union Territory | `PB` | Punjab | State |
| `GA` | Goa | State | `RJ` | Rajasthan | State |
| `GJ` | Gujarat | State | `SK` | Sikkim | State |
| `HR` | Haryana | State | `TN` | Tamil Nadu | State |
| `HP` | Himachal Pradesh | State | `TG` | Telangana | State |
| `JK` | Jammu and Kashmir | Union Territory | `TR` | Tripura | State |
| `JH` | Jharkhand | State | `UP` | Uttar Pradesh | State |
| `KA` | Karnataka | State | `UT` | Uttarakhand | State |
| `KL` | Kerala | State | `WB` | West Bengal | State |
| `LA` | Ladakh | Union Territory | | | |
