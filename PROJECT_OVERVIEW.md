# India Holidays API - Project Overview

## Problem Statement
Developers, fintech services, HRMS platforms, calendar applications, and analytics teams need fast, free, and reliable programmatic access to Indian holiday calendars across central gazetted, state-specific, and RBI bank schedules without authentication or rate limit constraints.

## Key Capabilities & Highlights
- **13-Year Historical & Future Dataset**: Complete coverage from **2024 to 2036**.
- **All 36 Regional Jurisdictions**: 28 Indian States + 8 Union Territories + National (All India).
- **Sub-100ms CDN Responses**: Edge-cached across Cloudflare and Vercel.
- **Long Weekend Planner**: Computes natural 3-day weekends and 4-day bridge weekends with strategic leave tips.
- **iCalendar (.ics) Subscriptions**: RFC 5545 calendar export for Google Calendar, Apple Calendar, and Microsoft Outlook.
- **Business Days Calculator**: Working days engine supporting standard workweeks and RBI Bank rules (2nd/4th Saturdays off).
- **OpenAPI 3.0.3 Standard**: Ready for SDK generation and Postman collection import.
- **Built-in Web Playground UI**: Interactive visual API explorer at root domain `/`.

## Supported Regional State Codes (ISO 3166-2:IN)
- **National**: `IN`
- **States**: `AP`, `AR`, `AS`, `BR`, `CT`, `GA`, `GJ`, `HR`, `HP`, `JH`, `KA`, `KL`, `MP`, `MH`, `MN`, `ML`, `MZ`, `NL`, `OR`, `PB`, `RJ`, `SK`, `TN`, `TG`, `TR`, `UP`, `UT`, `WB`
- **Union Territories**: `AN`, `CH`, `DN`, `DL`, `JK`, `LA`, `LD`, `PY`

## Deployment Targets
- **Cloudflare Workers**: Deployable via `wrangler deploy` or GitHub Actions.
- **Vercel**: Deployable via `vercel --prod` or 1-click GitHub connection.
