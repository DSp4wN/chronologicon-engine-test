const express = require('express');
const insightController = require('../controllers/insightController');
const {
  validate,
  overlappingQuerySchema,
  temporalGapsQuerySchema,
  eventInfluenceQuerySchema,
} = require('../middleware/validator');

const router = express.Router();

/**
 * GET /api/insights/overlapping-events
 */
router.get(
  '/overlapping-events',
  validate(overlappingQuerySchema, 'query'),
  insightController.overlappingEvents
);

/**
 * GET /api/insights/temporal-gaps
 */
router.get(
  '/temporal-gaps',
  validate(temporalGapsQuerySchema, 'query'),
  insightController.temporalGaps
);

/**
 * GET /api/insights/event-influence
 */
router.get(
  '/event-influence',
  validate(eventInfluenceQuerySchema, 'query'),
  insightController.eventInfluence
);

module.exports = router;

