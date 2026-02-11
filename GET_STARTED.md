# Get Started - Chronologicon Engine

A step-by-step guide to set up, run, and test every API endpoint.

---

## Prerequisites

- **Node.js** v18+ (v20 recommended)
- **PostgreSQL** v14+ (for `GENERATED ALWAYS AS ... STORED` support)
- **npm** or **yarn**

---

## 1. Install Dependencies

```bash
cd chronologicon-engine
npm install
```

---

## 2. Configure Environment

Create a `.env` file in the project root (or copy the example):

```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials:

```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chronologicon
DB_USER=postgres
DB_PASSWORD=your_password_here
```

---

## 3. Set Up the Database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE chronologicon;"

# Run the DDL schema script
psql -U postgres -d chronologicon -f db/schema.sql
```

This creates the `historical_events` table with all columns, indexes, and constraints.

---

## 4. Start the Server

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

You should see:

```
✅ Database connected successfully
🚀 Chronologicon Engine running on http://localhost:3000
```

Verify the server is running:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-02-10T12:00:00.000Z"
}
```

---

## 5. Test All API Endpoints

Once the server is running, open a **separate terminal** and run through these commands in order.

---

### ① POST /api/events/ingest - Ingest Sample Data

**Option A - JSON body with server file path:**

```bash
curl -X POST http://localhost:3000/api/events/ingest \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./data/sample_historical_data.txt"}'
```

**Option B - File upload (multipart/form-data):**

```bash
curl -X POST http://localhost:3000/api/events/ingest \
  -F "file=@./data/sample_historical_data.txt"
```

**Expected response (202 Accepted):**

```json
{
  "status": "Ingestion initiated",
  "jobId": "ingest-job-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "message": "Check /api/events/ingestion-status/ingest-job-... for updates."
}
```

> 📌 **Copy the `jobId`** - you'll need it for the next step.

---

### ② GET /api/events/ingestion-status/:jobId - Check Ingestion Progress

Replace `<jobId>` with the value from step ①:

```bash
curl http://localhost:3000/api/events/ingestion-status/<jobId>
```

**Expected response (200 OK):**

```json
{
  "jobId": "ingest-job-...",
  "status": "COMPLETED",
  "processedLines": 18,
  "errorLines": 4,
  "totalLines": 23,
  "errors": [
    "Line 19: Invalid UUID for event_id: 'malformed-id-1'",
    "Line 20: Invalid date format for start_date of event '99001122-3344-5566-aabb-ccddeeff7788': '2023/01/03 10:00'",
    "Line 21: Invalid UUID for event_id: ''",
    "Line 22: Malformed entry (expected 6 fields, got 3): 'aabbccdd-eeff-0011-2233-445566778899|Missing Fields Event|2023-01-04T10:00:00Z'"
  ],
  "startTime": "2026-02-10T12:00:00.000Z",
  "endTime": "2026-02-10T12:00:00.050Z"
}
```

---

### ③ GET /api/timeline/:rootEventId - Hierarchical Timeline

```bash
curl http://localhost:3000/api/timeline/a1b2c3d4-e5f6-7890-1234-567890abcdef
```

**Expected response (200 OK):**

```json
{
  "event_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "event_name": "Founding of ArchaeoData",
  "description": "Initial establishment of the company, focusing on data salvage.",
  "start_date": "2023-01-01T10:00:00.000Z",
  "end_date": "2023-01-01T11:30:00.000Z",
  "duration_minutes": 90,
  "parent_event_id": null,
  "children": [
    {
      "event_id": "f7e6d5c4-b3a2-1098-7654-3210fedcba98",
      "event_name": "Phase 1 Research",
      "children": [
        {
          "event_id": "11223344-5566-7788-9900-aabbccddeeff",
          "event_name": "Internal Review Meeting",
          "children": []
        }
      ]
    }
  ]
}
```

---

### ④ GET /api/events/search - Search Events

**Search by name (partial, case-insensitive):**

```bash
curl "http://localhost:3000/api/events/search?name=phase&sortBy=start_date&sortOrder=asc&page=1&limit=5"
```

**Search by date range:**

```bash
curl "http://localhost:3000/api/events/search?start_date_after=2023-01-05T00:00:00Z&end_date_before=2023-01-20T00:00:00Z"
```

**Expected response (200 OK):**

```json
{
  "totalEvents": 2,
  "page": 1,
  "limit": 5,
  "events": [
    {
      "event_id": "f7e6d5c4-b3a2-1098-7654-3210fedcba98",
      "event_name": "Phase 1 Research",
      "start_date": "2023-01-01T10:30:00.000Z",
      "end_date": "2023-01-01T11:00:00.000Z",
      "duration_minutes": 30
    }
  ]
}
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | - | Partial match (case-insensitive) |
| `start_date_after` | ISO 8601 | - | Events starting after this date |
| `end_date_before` | ISO 8601 | - | Events ending before this date |
| `sortBy` | string | `start_date` | `start_date`, `end_date`, `event_name`, `duration_minutes` |
| `sortOrder` | string | `asc` | `asc` or `desc` |
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Results per page (max 100) |

