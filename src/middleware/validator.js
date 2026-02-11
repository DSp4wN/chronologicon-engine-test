const Joi = require('joi');

/**
 * Express middleware factory for Joi validation.
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {string} source - 'body', 'query', or 'params'
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => d.message);
      return res.status(400).json({
        error: 'Validation error',
        details,
      });
    }

    // In Express 5, req.query is a read-only getter — use req.validatedQuery instead.
    // For body and params, direct assignment is still safe.
    if (source === 'query') {
      req.validatedQuery = value;
    } else {
      req[source] = value;
    }
    next();
  };
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const ingestBodySchema = Joi.object({
  filePath: Joi.string().required(),
});

const searchQuerySchema = Joi.object({
  name: Joi.string().optional().allow(''),
  start_date_after: Joi.string().isoDate().optional(),
  end_date_before: Joi.string().isoDate().optional(),
  sortBy: Joi.string().valid('start_date', 'end_date', 'event_name', 'duration_minutes').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

const overlappingQuerySchema = Joi.object({
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
});

const temporalGapsQuerySchema = Joi.object({
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
});

const eventInfluenceQuerySchema = Joi.object({
  sourceEventId: Joi.string().uuid().required(),
  targetEventId: Joi.string().uuid().required(),
});

const timelineParamsSchema = Joi.object({
  rootEventId: Joi.string().uuid().required(),
});

const jobIdParamsSchema = Joi.object({
  jobId: Joi.string().required(),
});

module.exports = {
  validate,
  ingestBodySchema,
  searchQuerySchema,
  overlappingQuerySchema,
  temporalGapsQuerySchema,
  eventInfluenceQuerySchema,
  timelineParamsSchema,
  jobIdParamsSchema,
};

