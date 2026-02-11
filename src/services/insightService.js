const eventModel = require('../models/eventModel');

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAPPING EVENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find all overlapping event pairs within a date range.
 */
async function findOverlappingEvents(startDate, endDate) {
  const rows = await eventModel.findOverlappingEvents(startDate, endDate);

  return rows.map((row) => ({
    overlappingEventPairs: [
      {
        event_id: row.event_a_id,
        event_name: row.event_a_name,
        start_date: row.event_a_start,
        end_date: row.event_a_end,
      },
      {
        event_id: row.event_b_id,
        event_name: row.event_b_name,
        start_date: row.event_b_start,
        end_date: row.event_b_end,
      },
    ],
    overlap_duration_minutes: Math.round(parseFloat(row.overlap_duration_minutes)),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORAL GAP FINDER (Sweep Line Algorithm)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the largest temporal gap within a date range.
 * Algorithm: Sort events by start_date, track coverage frontier.
 */
async function findTemporalGaps(startDate, endDate) {
  const events = await eventModel.getEventsInRange(startDate, endDate);

  if (!events || events.length === 0) {
    return {
      largestGap: null,
      message: 'No significant temporal gaps found within the specified range, or too few events.',
    };
  }

  let frontier = new Date(startDate);
  let largestGap = null;
  let precedingEvent = null;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventStart = new Date(event.start_date);
    const eventEnd = new Date(event.end_date);

    if (eventStart > frontier) {
      // There's a gap between frontier and this event's start
      const gapDuration = (eventStart - frontier) / 60000; // minutes

      if (!largestGap || gapDuration > largestGap.durationMinutes) {
        largestGap = {
          startOfGap: frontier.toISOString(),
          endOfGap: eventStart.toISOString(),
          durationMinutes: Math.round(gapDuration),
          precedingEvent: precedingEvent
            ? {
                event_id: precedingEvent.event_id,
                event_name: precedingEvent.event_name,
                end_date: precedingEvent.end_date,
              }
            : null,
          succeedingEvent: {
            event_id: event.event_id,
            event_name: event.event_name,
            start_date: event.start_date,
          },
        };
      }
    }

    // Update frontier
    if (eventEnd > frontier) {
      frontier = eventEnd;
      precedingEvent = event;
    }
  }

  // Check trailing gap (between last event and endDate)
  const queryEnd = new Date(endDate);
  if (queryEnd > frontier) {
    const gapDuration = (queryEnd - frontier) / 60000;
    if (!largestGap || gapDuration > largestGap.durationMinutes) {
      largestGap = {
        startOfGap: frontier.toISOString(),
        endOfGap: queryEnd.toISOString(),
        durationMinutes: Math.round(gapDuration),
        precedingEvent: precedingEvent
          ? {
              event_id: precedingEvent.event_id,
              event_name: precedingEvent.event_name,
              end_date: precedingEvent.end_date,
            }
          : null,
        succeedingEvent: null,
      };
    }
  }

  if (!largestGap || largestGap.durationMinutes <= 0) {
    return {
      largestGap: null,
      message: 'No significant temporal gaps found within the specified range, or too few events.',
    };
  }

  return {
    largestGap,
    message: 'Largest temporal gap identified.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT INFLUENCE SPREADER (Dijkstra's Algorithm)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MinHeap (priority queue) for Dijkstra's algorithm.
 */
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() {
    return this.heap.length;
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[parentIdx].cost <= this.heap[idx].cost) break;
      [this.heap[parentIdx], this.heap[idx]] = [this.heap[idx], this.heap[parentIdx]];
      idx = parentIdx;
    }
  }

  _sinkDown(idx) {
    const length = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < length && this.heap[left].cost < this.heap[smallest].cost) smallest = left;
      if (right < length && this.heap[right].cost < this.heap[smallest].cost) smallest = right;
      if (smallest === idx) break;
      [this.heap[smallest], this.heap[idx]] = [this.heap[idx], this.heap[smallest]];
      idx = smallest;
    }
  }
}

/**
 * Find shortest temporal path from source to target using Dijkstra's algorithm.
 * Edges are bidirectional parent-child relationships.
 * Weight = duration_minutes of the destination event.
 */
async function findEventInfluence(sourceEventId, targetEventId) {
  const allEvents = await eventModel.getAllForGraph();

  if (!allEvents || allEvents.length === 0) {
    return {
      sourceEventId,
      targetEventId,
      shortestPath: [],
      totalDurationMinutes: 0,
      message: 'No events found in the database.',
    };
  }

  // Build adjacency list (bidirectional: parent ↔ child)
  const eventMap = new Map();
  const adjacency = new Map();

  for (const event of allEvents) {
    eventMap.set(event.event_id, event);
    if (!adjacency.has(event.event_id)) {
      adjacency.set(event.event_id, []);
    }
  }

  for (const event of allEvents) {
    if (event.parent_event_id && eventMap.has(event.parent_event_id)) {
      // Parent → Child edge
      adjacency.get(event.parent_event_id).push(event.event_id);
      // Child → Parent edge (bidirectional)
      adjacency.get(event.event_id).push(event.parent_event_id);
    }
  }

  // Validate source and target exist
  if (!eventMap.has(sourceEventId)) {
    return {
      sourceEventId,
      targetEventId,
      shortestPath: [],
      totalDurationMinutes: 0,
      message: `Source event '${sourceEventId}' not found.`,
    };
  }
  if (!eventMap.has(targetEventId)) {
    return {
      sourceEventId,
      targetEventId,
      shortestPath: [],
      totalDurationMinutes: 0,
      message: `Target event '${targetEventId}' not found.`,
    };
  }

  // Dijkstra's algorithm
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  const pq = new MinHeap();

  const sourceEvent = eventMap.get(sourceEventId);
  const sourceDuration = sourceEvent.duration_minutes || 0;

  dist.set(sourceEventId, sourceDuration);
  pq.push({ cost: sourceDuration, nodeId: sourceEventId });

  while (pq.size > 0) {
    const { cost, nodeId } = pq.pop();

    if (nodeId === targetEventId) {
      // Reconstruct path
      const path = [];
      let current = targetEventId;
      while (current) {
        const evt = eventMap.get(current);
        path.unshift({
          event_id: evt.event_id,
          event_name: evt.event_name,
          duration_minutes: evt.duration_minutes || 0,
        });
        current = prev.get(current) || null;
      }

      return {
        sourceEventId,
        targetEventId,
        shortestPath: path,
        totalDurationMinutes: cost,
        message: 'Shortest temporal path found from source to target event.',
      };
    }

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighborId of neighbors) {
      if (visited.has(neighborId)) continue;

      const neighborEvent = eventMap.get(neighborId);
      const neighborDuration = neighborEvent.duration_minutes || 0;
      const newCost = cost + neighborDuration;

      if (!dist.has(neighborId) || newCost < dist.get(neighborId)) {
        dist.set(neighborId, newCost);
        prev.set(neighborId, nodeId);
        pq.push({ cost: newCost, nodeId: neighborId });
      }
    }
  }

  // No path found
  return {
    sourceEventId,
    targetEventId,
    shortestPath: [],
    totalDurationMinutes: 0,
    message: 'No temporal path found from source to target event.',
  };
}

module.exports = { findOverlappingEvents, findTemporalGaps, findEventInfluence };

