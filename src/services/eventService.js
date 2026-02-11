const eventModel = require('../models/eventModel');

/**
 * Search events with filters, pagination, and sorting
 */
async function searchEvents({ name, startDateAfter, endDateBefore, sortBy, sortOrder, page, limit }) {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const safeLimit = Math.min(Math.max(limitNum, 1), 100); // clamp between 1 and 100

  const { totalEvents, events } = await eventModel.search({
    name,
    startDateAfter,
    endDateBefore,
    sortBy: sortBy || 'start_date',
    sortOrder: sortOrder || 'asc',
    page: pageNum,
    limit: safeLimit,
  });

  return {
    totalEvents,
    page: pageNum,
    limit: safeLimit,
    events,
  };
}

module.exports = { searchEvents };

