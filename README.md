# Chronologicon Engine

**ArchaeoData Inc. — Unearthing History, Reconstructing Timelines**

A robust Node.js backend service for ingesting, managing, and querying historical event data to reconstruct and analyze complete timelines. Includes the **Temporal Gap Finder** and **Event Influence Spreader** insight engines.

---

### 📚 Quick Navigation

| Document | Description |
|----------|-------------|
| 📖 [**Get Started Guide**](GET_STARTED.md) | Step-by-step setup, run, and test every endpoint |
| 📝 [**API Response Examples**](API_RESPONSES.md) | Real response payloads captured from a live server |
| 🧠 [**Concepts & Formulas**](CONCEPTS.md) | Deep dive into every algorithm, data structure, and formula used |

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Setup Instructions](#setup-instructions)
3. [Database Setup](#database-setup)
4. [Running the Application](#running-the-application)
5. [API Documentation](#api-documentation)
6. [Sample Data](#sample-data)
7. [Design Decisions](#design-decisions)

---

## Tech Stack

| Component | Choice | Reasoning |
|-----------|--------|-----------|
| **Runtime** | Node.js | Event-driven, non-blocking I/O — ideal for async file ingestion and concurrent API requests |
| **Framework** | Express.js | Battle-tested, minimal, largest middleware ecosystem |
| **Database** | PostgreSQL | Native JSONB, TIMESTAMPTZ, recursive CTEs, generated columns, trigram indexes |
| **Query Builder** | Knex.js | SQL-level control for recursive CTEs and self-joins; migrations, connection pooling, parameterized queries |
| **Validation** | Joi | Declarative schema validation with clear error messages |
| **Logging** | Winston | Structured logging with levels, timestamps, JSON format |
| **File Upload** | Multer | Standard Express middleware for multipart/form-data |

---

## Setup Instructions

### Prerequisites

- **Node.js** v18+ (v20 recommended)
- **PostgreSQL** v14+ (for `GENERATED ALWAYS AS ... STORED` support)
- **npm** or **yarn**

### 1. Install Dependencies

```bash
cd chronologicon-engine
npm install
```

### 2. Configure Environment

Copy the example env file and edit as needed:

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

### 3. Database Setup

Create the database and run the schema:

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE chronologicon;"

# Run the DDL script
psql -U postgres -d chronologicon -f db/schema.sql
```

### 4. Start the Server

```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

The server starts on `http://localhost:3000`. Verify with:

```bash
curl http://localhost:3000/health
```

---

## API Documentation

### Base URL: `http://localhost:3000`

---

### 1. POST /api/events/ingest

**Initiates async file ingestion.** Returns a job ID for status tracking.

**Option A — JSON body with server file path:**

```bash
curl -X POST http://localhost:3000/api/events/ingest \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./data/sample_historical_data.txt"}'
```

**Option B — File upload (multipart/form-data):**

```bash
curl -X POST http://localhost:3000/api/events/ingest \
  -F "file=@./data/sample_historical_data.txt"
```

**Response (202 Accepted):**

```json
{
  "status": "Ingestion initiated",
  "jobId": "ingest-job-12345-abcde",
  "message": "Check /api/events/ingestion-status/ingest-job-12345-abcde for updates."
}
```

---

### 2. GET /api/events/ingestion-status/:jobId

**Check ingestion job progress.**

```bash
curl http://localhost:3000/api/events/ingestion-status/ingest-job-12345-abcde
```

**Response (200 OK):**

```json
{
  "jobId": "ingest-job-12345-abcde",
  "status": "COMPLETED",
  "processedLines": 18,
  "errorLines": 4,
  "totalLines": 22,
  "errors": [
    "Line 19: Invalid UUID for event_id: 'malformed-id-1'",
    "Line 20: Invalid date format for start_date of event '99001122-3344-5566-aabb-ccddeeff7788': '2023/01/03 10:00'"
  ],
  "startTime": "2023-06-25T10:00:00Z",
  "endTime": "2023-06-25T10:00:02Z"
}
```

---

### 3. GET /api/timeline/:rootEventId

**Returns the full hierarchical timeline** as nested JSON, including all descendants.

```bash
curl http://localhost:3000/api/timeline/a1b2c3d4-e5f6-7890-1234-567890abcdef
```

**Response (200 OK):**

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
      "children": [...]
    }
  ]
}
```

---

### 4. GET /api/events/search

**Search events** with filters, pagination, and sorting.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | — | Partial match (case-insensitive) |
| `start_date_after` | ISO 8601 | — | Events starting after this date |
| `end_date_before` | ISO 8601 | — | Events ending before this date |
| `sortBy` | string | `start_date` | `start_date`, `end_date`, `event_name`, `duration_minutes` |
| `sortOrder` | string | `asc` | `asc` or `desc` |
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Results per page (max 100) |

```bash
# Search by name
curl "http://localhost:3000/api/events/search?name=phase&sortBy=start_date&sortOrder=asc&page=1&limit=5"

# Search by date range
curl "http://localhost:3000/api/events/search?start_date_after=2023-01-05T00:00:00Z&end_date_before=2023-01-20T00:00:00Z"
```

**Response (200 OK):**

```json
{
  "totalEvents": 2,
  "page": 1,
  "limit": 5,
  "events": [
    {
      "event_id": "f7e6d5c4-b3a2-1098-7654-3210fedcba98",
      "event_name": "Phase 1 Research"
    }
  ]
}
```

---

### 5. GET /api/insights/overlapping-events

**Find all event pairs with overlapping timeframes** within a date range.

```bash
curl "http://localhost:3000/api/insights/overlapping-events?startDate=2023-01-01T00:00:00Z&endDate=2023-01-05T00:00:00Z"
```

**Response (200 OK):**

```json
[
  {
    "overlappingEventPairs": [
      {
        "event_id": "a1b2c3d4-...",
        "event_name": "Founding of ArchaeoData",
        "start_date": "2023-01-01T10:00:00.000Z",
        "end_date": "2023-01-01T11:30:00.000Z"
      },
      {
        "event_id": "f7e6d5c4-...",
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

### 6. GET /api/insights/temporal-gaps

**Find the largest temporal gap** (period with no recorded events) within a date range.

```bash
curl "http://localhost:3000/api/insights/temporal-gaps?startDate=2023-01-01T00:00:00Z&endDate=2023-01-20T00:00:00Z"
```

**Response (200 OK — gap found):**

```json
{
  "largestGap": {
    "startOfGap": "2023-01-10T16:00:00.000Z",
    "endOfGap": "2023-01-15T09:00:00.000Z",
    "durationMinutes": 6780,
    "precedingEvent": {
      "event_id": "9b8a7c6d-...",
      "event_name": "Marketing Campaign Launch",
      "end_date": "2023-01-10T16:00:00.000Z"
    },
    "succeedingEvent": {
      "event_id": "0d9e8f7a-...",
      "event_name": "Customer Onboarding Phase",
      "start_date": "2023-01-15T09:00:00.000Z"
    }
  },
  "message": "Largest temporal gap identified."
}
```

---

### 7. GET /api/insights/event-influence

**Shortest temporal path** (minimum total duration) between two events following parent-child relationships. Uses Dijkstra's algorithm.

```bash
curl "http://localhost:3000/api/insights/event-influence?sourceEventId=d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a&targetEventId=c6d7e8f9-a0b1-c2d3-e4f5-a6b7c8d9e0f1"
```

**Response (200 OK — path found):**

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

**Response (200 OK — no path):**

```json
{
  "sourceEventId": "...",
  "targetEventId": "...",
  "shortestPath": [],
  "totalDurationMinutes": 0,
  "message": "No temporal path found from source to target event."
}
```

---

## Sample Data

The file `data/sample_historical_data.txt` contains 22 lines:

- **18 valid events** forming multiple hierarchies (Founding branch, Marketing branch, Project Gaia branch, standalone events)
- **4 malformed lines** to test error handling (invalid UUID, invalid date format, empty ID, missing fields)

---

## Design Decisions

### Architecture: Controller → Service → Model

Follows the layered architecture pattern for separation of concerns:
- **Controllers** handle HTTP request parsing and response formatting
- **Services** contain business logic, algorithms, and orchestration
- **Models** handle database queries via Knex

This enables unit testing services independently, swapping database layer without touching business logic, and adding alternative interfaces (CLI, GraphQL) that reuse services.

### Database: PostgreSQL with Knex.js

- **`GENERATED ALWAYS AS ... STORED`** for `duration_minutes` — guarantees consistency with `start_date`/`end_date`, computed once on write, O(1) reads
- **`TIMESTAMPTZ`** — timezone-aware timestamps stored in UTC
- **`JSONB`** over JSON — binary storage enables GIN indexing and efficient querying
- **`ON DELETE SET NULL`** for parent FK — prevents cascading deletes from wiping history branches
- **`CHECK (end_date >= start_date)`** — database-level defense against invalid data
- **Trigram GIN index** on `event_name` — enables fast `ILIKE '%term%'` searches without sequential scans

### File Ingestion: Stream-Based with Batch Inserts

- `readline` + `createReadStream` processes files line-by-line in **constant O(1) memory**
- Batch inserts (500 rows/transaction) reduce DB round trips by ~100x vs individual inserts
- Async processing (HTTP 202) — client doesn't block waiting for large file processing
- In-memory job store tracks progress; in production, would use Redis/Bull for persistence

### Algorithms

- **Timeline (Recursive CTE)** — single SQL query for tree traversal, O(n) tree construction in app code
- **Overlapping Events (Self-Join)** — `a.event_id < b.event_id` ensures distinct pairs; overlap = `LEAST(end) - GREATEST(start)`
- **Temporal Gaps (Sweep Line)** — O(n log n) sort + O(n) scan; tracks coverage frontier
- **Event Influence (Dijkstra)** — weighted shortest path with binary min-heap priority queue; bidirectional parent↔child edges

### Security

- Parameterized queries via Knex (SQL injection prevention)
- Whitelisted `sortBy` columns (ORDER BY injection prevention)
- Joi schema validation on all inputs
- File size limits on uploads (100MB max)

