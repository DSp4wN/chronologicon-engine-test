/**
 * Unit tests for insightService — Temporal Gap Finder and Dijkstra's algorithm.
 *
 * These tests mock the eventModel to isolate business logic from the database.
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

const eventModel = require('../../src/models/eventModel');
const insightService = require('../../src/services/insightService');

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORAL GAP FINDER
// ─────────────────────────────────────────────────────────────────────────────

describe('findTemporalGaps', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('identifies the largest gap between events', async () => {
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

    const result = await insightService.findTemporalGaps(
      '2023-01-01T00:00:00Z',
      '2023-01-15T00:00:00Z'
    );

    expect(result.message).toBe('Largest temporal gap identified.');
    expect(result.largestGap).not.toBeNull();
    // The largest gap is between Event A end (Jan 2 12:00) and Event B start (Jan 10 10:00)
    expect(result.largestGap.startOfGap).toBe('2023-01-02T12:00:00.000Z');
    expect(result.largestGap.endOfGap).toBe('2023-01-10T10:00:00.000Z');
    expect(result.largestGap.durationMinutes).toBeGreaterThan(0);
    expect(result.largestGap.precedingEvent.event_id).toBe('evt-1');
    expect(result.largestGap.succeedingEvent.event_id).toBe('evt-2');
  });

  test('detects leading gap (gap between startDate and first event)', async () => {
    eventModel.getEventsInRange.mockResolvedValue([
      {
        event_id: 'evt-1',
        event_name: 'Late Event',
        start_date: '2023-01-10T10:00:00.000Z',
        end_date: '2023-01-10T12:00:00.000Z',
        duration_minutes: 120,
      },
    ]);

    const result = await insightService.findTemporalGaps(
      '2023-01-01T00:00:00Z',
      '2023-01-11T00:00:00Z'
    );

    expect(result.largestGap).not.toBeNull();
    // Leading gap: Jan 1 00:00 → Jan 10 10:00
    expect(result.largestGap.startOfGap).toBe('2023-01-01T00:00:00.000Z');
    expect(result.largestGap.endOfGap).toBe('2023-01-10T10:00:00.000Z');
  });

  test('detects trailing gap (gap between last event and endDate)', async () => {
    eventModel.getEventsInRange.mockResolvedValue([
      {
        event_id: 'evt-1',
        event_name: 'Early Event',
        start_date: '2023-01-01T08:00:00.000Z',
        end_date: '2023-01-01T10:00:00.000Z',
        duration_minutes: 120,
      },
    ]);

    const result = await insightService.findTemporalGaps(
      '2023-01-01T00:00:00Z',
      '2023-01-20T00:00:00Z'
    );

    expect(result.largestGap).not.toBeNull();
    // Trailing gap: Jan 1 10:00 → Jan 20 00:00
    expect(result.largestGap.startOfGap).toBe('2023-01-01T10:00:00.000Z');
    expect(result.largestGap.endOfGap).toBe('2023-01-20T00:00:00.000Z');
  });

  test('returns no gap message when no events exist in range', async () => {
    eventModel.getEventsInRange.mockResolvedValue([]);

    const result = await insightService.findTemporalGaps(
      '2023-01-01T00:00:00Z',
      '2023-01-15T00:00:00Z'
    );

    expect(result.largestGap).toBeNull();
    expect(result.message).toContain('No significant temporal gaps');
  });

  test('handles overlapping events correctly (no false gaps)', async () => {
    eventModel.getEventsInRange.mockResolvedValue([
      {
        event_id: 'evt-1',
        event_name: 'Event A',
        start_date: '2023-01-01T09:00:00.000Z',
        end_date: '2023-01-01T12:00:00.000Z',
        duration_minutes: 180,
      },
      {
        event_id: 'evt-2',
        event_name: 'Event B',
        start_date: '2023-01-01T10:00:00.000Z',
        end_date: '2023-01-01T14:00:00.000Z',
        duration_minutes: 240,
      },
      {
        event_id: 'evt-3',
        event_name: 'Event C',
        start_date: '2023-01-01T15:00:00.000Z',
        end_date: '2023-01-01T16:00:00.000Z',
        duration_minutes: 60,
      },
    ]);

    const result = await insightService.findTemporalGaps(
      '2023-01-01T09:00:00Z',
      '2023-01-01T16:00:00Z'
    );

    // The only gap is between Event B end (14:00) and Event C start (15:00) = 60 min
    expect(result.largestGap).not.toBeNull();
    expect(result.largestGap.startOfGap).toBe('2023-01-01T14:00:00.000Z');
    expect(result.largestGap.endOfGap).toBe('2023-01-01T15:00:00.000Z');
    expect(result.largestGap.durationMinutes).toBe(60);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EVENT INFLUENCE SPREADER (Dijkstra)
// ─────────────────────────────────────────────────────────────────────────────

describe('findEventInfluence', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('finds shortest path between connected events', async () => {
    // Graph: A(60) → B(480) → C(960) → D(180)
    eventModel.getAllForGraph.mockResolvedValue([
      { event_id: 'A', event_name: 'Event A', parent_event_id: null, duration_minutes: 60 },
      { event_id: 'B', event_name: 'Event B', parent_event_id: 'A', duration_minutes: 480 },
      { event_id: 'C', event_name: 'Event C', parent_event_id: 'B', duration_minutes: 960 },
      { event_id: 'D', event_name: 'Event D', parent_event_id: 'C', duration_minutes: 180 },
    ]);

    const result = await insightService.findEventInfluence('A', 'D');

    expect(result.message).toContain('Shortest temporal path found');
    expect(result.shortestPath).toHaveLength(4);
    expect(result.shortestPath[0].event_id).toBe('A');
    expect(result.shortestPath[3].event_id).toBe('D');
    expect(result.totalDurationMinutes).toBe(60 + 480 + 960 + 180);
  });

  test('returns empty path when no connection exists', async () => {
    // Two disconnected branches: A→B and C→D
    eventModel.getAllForGraph.mockResolvedValue([
      { event_id: 'A', event_name: 'Event A', parent_event_id: null, duration_minutes: 60 },
      { event_id: 'B', event_name: 'Event B', parent_event_id: 'A', duration_minutes: 120 },
      { event_id: 'C', event_name: 'Event C', parent_event_id: null, duration_minutes: 90 },
      { event_id: 'D', event_name: 'Event D', parent_event_id: 'C', duration_minutes: 180 },
    ]);

    const result = await insightService.findEventInfluence('A', 'D');

    expect(result.message).toContain('No temporal path found');
    expect(result.shortestPath).toHaveLength(0);
    expect(result.totalDurationMinutes).toBe(0);
  });

  test('handles source not found', async () => {
    eventModel.getAllForGraph.mockResolvedValue([
      { event_id: 'A', event_name: 'Event A', parent_event_id: null, duration_minutes: 60 },
    ]);

    const result = await insightService.findEventInfluence('NONEXISTENT', 'A');

    expect(result.message).toContain('not found');
    expect(result.shortestPath).toHaveLength(0);
  });

  test('handles target not found', async () => {
    eventModel.getAllForGraph.mockResolvedValue([
      { event_id: 'A', event_name: 'Event A', parent_event_id: null, duration_minutes: 60 },
    ]);

    const result = await insightService.findEventInfluence('A', 'NONEXISTENT');

    expect(result.message).toContain('not found');
    expect(result.shortestPath).toHaveLength(0);
  });

  test('handles empty database', async () => {
    eventModel.getAllForGraph.mockResolvedValue([]);

    const result = await insightService.findEventInfluence('A', 'B');

    expect(result.shortestPath).toHaveLength(0);
    expect(result.message).toContain('No events found');
  });

  test('finds path when source == target (single node)', async () => {
    eventModel.getAllForGraph.mockResolvedValue([
      { event_id: 'A', event_name: 'Event A', parent_event_id: null, duration_minutes: 60 },
    ]);

    const result = await insightService.findEventInfluence('A', 'A');

    expect(result.shortestPath).toHaveLength(1);
    expect(result.shortestPath[0].event_id).toBe('A');
    expect(result.totalDurationMinutes).toBe(60);
  });

  test('prefers shortest weighted path over fewer hops', async () => {
    // Graph: A(10) → B(1000) → D(10) (total via B: 1020)
    //        A(10) → C(5) → D(10)     (total via C: 25) ← shorter
    // But B is directly connected: A→B, A→C; B→D, C→D
    eventModel.getAllForGraph.mockResolvedValue([
      { event_id: 'A', event_name: 'Root', parent_event_id: null, duration_minutes: 10 },
      { event_id: 'B', event_name: 'Heavy Path', parent_event_id: 'A', duration_minutes: 1000 },
      { event_id: 'C', event_name: 'Light Path', parent_event_id: 'A', duration_minutes: 5 },
      { event_id: 'D', event_name: 'Target', parent_event_id: 'C', duration_minutes: 10 },
    ]);

    const result = await insightService.findEventInfluence('A', 'D');

    expect(result.totalDurationMinutes).toBe(10 + 5 + 10); // A→C→D
    expect(result.shortestPath[1].event_id).toBe('C');
  });

  test('traverses bidirectional edges (child to parent)', async () => {
    // B is child of A. Test finding path from B → A (upward)
    eventModel.getAllForGraph.mockResolvedValue([
      { event_id: 'A', event_name: 'Parent', parent_event_id: null, duration_minutes: 100 },
      { event_id: 'B', event_name: 'Child', parent_event_id: 'A', duration_minutes: 50 },
    ]);

    const result = await insightService.findEventInfluence('B', 'A');

    expect(result.message).toContain('Shortest temporal path found');
    expect(result.shortestPath).toHaveLength(2);
    expect(result.shortestPath[0].event_id).toBe('B');
    expect(result.shortestPath[1].event_id).toBe('A');
    expect(result.totalDurationMinutes).toBe(50 + 100);
  });
});

