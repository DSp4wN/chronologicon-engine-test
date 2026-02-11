# Chronologicon Engine - API Response Examples

> All responses captured from a live server running on `http://localhost:3000`

---

## 1. Health Check

**Request:**

```bash
curl http://localhost:3000/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-10T17:59:51.322Z"
}
```

---

## 2. Data Ingestion

### 2a. Ingest via JSON Body (file path)

**Request:**

```bash
curl -X POST http://localhost:3000/api/events/ingest \
  -H "Content-Type: application/json" \
  -d "{\"filePath\": \"./data/sample_historical_data.txt\"}"
```

**Response:**

```json
{
  "status": "Ingestion initiated",
  "jobId": "ingest-job-185ce2bf-d209-4678-9957-6039a939ccda",
  "message": "Check /api/events/ingestion-status/ingest-job-185ce2bf-d209-4678-9957-6039a939ccda for updates."
}
```

### 2b. Ingest via File Upload (multipart form)

**Request:**

```bash
curl -X POST http://localhost:3000/api/events/ingest \
  -F "file=@./data/sample_historical_data.txt"
```

**Response:**

```json
{
  "status": "Ingestion initiated",
  "jobId": "ingest-job-78fd56d8-4659-48ce-b02b-8c9f4f31c492",
  "message": "Check /api/events/ingestion-status/ingest-job-78fd56d8-4659-48ce-b02b-8c9f4f31c492 for updates."
}
```

---

## 3. Ingestion Status

**Request:**

```bash
curl http://localhost:3000/api/events/ingestion-status/ingest-job-78fd56d8-4659-48ce-b02b-8c9f4f31c492
```

**Response:**

```json
{
  "jobId": "ingest-job-78fd56d8-4659-48ce-b02b-8c9f4f31c492",
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
  "startTime": "2026-02-10T17:59:57.360Z",
  "endTime": "2026-02-10T17:59:57.361Z"
}
```

> ✅ 18 lines processed successfully, 4 malformed lines rejected with descriptive error messages.

---

## 4. Timeline (Hierarchical View)

**Request:**

```bash
curl http://localhost:3000/api/timeline/a1b2c3d4-e5f6-7890-1234-567890abcdef
```

**Response:**

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
      "description": "Early research on data fragmentation techniques.",
      "start_date": "2023-01-01T10:30:00.000Z",
      "end_date": "2023-01-01T11:00:00.000Z",
      "duration_minutes": 30,
      "parent_event_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "children": [
        {
          "event_id": "11223344-5566-7788-9900-aabbccddeeff",
          "event_name": "Internal Review Meeting",
          "description": "Reviewing initial research findings.",
          "start_date": "2023-01-01T10:45:00.000Z",
          "end_date": "2023-01-01T11:15:00.000Z",
          "duration_minutes": 30,
          "parent_event_id": "f7e6d5c4-b3a2-1098-7654-3210fedcba98",
          "children": []
        }
      ]
    },
    {
      "event_id": "5f6e7d8c-9a0b-1c2d-3e4f-5a6b7c8d9e0f",
      "event_name": "Analysis Phase Alpha",
      "description": "Detailed analysis of fragmented datasets.",
      "start_date": "2023-01-02T09:00:00.000Z",
      "end_date": "2023-01-02T12:00:00.000Z",
      "duration_minutes": 180,
      "parent_event_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "children": [
        {
          "event_id": "22334455-6677-8899-aabb-ccddeeff0011",
          "event_name": "Data Cataloging",
          "description": "Cataloging raw data sources for analysis.",
          "start_date": "2023-01-02T09:30:00.000Z",
          "end_date": "2023-01-02T10:30:00.000Z",
          "duration_minutes": 60,
          "parent_event_id": "5f6e7d8c-9a0b-1c2d-3e4f-5a6b7c8d9e0f",
          "children": []
        },
        {
          "event_id": "33445566-7788-9900-aabb-ccddeeff1122",
          "event_name": "Pattern Recognition Study",
          "description": "Studying patterns in corrupted data fragments.",
          "start_date": "2023-01-02T10:00:00.000Z",
          "end_date": "2023-01-02T11:30:00.000Z",
          "duration_minutes": 90,
          "parent_event_id": "5f6e7d8c-9a0b-1c2d-3e4f-5a6b7c8d9e0f",
          "children": []
        }
      ]
    },
    {
      "event_id": "44556677-8899-0011-aabb-ccddeeff2233",
      "event_name": "Temporal Alignment Test",
      "description": "Testing temporal alignment algorithms.",
      "start_date": "2023-01-03T08:00:00.000Z",
      "end_date": "2023-01-03T10:00:00.000Z",
      "duration_minutes": 120,
      "parent_event_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "children": [
        {
          "event_id": "55667788-9900-1122-aabb-ccddeeff3344",
          "event_name": "Algorithm Calibration",
          "description": "Calibrating alignment algorithms with test data.",
          "start_date": "2023-01-03T08:30:00.000Z",
          "end_date": "2023-01-03T09:30:00.000Z",
          "duration_minutes": 60,
          "parent_event_id": "44556677-8899-0011-aabb-ccddeeff2233",
          "children": []
        }
      ]
    }
  ]
}
```

> ✅ Returns a full hierarchical tree rooted at "Founding of ArchaeoData" with 3 levels of nested children.

**Visual tree:**

```
Founding of ArchaeoData (90 min)
├── Phase 1 Research (30 min)
│   └── Internal Review Meeting (30 min)
├── Analysis Phase Alpha (180 min)
│   ├── Data Cataloging (60 min)
│   └── Pattern Recognition Study (90 min)
└── Temporal Alignment Test (120 min)
    └── Algorithm Calibration (60 min)
