/**
 * Integration tests for all 7 API endpoints.
 *
 * These tests mock the database layer (eventModel) to test the full
 * Controller → Service → (mocked) Model flow without a real database.
 */

jest.mock('../../src/models/eventModel', () => ({
  batchInsert: jest.fn(),
  getById: jest.fn(),
  getSubtree: jest.fn(),
  getAncestors: jest.fn(),
  search: jest.fn(),
  findOverlappingEvents: jest.fn(),
  getEventsInRange: jest.fn(),
  getAllForGraph: jest.fn(),
}));

const request = require('supertest');
const app = require('../../src/app');
const eventModel = require('../../src/models/eventModel');
const { createJob, updateJob } = require('../../src/utils/jobStore');

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /api/events/ingest
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/events/ingest', () => {
  test('returns 202 with jobId when given a valid filePath', async () => {
    // Use the actual sample data file
    const res = await request(app)
      .post('/api/events/ingest')
      .send({ filePath: './data/sample_historical_data.txt' });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('Ingestion initiated');
    expect(res.body.jobId).toBeDefined();
    expect(res.body.message).toContain('/api/events/ingestion-status/');
  });

  test('returns 400 when no file or filePath provided', async () => {
    const res = await request(app)
      .post('/api/events/ingest')
      .send({});

    expect(res.status).toBe(400);
  });

  test('returns 400 when file does not exist', async () => {
    const res = await request(app)
      .post('/api/events/ingest')
      .send({ filePath: './nonexistent/file.txt' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('File not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/events/ingestion-status/:jobId
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/events/ingestion-status/:jobId', () => {
  test('returns 200 with job status for a valid jobId', async () => {
    // Create a job first
    const job = createJob();
    updateJob(job.jobId, { status: 'COMPLETED', processedLines: 10, totalLines: 12 });

    const res = await request(app).get(`/api/events/ingestion-status/${job.jobId}`);

    expect(res.status).toBe(200);
    expect(res.body.jobId).toBe(job.jobId);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.processedLines).toBe(10);
  });

  test('returns 404 for non-existent jobId', async () => {
    const res = await request(app).get('/api/events/ingestion-status/nonexistent-job-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/timeline/:rootEventId
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/timeline/:rootEventId', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with nested timeline for a valid root event', async () => {
    const rootId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
    const childId = 'f7e6d5c4-b3a2-1098-7654-3210fedcba98';

    eventModel.getSubtree.mockResolvedValue([
      {
        event_id: rootId,
        event_name: 'Root Event',
        description: 'Root.',
        start_date: '2023-01-01T10:00:00.000Z',
        end_date: '2023-01-01T11:30:00.000Z',
        duration_minutes: 90,
        parent_event_id: null,
      },
      {
        event_id: childId,
        event_name: 'Child Event',
        description: 'Child.',
        start_date: '2023-01-01T10:30:00.000Z',
        end_date: '2023-01-01T11:00:00.000Z',
        duration_minutes: 30,
        parent_event_id: rootId,
      },
    ]);

    const res = await request(app).get(`/api/timeline/${rootId}`);

    expect(res.status).toBe(200);
    expect(res.body.event_id).toBe(rootId);
    expect(res.body.event_name).toBe('Root Event');
    expect(res.body.children).toHaveLength(1);
    expect(res.body.children[0].event_id).toBe(childId);
  });

  test('returns 404 for non-existent event', async () => {
    eventModel.getSubtree.mockResolvedValue([]);

    const res = await request(app).get('/api/timeline/a1b2c3d4-e5f6-7890-1234-567890abcdef');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  test('returns 400 for invalid UUID format in params', async () => {
    const res = await request(app).get('/api/timeline/not-a-valid-uuid');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/events/search
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/events/search', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with paginated search results', async () => {
    eventModel.search.mockResolvedValue({
      totalEvents: 2,
      events: [
        { event_id: 'evt-1', event_name: 'Phase 1 Research' },
        { event_id: 'evt-2', event_name: 'Analysis Phase Alpha' },
      ],
    });

    const res = await request(app).get(
      '/api/events/search?name=phase&sortBy=start_date&sortOrder=asc&page=1&limit=5'
    );

    expect(res.status).toBe(200);
    expect(res.body.totalEvents).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
    expect(res.body.events).toHaveLength(2);
  });

  test('returns 200 with default pagination when no params given', async () => {
    eventModel.search.mockResolvedValue({ totalEvents: 0, events: [] });

    const res = await request(app).get('/api/events/search');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
  });

  test('returns 200 with date range filter', async () => {
    eventModel.search.mockResolvedValue({ totalEvents: 1, events: [{ event_id: 'evt-1' }] });

    const res = await request(app).get(
      '/api/events/search?start_date_after=2023-01-05T00:00:00Z&end_date_before=2023-01-10T23:59:59Z'
    );

    expect(res.status).toBe(200);
    expect(eventModel.search).toHaveBeenCalledWith(
      expect.objectContaining({
        startDateAfter: expect.stringContaining('2023-01-05'),
        endDateBefore: expect.stringContaining('2023-01-10'),
      })
    );
  });

  test('returns 400 for invalid sortBy column', async () => {
    const res = await request(app).get('/api/events/search?sortBy=malicious_column');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /api/insights/overlapping-events
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/insights/overlapping-events', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with overlapping event pairs', async () => {
    eventModel.findOverlappingEvents.mockResolvedValue([
      {
        event_a_id: 'evt-1',
        event_a_name: 'Event A',
        event_a_start: '2023-01-01T10:00:00.000Z',
        event_a_end: '2023-01-01T11:30:00.000Z',
        event_b_id: 'evt-2',
        event_b_name: 'Event B',
        event_b_start: '2023-01-01T10:30:00.000Z',
        event_b_end: '2023-01-01T11:00:00.000Z',
        overlap_duration_minutes: '30',
      },
    ]);

    const res = await request(app).get(
      '/api/insights/overlapping-events?startDate=2023-01-01T00:00:00Z&endDate=2023-01-05T00:00:00Z'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].overlappingEventPairs).toHaveLength(2);
    expect(res.body[0].overlap_duration_minutes).toBe(30);
  });

  test('returns 200 with empty array when no overlaps', async () => {
    eventModel.findOverlappingEvents.mockResolvedValue([]);

    const res = await request(app).get(
      '/api/insights/overlapping-events?startDate=2023-01-01T00:00:00Z&endDate=2023-01-05T00:00:00Z'
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns 400 when startDate is missing', async () => {
    const res = await request(app).get(
      '/api/insights/overlapping-events?endDate=2023-01-05T00:00:00Z'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('returns 400 when endDate is missing', async () => {
    const res = await request(app).get(
      '/api/insights/overlapping-events?startDate=2023-01-01T00:00:00Z'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET /api/insights/temporal-gaps
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/insights/temporal-gaps', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with largest gap', async () => {
    eventModel.getEventsInRange.mockResolvedValue([
      {
        event_id: 'evt-1',
        event_name: 'Event A',
        start_date: '2023-01-02T09:00:00.000Z',
        end_date: '2023-01-02T12:00:00.000Z',
        duration_minutes: 180,
      },
      {
        event_id: 'evt-2',
        event_name: 'Event B',
        start_date: '2023-01-10T10:00:00.000Z',
        end_date: '2023-01-10T14:00:00.000Z',
        duration_minutes: 240,
      },
    ]);

    const res = await request(app).get(
      '/api/insights/temporal-gaps?startDate=2023-01-01T00:00:00Z&endDate=2023-01-15T00:00:00Z'
    );

    expect(res.status).toBe(200);
    expect(res.body.largestGap).not.toBeNull();
    expect(res.body.message).toBe('Largest temporal gap identified.');
  });

  test('returns 200 with null gap when no events', async () => {
    eventModel.getEventsInRange.mockResolvedValue([]);

    const res = await request(app).get(
      '/api/insights/temporal-gaps?startDate=2023-01-01T00:00:00Z&endDate=2023-01-15T00:00:00Z'
    );

    expect(res.status).toBe(200);
    expect(res.body.largestGap).toBeNull();
  });

  test('returns 400 when startDate is missing', async () => {
    const res = await request(app).get(
      '/api/insights/temporal-gaps?endDate=2023-01-15T00:00:00Z'
    );

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. GET /api/insights/event-influence
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/insights/event-influence', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with shortest path when path exists', async () => {
    eventModel.getAllForGraph.mockResolvedValue([
      { event_id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef', event_name: 'Event A', parent_event_id: null, duration_minutes: 60 },
      { event_id: 'f7e6d5c4-b3a2-1098-7654-3210fedcba98', event_name: 'Event B', parent_event_id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef', duration_minutes: 120 },
    ]);

    const res = await request(app).get(
      '/api/insights/event-influence?sourceEventId=a1b2c3d4-e5f6-7890-1234-567890abcdef&targetEventId=f7e6d5c4-b3a2-1098-7654-3210fedcba98'
    );

    expect(res.status).toBe(200);
    expect(res.body.shortestPath).toHaveLength(2);
    expect(res.body.totalDurationMinutes).toBe(180);
    expect(res.body.message).toContain('Shortest temporal path found');
  });

  test('returns 200 with empty path when no connection', async () => {
    eventModel.getAllForGraph.mockResolvedValue([
      { event_id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef', event_name: 'Event A', parent_event_id: null, duration_minutes: 60 },
      { event_id: 'f7e6d5c4-b3a2-1098-7654-3210fedcba98', event_name: 'Event B', parent_event_id: null, duration_minutes: 120 },
    ]);

    const res = await request(app).get(
      '/api/insights/event-influence?sourceEventId=a1b2c3d4-e5f6-7890-1234-567890abcdef&targetEventId=f7e6d5c4-b3a2-1098-7654-3210fedcba98'
    );

    expect(res.status).toBe(200);
    expect(res.body.shortestPath).toHaveLength(0);
    expect(res.body.message).toContain('No temporal path found');
  });

  test('returns 400 when sourceEventId is missing', async () => {
    const res = await request(app).get(
      '/api/insights/event-influence?targetEventId=f7e6d5c4-b3a2-1098-7654-3210fedcba98'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('returns 400 when targetEventId is missing', async () => {
    const res = await request(app).get(
      '/api/insights/event-influence?sourceEventId=a1b2c3d4-e5f6-7890-1234-567890abcdef'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('returns 400 for invalid UUID format', async () => {
    const res = await request(app).get(
      '/api/insights/event-influence?sourceEventId=not-uuid&targetEventId=also-not-uuid'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Health Check & 404
// ─────────────────────────────────────────────────────────────────────────────

describe('Health Check & 404', () => {
  test('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  test('GET /nonexistent returns 404', async () => {
    const res = await request(app).get('/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });
});

