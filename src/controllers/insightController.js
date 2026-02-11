const insightService = require('../services/insightService');

/**
 * GET /api/insights/overlapping-events
 */
async function overlappingEvents(req, res, next) {
  try {
    const { startDate, endDate } = req.validatedQuery || req.query;
    const result = await insightService.findOverlappingEvents(startDate, endDate);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/insights/temporal-gaps
 */
async function temporalGaps(req, res, next) {
  try {
    const { startDate, endDate } = req.validatedQuery || req.query;
    const result = await insightService.findTemporalGaps(startDate, endDate);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/insights/event-influence
 */
async function eventInfluence(req, res, next) {
  try {
    const { sourceEventId, targetEventId } = req.validatedQuery || req.query;
    const result = await insightService.findEventInfluence(sourceEventId, targetEventId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { overlappingEvents, temporalGaps, eventInfluence };