```

---

## 5. Search Events

### 5a. Search by Name (with sorting & pagination)

**Request:**

```bash
curl "http://localhost:3000/api/events/search?name=phase&sortBy=start_date&sortOrder=asc&page=1&limit=5"
```

**Response:**

```json
{
  "totalEvents": 3,
  "page": 1,
  "limit": 5,
  "events": [
    {
      "event_id": "f7e6d5c4-b3a2-1098-7654-3210fedcba98",
      "event_name": "Phase 1 Research",
      "start_date": "2023-01-01T10:30:00.000Z",
      "end_date": "2023-01-01T11:00:00.000Z",
      "duration_minutes": 30,
      "description": "Early research on data fragmentation techniques.",
      "parent_event_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
    },
    {
      "event_id": "5f6e7d8c-9a0b-1c2d-3e4f-5a6b7c8d9e0f",
      "event_name": "Analysis Phase Alpha",
      "start_date": "2023-01-02T09:00:00.000Z",
      "end_date": "2023-01-02T12:00:00.000Z",
      "duration_minutes": 180,
      "description": "Detailed analysis of fragmented datasets.",
      "parent_event_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
    },
    {
      "event_id": "0d9e8f7a-6b5c-4d3e-2f1a-0b9c8d7e6f5a",
      "event_name": "Customer Onboarding Phase",
      "start_date": "2023-01-15T09:00:00.000Z",
      "end_date": "2023-01-18T17:00:00.000Z",
      "duration_minutes": 4800,
      "description": "Onboarding new enterprise customers.",
      "parent_event_id": null
    }
  ]
}
```

> ✅ 3 events matched the name "phase", sorted by `start_date` ascending.

### 5b. Search by Date Range

**Request:**

```bash
curl "http://localhost:3000/api/events/search?start_date_after=2023-01-05T00:00:00Z&end_date_before=2023-01-20T00:00:00Z"
```

**Response:**

```json
{
  "totalEvents": 4,
  "page": 1,
  "limit": 10,
  "events": [
    {
      "event_id": "9b8a7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
      "event_name": "Marketing Campaign Launch",
      "start_date": "2023-01-05T14:00:00.000Z",
      "end_date": "2023-01-10T16:00:00.000Z",
      "duration_minutes": 7320,
      "description": "Company-wide marketing campaign for Q1.",
      "parent_event_id": null
    },
    {
      "event_id": "77889900-1122-3344-aabb-ccddeeff5566",
      "event_name": "Stakeholder Presentation",
      "start_date": "2023-01-06T10:00:00.000Z",
      "end_date": "2023-01-06T11:30:00.000Z",
      "duration_minutes": 90,
      "description": "Presenting campaign strategy to stakeholders.",
      "parent_event_id": "9b8a7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d"
    },
    {
      "event_id": "88990011-2233-4455-aabb-ccddeeff6677",
      "event_name": "Digital Ads Rollout",
      "start_date": "2023-01-07T08:00:00.000Z",
      "end_date": "2023-01-09T18:00:00.000Z",
      "duration_minutes": 3480,
      "description": "Rolling out digital advertising across platforms.",
      "parent_event_id": "9b8a7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d"
    },
    {
      "event_id": "0d9e8f7a-6b5c-4d3e-2f1a-0b9c8d7e6f5a",
      "event_name": "Customer Onboarding Phase",
      "start_date": "2023-01-15T09:00:00.000Z",
      "end_date": "2023-01-18T17:00:00.000Z",
      "duration_minutes": 4800,
      "description": "Onboarding new enterprise customers.",
      "parent_event_id": null
    }
  ]
}
```

> ✅ 4 events found between Jan 5 and Jan 20, 2023.

---

## 6. Insights - Overlapping Events

**Request:**

```bash
curl "http://localhost:3000/api/insights/overlapping-events?startDate=2023-01-01T00:00:00Z&endDate=2023-01-05T00:00:00Z"
```

**Response:**

```json
[
  {
    "overlappingEventPairs": [
      {
        "event_id": "33445566-7788-9900-aabb-ccddeeff1122",
        "event_name": "Pattern Recognition Study",
        "start_date": "2023-01-02T10:00:00.000Z",
        "end_date": "2023-01-02T11:30:00.000Z"
      },
      {
        "event_id": "5f6e7d8c-9a0b-1c2d-3e4f-5a6b7c8d9e0f",
        "event_name": "Analysis Phase Alpha",
        "start_date": "2023-01-02T09:00:00.000Z",
        "end_date": "2023-01-02T12:00:00.000Z"
      }
    ],
    "overlap_duration_minutes": 90
  },
  {
    "overlappingEventPairs": [
      {
        "event_id": "22334455-6677-8899-aabb-ccddeeff0011",
        "event_name": "Data Cataloging",
        "start_date": "2023-01-02T09:30:00.000Z",
        "end_date": "2023-01-02T10:30:00.000Z"
      },
      {
        "event_id": "5f6e7d8c-9a0b-1c2d-3e4f-5a6b7c8d9e0f",
        "event_name": "Analysis Phase Alpha",
        "start_date": "2023-01-02T09:00:00.000Z",
        "end_date": "2023-01-02T12:00:00.000Z"
      }
    ],
    "overlap_duration_minutes": 60
  },
  {
    "overlappingEventPairs": [
      {
        "event_id": "44556677-8899-0011-aabb-ccddeeff2233",
        "event_name": "Temporal Alignment Test",
        "start_date": "2023-01-03T08:00:00.000Z",
        "end_date": "2023-01-03T10:00:00.000Z"
      },
      {
        "event_id": "55667788-9900-1122-aabb-ccddeeff3344",
        "event_name": "Algorithm Calibration",
        "start_date": "2023-01-03T08:30:00.000Z",
        "end_date": "2023-01-03T09:30:00.000Z"
      }
    ],
    "overlap_duration_minutes": 60
  },
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
  },
  {
    "overlappingEventPairs": [
      {
        "event_id": "22334455-6677-8899-aabb-ccddeeff0011",
        "event_name": "Data Cataloging",
        "start_date": "2023-01-02T09:30:00.000Z",
        "end_date": "2023-01-02T10:30:00.000Z"
      },
      {
        "event_id": "33445566-7788-9900-aabb-ccddeeff1122",
        "event_name": "Pattern Recognition Study",
        "start_date": "2023-01-02T10:00:00.000Z",
        "end_date": "2023-01-02T11:30:00.000Z"
      }
    ],
    "overlap_duration_minutes": 30
  },
  {
    "overlappingEventPairs": [
      {
        "event_id": "11223344-5566-7788-9900-aabbccddeeff",
        "event_name": "Internal Review Meeting",
        "start_date": "2023-01-01T10:45:00.000Z",
        "end_date": "2023-01-01T11:15:00.000Z"
      },
      {
        "event_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
        "event_name": "Founding of ArchaeoData",
        "start_date": "2023-01-01T10:00:00.000Z",
        "end_date": "2023-01-01T11:30:00.000Z"
      }
    ],
    "overlap_duration_minutes": 30
  },
  {
    "overlappingEventPairs": [
      {
        "event_id": "11223344-5566-7788-9900-aabbccddeeff",
        "event_name": "Internal Review Meeting",
        "start_date": "2023-01-01T10:45:00.000Z",
        "end_date": "2023-01-01T11:15:00.000Z"
      },
      {
        "event_id": "f7e6d5c4-b3a2-1098-7654-3210fedcba98",
        "event_name": "Phase 1 Research",
        "start_date": "2023-01-01T10:30:00.000Z",
        "end_date": "2023-01-01T11:00:00.000Z"
      }
    ],
    "overlap_duration_minutes": 15
  }
]
```

> ✅ 7 overlapping pairs found, sorted by overlap duration descending (90 min → 15 min).

**Summary Table:**

| Event A | Event B | Overlap |
|---|---|---|
| Pattern Recognition Study | Analysis Phase Alpha | 90 min |
| Data Cataloging | Analysis Phase Alpha | 60 min |
| Temporal Alignment Test | Algorithm Calibration | 60 min |
| Founding of ArchaeoData | Phase 1 Research | 30 min |
| Data Cataloging | Pattern Recognition Study | 30 min |
| Internal Review Meeting | Founding of ArchaeoData | 30 min |
| Internal Review Meeting | Phase 1 Research | 15 min |

---

## 7. Insights - Temporal Gaps

**Request:**

```bash
curl "http://localhost:3000/api/insights/temporal-gaps?startDate=2023-01-01T00:00:00Z&endDate=2023-02-10T00:00:00Z"
```

**Response:**

```json
{
  "largestGap": {
    "startOfGap": "2023-01-25T17:00:00.000Z",
    "endOfGap": "2023-02-01T09:00:00.000Z",
    "durationMinutes": 9600,
    "precedingEvent": {
      "event_id": "c8d7e6f5-a4b3-2109-8765-4321fedcba98",
      "event_name": "Pilot Project Alpha",
      "end_date": "2023-01-25T17:00:00.000Z"
    },
    "succeedingEvent": {
      "event_id": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
      "event_name": "Project Gaia Initiation",
      "start_date": "2023-02-01T09:00:00.000Z"
    }
  },
  "message": "Largest temporal gap identified."
}
```

> ✅ Largest gap: **6 days 16 hours (9,600 minutes)** between "Pilot Project Alpha" ending and "Project Gaia Initiation" starting.

---

## 8. Insights - Event Influence (Shortest Temporal Path)

### 8a. Path Exists

**Request:**

```bash
curl "http://localhost:3000/api/insights/event-influence?sourceEventId=d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a&targetEventId=c6d7e8f9-a0b1-c2d3-e4f5-a6b7c8d9e0f1"
```

**Response:**

```json
{
  "sourceEventId": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
  "targetEventId": "c6d7e8f9-a0b1-c2d3-e4f5-a6b7c8d9e0f1",
  "shortestPath": [
    {
      "event_id": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
      "event_name": "Project Gaia Initiation",
      "duration_minutes": 60
    },
    {
      "event_id": "a4b5c6d7-e8f9-a0b1-c2d3-e4f5a6b7c8d9",
      "event_name": "Algorithm Development",
      "duration_minutes": 480
    },
    {
      "event_id": "b5c6d7e8-f9a0-b1c2-d3e4-f5a6b7c8d9e0",
      "event_name": "Model Training",
      "duration_minutes": 960
    },
    {
      "event_id": "c6d7e8f9-a0b1-c2d3-e4f5-a6b7c8d9e0f1",
      "event_name": "Deployment Planning",
      "duration_minutes": 180
    }
  ],
  "totalDurationMinutes": 1680,
  "message": "Shortest temporal path found from source to target event."
}
```

> ✅ Path found across 4 events totaling **28 hours (1,680 minutes)**.

**Visual path:**

```
Project Gaia Initiation (60 min)
  → Algorithm Development (480 min)
    → Model Training (960 min)
      → Deployment Planning (180 min)

Total: 1,680 minutes
```

### 8b. No Path Exists

**Request:**

```bash
curl "http://localhost:3000/api/insights/event-influence?sourceEventId=9b8a7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d&targetEventId=c8d7e6f5-a4b3-2109-8765-4321fedcba98"
```

**Response:**

```json
{
  "sourceEventId": "9b8a7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
  "targetEventId": "c8d7e6f5-a4b3-2109-8765-4321fedcba98",
  "shortestPath": [],
  "totalDurationMinutes": 0,
  "message": "No temporal path found from source to target event."
}
```

> ✅ Correctly reports no temporal path between "Marketing Campaign Launch" and "Pilot Project Alpha".

