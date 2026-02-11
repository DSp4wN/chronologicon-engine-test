const express = require('express');
const timelineController = require('../controllers/timelineController');
const { validate, timelineParamsSchema } = require('../middleware/validator');

const router = express.Router();

/**
 * GET /api/timeline/:rootEventId
 */
router.get(
  '/:rootEventId',
  validate(timelineParamsSchema, 'params'),
  timelineController.getTimeline
);

module.exports = router;

