const eventModel = require('../models/eventModel');

/**
 * Build a nested tree structure from a flat list of events.
 * @param {Array} flatEvents - Flat array of event rows
 * @param {string} rootId - The root event ID
 * @returns {object} The root event with nested children
 */
function buildTree(flatEvents, rootId) {
  // Create a map of event_id -> event (with children array)
  const eventMap = new Map();

  for (const event of flatEvents) {
    eventMap.set(event.event_id, {
      event_id: event.event_id,
      event_name: event.event_name,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date,
      duration_minutes: event.duration_minutes,
      parent_event_id: event.parent_event_id,
      children: [],
    });
  }

  // Wire up parent-child relationships
  for (const event of flatEvents) {
    if (event.parent_event_id && eventMap.has(event.parent_event_id)) {
      const parent = eventMap.get(event.parent_event_id);
      const child = eventMap.get(event.event_id);
      parent.children.push(child);
    }
  }

  return eventMap.get(rootId) || null;
}

/**
 * Get the full hierarchical timeline for a root event, including
 * all ancestors (parents) and all descendants (children).
 */
async function getTimeline(rootEventId) {
  // First get the subtree (root + all descendants)
  const subtree = await eventModel.getSubtree(rootEventId);

  if (!subtree || subtree.length === 0) {
    return null;
  }

  // Find the actual root of the tree (walk up to the topmost ancestor)
  const rootEvent = subtree.find((e) => e.event_id === rootEventId);

  if (rootEvent && rootEvent.parent_event_id) {
    // This event has a parent - get ancestors too
    const ancestors = await eventModel.getAncestors(rootEventId);

    // Merge ancestors and subtree (avoid duplicates)
    const allEventsMap = new Map();
    for (const e of ancestors) allEventsMap.set(e.event_id, e);
    for (const e of subtree) allEventsMap.set(e.event_id, e);

    // For each ancestor, also get their full subtree so siblings are included
    const allEvents = Array.from(allEventsMap.values());

    // Find the topmost root (no parent)
    const topRoot = allEvents.find((e) => !e.parent_event_id);
    if (topRoot) {
      // Get the full subtree from the top root
      const fullTree = await eventModel.getSubtree(topRoot.event_id);
      return buildTree(fullTree, topRoot.event_id);
    }
  }

  // Build tree from subtree
  return buildTree(subtree, rootEventId);
}

module.exports = { getTimeline, buildTree };

