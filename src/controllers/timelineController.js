const timelineService = require('../services/timelineService');

/**
 * GET /api/timeline/:rootEventId
 */
async function getTimeline(req, res, next) {
  try {
    const { rootEventId } = req.params;

    const timeline = await timelineService.getTimeline(rootEventId);

    if (!timeline) {
      return res.status(404).json({
        error: `Event '${rootEventId}' not found.`,
      });
    }

    return res.status(200).json(timeline);
  } catch (err) {
    next(err);
  }
}

module.exports = { getTimeline };