---

### ⑤ GET /api/insights/overlapping-events - Find Overlapping Event Pairs

```bash
curl "http://localhost:3000/api/insights/overlapping-events?startDate=2023-01-01T00:00:00Z&endDate=2023-01-05T00:00:00Z"
```

**Expected response (200 OK):**

```json
[
  {
    "overlappingEventPairs": [
      {
        "event_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
        "event_name": "Founding of ArchaeoData",
        "start_date": "2023-01-01T10:00:00.000Z",
        "end_date": "2023-01-01T11:30:00.000Z"
      },
      {
        "event_id": "f7e6d5c4-b3a2-1098-7654-3210fedcba98",
        "event_name": "Phase 1 Research",
        "start_date": "2023-01-01T10:30:00.000Z",
        "end_date": "2023-01-01T11:00:00.000Z"
      }
    ],
    "overlap_duration_minutes": 30
  }
]
```

---

### ⑥ GET /api/insights/temporal-gaps - Find Largest Temporal Gap

```bash
curl "http://localhost:3000/api/insights/temporal-gaps?startDate=2023-01-01T00:00:00Z&endDate=2023-02-10T00:00:00Z"
```

**Expected response - Gap found (200 OK):**

```json
{
  "largestGap": {
    "startOfGap": "2023-01-10T16:00:00.000Z",
    "endOfGap": "2023-01-15T09:00:00.000Z",
    "durationMinutes": 6780,
    "precedingEvent": {
      "event_id": "9b8a7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
      "event_name": "Marketing Campaign Launch",
      "end_date": "2023-01-10T16:00:00.000Z"
    },
    "succeedingEvent": {
      "event_id": "0d9e8f7a-6b5c-4d3e-2f1a-0b9c8d7e6f5a",
      "event_name": "Customer Onboarding Phase",
      "start_date": "2023-01-15T09:00:00.000Z"
    }
  },
  "message": "Largest temporal gap identified."
}
```

---

### ⑦ GET /api/insights/event-influence - Shortest Temporal Path (Dijkstra's)

**Scenario 1 - Path exists:**

```bash
curl "http://localhost:3000/api/insights/event-influence?sourceEventId=d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a&targetEventId=c6d7e8f9-a0b1-c2d3-e4f5-a6b7c8d9e0f1"
```

**Expected response (200 OK):**

```json
{
  "sourceEventId": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
  "targetEventId": "c6d7e8f9-a0b1-c2d3-e4f5-a6b7c8d9e0f1",
  "shortestPath": [
    { "event_id": "d1e2f3a4-...", "event_name": "Project Gaia Initiation", "duration_minutes": 60 },
    { "event_id": "a4b5c6d7-...", "event_name": "Algorithm Development", "duration_minutes": 480 },
    { "event_id": "b5c6d7e8-...", "event_name": "Model Training", "duration_minutes": 960 },
    { "event_id": "c6d7e8f9-...", "event_name": "Deployment Planning", "duration_minutes": 180 }
  ],
  "totalDurationMinutes": 1680,
  "message": "Shortest temporal path found from source to target event."
}
```

**Scenario 2 - No path (different branches):**

```bash
curl "http://localhost:3000/api/insights/event-influence?sourceEventId=9b8a7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d&targetEventId=c8d7e6f5-a4b3-2109-8765-4321fedcba98"
```

**Expected response (200 OK):**

```json
{
  "sourceEventId": "9b8a7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
  "targetEventId": "c8d7e6f5-a4b3-2109-8765-4321fedcba98",
  "shortestPath": [],
  "totalDurationMinutes": 0,
  "message": "No temporal path found from source to target event."
}
```

---

## 6. Run the Test Suite

Tests use mocked database calls - **no PostgreSQL needed** to run them.

```bash
# Run all tests
npm test

# Run with coverage report
npx jest --coverage
```

**Expected output:**

```
Test Suites: 4 passed, 4 total
Tests:       69 passed, 69 total
```

| Test File | What It Covers |
|---|---|
| `tests/unit/lineParser.test.js` | UUID validation, ISO date validation, line parsing (valid/malformed/blank) |
| `tests/unit/timelineService.test.js` | Tree building from flat events (1-level, 2-level, 3-level, edge cases) |
| `tests/unit/insightService.test.js` | Temporal gap finder (sweep line), Dijkstra's shortest path |
| `tests/integration/api.test.js` | All 7 API endpoints + health check + 404 handling |

---

## 7. Run the Linter

```bash
npm run lint
```

---

## Quick Reference - All Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/events/ingest` | Ingest historical data file |
| GET | `/api/events/ingestion-status/:jobId` | Check ingestion job progress |
| GET | `/api/timeline/:rootEventId` | Get hierarchical timeline |
| GET | `/api/events/search` | Search events with filters |
| GET | `/api/insights/overlapping-events` | Find overlapping event pairs |
| GET | `/api/insights/temporal-gaps` | Find largest temporal gap |
| GET | `/api/insights/event-influence` | Shortest path between events |

