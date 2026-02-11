const { parseLine, isValidUUID, isValidISODate } = require('../../src/utils/lineParser');

// ─────────────────────────────────────────────────────────────────────────────
// Helper Utilities
// ─────────────────────────────────────────────────────────────────────────────

describe('isValidUUID', () => {
  test('accepts a valid UUID v4', () => {
    expect(isValidUUID('a1b2c3d4-e5f6-7890-1234-567890abcdef')).toBe(true);
  });

  test('accepts uppercase UUID', () => {
    expect(isValidUUID('A1B2C3D4-E5F6-7890-1234-567890ABCDEF')).toBe(true);
  });

  test('rejects malformed UUID', () => {
    expect(isValidUUID('malformed-id-1')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });

  test('rejects UUID with missing segment', () => {
    expect(isValidUUID('a1b2c3d4-e5f6-7890-1234')).toBe(false);
  });
});

describe('isValidISODate', () => {
  test('accepts ISO 8601 date with Z suffix', () => {
    expect(isValidISODate('2023-01-01T10:00:00Z')).toBe(true);
  });

  test('accepts ISO 8601 date with offset', () => {
    expect(isValidISODate('2023-01-01T10:00:00+05:30')).toBe(true);
  });

  test('rejects non-ISO date format', () => {
    expect(isValidISODate('2023/01/03 10:00')).toBe(false);
  });

  test('rejects invalid date string', () => {
    expect(isValidISODate('not-a-date')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidISODate('')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseLine - Valid Lines
// ─────────────────────────────────────────────────────────────────────────────

describe('parseLine - valid lines', () => {
  test('parses a well-formed line with all fields', () => {
    const line =
      'a1b2c3d4-e5f6-7890-1234-567890abcdef|Founding of ArchaeoData|2023-01-01T10:00:00Z|2023-01-01T11:30:00Z|NULL|Initial establishment of the company.';
    const { event, error } = parseLine(line, 1);

    expect(error).toBeNull();
    expect(event).not.toBeNull();
    expect(event.event_id).toBe('a1b2c3d4-e5f6-7890-1234-567890abcdef');
    expect(event.event_name).toBe('Founding of ArchaeoData');
    expect(event.start_date).toBe('2023-01-01T10:00:00.000Z');
    expect(event.end_date).toBe('2023-01-01T11:30:00.000Z');
    expect(event.duration_minutes).toBe(90);
    expect(event.parent_event_id).toBeNull();
    expect(event.description).toBe('Initial establishment of the company.');
  });

  test('parses a line with a valid parent_event_id', () => {
    const line =
      'f7e6d5c4-b3a2-1098-7654-3210fedcba98|Phase 1 Research|2023-01-01T10:30:00Z|2023-01-01T11:00:00Z|a1b2c3d4-e5f6-7890-1234-567890abcdef|Early research.';
    const { event, error } = parseLine(line, 2);

    expect(error).toBeNull();
    expect(event.parent_event_id).toBe('a1b2c3d4-e5f6-7890-1234-567890abcdef');
    expect(event.duration_minutes).toBe(30);
  });

  test('parses a line with empty description', () => {
    const line =
      'a1b2c3d4-e5f6-7890-1234-567890abcdef|Test Event|2023-01-01T10:00:00Z|2023-01-01T11:00:00Z|NULL|';
    const { event, error } = parseLine(line, 3);

    expect(error).toBeNull();
    expect(event.description).toBeNull();
  });

  test('parses a zero-duration event (start == end)', () => {
    const line =
      'a1b2c3d4-e5f6-7890-1234-567890abcdef|Instant Event|2023-01-01T10:00:00Z|2023-01-01T10:00:00Z|NULL|Zero duration.';
    const { event, error } = parseLine(line, 4);

    expect(error).toBeNull();
    expect(event.duration_minutes).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseLine - Empty / Blank Lines
// ─────────────────────────────────────────────────────────────────────────────

describe('parseLine - blank lines', () => {
  test('returns null event and no error for empty string', () => {
    const { event, error } = parseLine('', 1);
    expect(event).toBeNull();
    expect(error).toBeNull();
  });

  test('returns null event and no error for whitespace-only line', () => {
    const { event, error } = parseLine('   ', 2);
    expect(event).toBeNull();
    expect(error).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseLine - Malformed Lines
// ─────────────────────────────────────────────────────────────────────────────

describe('parseLine - malformed lines', () => {
  test('rejects line with too few fields (missing description)', () => {
    const line = 'aabbccdd-eeff-0011-2233-445566778899|Missing Fields Event|2023-01-04T10:00:00Z';
    const { event, error } = parseLine(line, 22);

    expect(event).toBeNull();
    expect(error).toContain('Malformed entry');
    expect(error).toContain('expected 6 fields');
  });

  test('rejects line with invalid UUID for event_id', () => {
    const line =
      'malformed-id-1|Broken Event|2023-01-02T09:00:00Z|2023-01-02T10:00:00Z|NULL|Invalid UUID.';
    const { event, error } = parseLine(line, 19);

    expect(event).toBeNull();
    expect(error).toContain('Invalid UUID for event_id');
  });

  test('rejects line with empty event_id', () => {
    const line = '|Empty ID Event|2023-01-04T10:00:00Z|2023-01-04T11:00:00Z|NULL|Empty ID.';
    const { event, error } = parseLine(line, 21);

    expect(event).toBeNull();
    expect(error).toContain('Invalid UUID for event_id');
  });

  test('rejects line with invalid start_date format', () => {
    const line =
      '99001122-3344-5566-aabb-ccddeeff7788|Bad Date|2023/01/03 10:00|2023-01-03T11:00:00Z|NULL|Bad date.';
    const { event, error } = parseLine(line, 20);

    expect(event).toBeNull();
    expect(error).toContain('Invalid date format for start_date');
  });

  test('rejects line with invalid end_date format', () => {
    const line =
      '99001122-3344-5566-aabb-ccddeeff7788|Bad End|2023-01-03T10:00:00Z|not-a-date|NULL|Bad end date.';
    const { event, error } = parseLine(line, 5);

    expect(event).toBeNull();
    expect(error).toContain('Invalid date format for end_date');
  });

  test('rejects line where end_date is before start_date', () => {
    const line =
      '99001122-3344-5566-aabb-ccddeeff7788|Reversed|2023-01-03T12:00:00Z|2023-01-03T10:00:00Z|NULL|End before start.';
    const { event, error } = parseLine(line, 6);

    expect(event).toBeNull();
    expect(error).toContain('end_date is before start_date');
  });

  test('rejects line with invalid parent_event_id UUID', () => {
    const line =
      '99001122-3344-5566-aabb-ccddeeff7788|Bad Parent|2023-01-03T10:00:00Z|2023-01-03T11:00:00Z|not-a-uuid|Description.';
    const { event, error } = parseLine(line, 7);

    expect(event).toBeNull();
    expect(error).toContain('Invalid UUID for parent_event_id');
  });

  test('rejects line with missing event_name', () => {
    const line =
      '99001122-3344-5566-aabb-ccddeeff7788||2023-01-03T10:00:00Z|2023-01-03T11:00:00Z|NULL|No name.';
    const { event, error } = parseLine(line, 8);

    expect(event).toBeNull();
    expect(error).toContain('Missing event_name');
  });
});

