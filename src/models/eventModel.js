const { db } = require('../config/db');

const TABLE = 'historical_events';

/**
 * Batch insert events (without duration_minutes — it's a generated column in PG)
 */
async function batchInsert(events) {
  // Remove duration_minutes since it's a GENERATED ALWAYS column
  const rows = events.map((e) => ({
    event_id: e.event_id,
    event_name: e.event_name,
    description: e.description,
    start_date: e.start_date,
    end_date: e.end_date,
    parent_event_id: e.parent_event_id,
    metadata: JSON.stringify(e.metadata || {}),
  }));

  // Use ON CONFLICT to skip duplicates
  const query = db(TABLE)
    .insert(rows)
    .onConflict('event_id')
    .ignore();

  return query;
}

/**
 * Get a single event by ID
 */
async function getById(eventId) {
  return db(TABLE).where('event_id', eventId).first();
}

/**
 * Get full hierarchical tree using recursive CTE (downward: children)
 */
async function getSubtree(rootEventId) {
  const result = await db.raw(
    `
    WITH RECURSIVE event_tree AS (
      SELECT * FROM ${TABLE} WHERE event_id = ?

      UNION ALL

      SELECT e.*
      FROM ${TABLE} e
      INNER JOIN event_tree et ON e.parent_event_id = et.event_id
    )
    SELECT * FROM event_tree;
  `,
    [rootEventId]
  );
  return result.rows;
}

/**
 * Get ancestor chain (upward: parents)
 */
async function getAncestors(eventId) {
  const result = await db.raw(
    `
    WITH RECURSIVE ancestor_tree AS (
      SELECT * FROM ${TABLE} WHERE event_id = ?

      UNION ALL

      SELECT e.*
      FROM ${TABLE} e
      INNER JOIN ancestor_tree at ON e.event_id = at.parent_event_id
    )
    SELECT * FROM ancestor_tree;
  `,
    [eventId]
  );
  return result.rows;
}

/**
 * Search events with optional filters, pagination, and sorting
 */
async function search({ name, startDateAfter, endDateBefore, sortBy, sortOrder, page, limit }) {
  const offset = (page - 1) * limit;

  // Whitelist of allowed sort columns to prevent SQL injection
  const allowedSortColumns = ['start_date', 'end_date', 'event_name', 'duration_minutes'];
  const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'start_date';
  const safeSortOrder = sortOrder === 'desc' ? 'desc' : 'asc';

  let query = db(TABLE);
  let countQuery = db(TABLE);

  // Partial name match (case-insensitive)
  if (name) {
    query = query.whereRaw('event_name ILIKE ?', [`%${name}%`]);
    countQuery = countQuery.whereRaw('event_name ILIKE ?', [`%${name}%`]);
  }

  // Date range filters
  if (startDateAfter) {
    query = query.where('start_date', '>', startDateAfter);
    countQuery = countQuery.where('start_date', '>', startDateAfter);
  }
  if (endDateBefore) {
    query = query.where('end_date', '<', endDateBefore);
    countQuery = countQuery.where('end_date', '<', endDateBefore);
  }

  const [{ count: totalEvents }] = await countQuery.count('* as count');

  const events = await query
    .select('event_id', 'event_name', 'start_date', 'end_date', 'duration_minutes', 'description', 'parent_event_id')
    .orderBy(safeSortBy, safeSortOrder)
    .limit(limit)
    .offset(offset);

  return { totalEvents: parseInt(totalEvents, 10), events };
}

/**
 * Find overlapping event pairs within a date range
 */
async function findOverlappingEvents(startDate, endDate) {
  const result = await db.raw(
    `
    SELECT
      a.event_id AS event_a_id, a.event_name AS event_a_name,
      a.start_date AS event_a_start, a.end_date AS event_a_end,
      b.event_id AS event_b_id, b.event_name AS event_b_name,
      b.start_date AS event_b_start, b.end_date AS event_b_end,
      EXTRACT(EPOCH FROM (
        LEAST(a.end_date, b.end_date) - GREATEST(a.start_date, b.start_date)
      )) / 60 AS overlap_duration_minutes
    FROM ${TABLE} a
    JOIN ${TABLE} b ON a.event_id < b.event_id
    WHERE a.start_date < b.end_date
      AND b.start_date < a.end_date
      AND a.start_date >= ?
      AND a.end_date <= ?
      AND b.start_date >= ?
      AND b.end_date <= ?
    ORDER BY overlap_duration_minutes DESC;
  `,
    [startDate, endDate, startDate, endDate]
  );
  return result.rows;
}

/**
 * Get events within a date range sorted by start_date (for gap finding)
 */
async function getEventsInRange(startDate, endDate) {
  return db(TABLE)
    .where('start_date', '>=', startDate)
    .andWhere('end_date', '<=', endDate)
    .orderBy('start_date', 'asc')
    .select('event_id', 'event_name', 'start_date', 'end_date', 'duration_minutes');
}

/**
 * Get all events with parent-child info (for graph traversal / Dijkstra)
 */
async function getAllForGraph() {
  return db(TABLE).select('event_id', 'event_name', 'parent_event_id', 'duration_minutes', 'start_date', 'end_date');
}

module.exports = {
  batchInsert,
  getById,
  getSubtree,
  getAncestors,
  search,
  findOverlappingEvents,
  getEventsInRange,
  getAllForGraph,
};

