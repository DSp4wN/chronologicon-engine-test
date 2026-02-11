/**
 * Unit tests for timelineService — tree building logic.
 */
const { buildTree } = require('../../src/services/timelineService');

describe('buildTree', () => {
  test('builds a single-level tree (root with no children)', () => {
    const flatEvents = [
      {
        event_id: 'root-1',
        event_name: 'Root Event',
        description: 'The root.',
        start_date: '2023-01-01T10:00:00.000Z',
        end_date: '2023-01-01T11:00:00.000Z',
        duration_minutes: 60,
        parent_event_id: null,
      },
    ];

    const tree = buildTree(flatEvents, 'root-1');

    expect(tree).not.toBeNull();
    expect(tree.event_id).toBe('root-1');
    expect(tree.children).toEqual([]);
  });

  test('builds a two-level tree (root with direct children)', () => {
    const flatEvents = [
      {
        event_id: 'root-1',
        event_name: 'Root',
        description: null,
        start_date: '2023-01-01T10:00:00.000Z',
        end_date: '2023-01-01T12:00:00.000Z',
        duration_minutes: 120,
        parent_event_id: null,
      },
      {
        event_id: 'child-1',
        event_name: 'Child A',
        description: null,
        start_date: '2023-01-01T10:00:00.000Z',
        end_date: '2023-01-01T11:00:00.000Z',
        duration_minutes: 60,
        parent_event_id: 'root-1',
      },
      {
        event_id: 'child-2',
        event_name: 'Child B',
        description: null,
        start_date: '2023-01-01T11:00:00.000Z',
        end_date: '2023-01-01T12:00:00.000Z',
        duration_minutes: 60,
        parent_event_id: 'root-1',
      },
    ];

    const tree = buildTree(flatEvents, 'root-1');

    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].event_id).toBe('child-1');
    expect(tree.children[1].event_id).toBe('child-2');
    expect(tree.children[0].children).toEqual([]);
    expect(tree.children[1].children).toEqual([]);
  });

  test('builds a deeply nested tree (3 levels)', () => {
    const flatEvents = [
      {
        event_id: 'root',
        event_name: 'Root',
        description: null,
        start_date: '2023-01-01T10:00:00.000Z',
        end_date: '2023-01-01T12:00:00.000Z',
        duration_minutes: 120,
        parent_event_id: null,
      },
      {
        event_id: 'child',
        event_name: 'Child',
        description: null,
        start_date: '2023-01-01T10:00:00.000Z',
        end_date: '2023-01-01T11:00:00.000Z',
        duration_minutes: 60,
        parent_event_id: 'root',
      },
      {
        event_id: 'grandchild',
        event_name: 'Grandchild',
        description: null,
        start_date: '2023-01-01T10:00:00.000Z',
        end_date: '2023-01-01T10:30:00.000Z',
        duration_minutes: 30,
        parent_event_id: 'child',
      },
    ];

    const tree = buildTree(flatEvents, 'root');

    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].event_id).toBe('child');
    expect(tree.children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0].event_id).toBe('grandchild');
    expect(tree.children[0].children[0].children).toEqual([]);
  });

  test('returns null for non-existent rootId', () => {
    const flatEvents = [
      {
        event_id: 'root',
        event_name: 'Root',
        description: null,
        start_date: '2023-01-01T10:00:00.000Z',
        end_date: '2023-01-01T12:00:00.000Z',
        duration_minutes: 120,
        parent_event_id: null,
      },
    ];

    const tree = buildTree(flatEvents, 'nonexistent');
    expect(tree).toBeNull();
  });

  test('handles empty flat event list', () => {
    const tree = buildTree([], 'root');
    expect(tree).toBeNull();
  });

  test('correctly includes metadata fields on each node', () => {
    const flatEvents = [
      {
        event_id: 'root',
        event_name: 'Root Event',
        description: 'Description here',
        start_date: '2023-01-01T10:00:00.000Z',
        end_date: '2023-01-01T11:30:00.000Z',
        duration_minutes: 90,
        parent_event_id: null,
        metadata: { source: 'test' }, // extra field — should not appear in output
      },
    ];

    const tree = buildTree(flatEvents, 'root');

    expect(tree.event_name).toBe('Root Event');
    expect(tree.description).toBe('Description here');
    expect(tree.duration_minutes).toBe(90);
    expect(tree.parent_event_id).toBeNull();
    expect(tree.children).toEqual([]);
  });
});

