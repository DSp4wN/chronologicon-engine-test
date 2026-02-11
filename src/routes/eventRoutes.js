const express = require('express');
const multer = require('multer');
const path = require('path');
const eventController = require('../controllers/eventController');
const {
  validate,
  ingestBodySchema,
  searchQuerySchema,
  jobIdParamsSchema,
} = require('../middleware/validator');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
});

/**
 * POST /api/events/ingest
 * Supports both multipart file upload and JSON body with filePath.
 */
router.post(
  '/ingest',
  upload.single('file'),
  (req, res, next) => {
    // If a file was uploaded via multer, skip JSON body validation
    if (req.file) return next();
    // Otherwise validate JSON body
    return validate(ingestBodySchema, 'body')(req, res, next);
  },
  eventController.ingest
);

/**
 * GET /api/events/ingestion-status/:jobId
 */
router.get(
  '/ingestion-status/:jobId',
  validate(jobIdParamsSchema, 'params'),
  eventController.ingestionStatus
);

/**
 * GET /api/events/search
 */
router.get(
  '/search',
  validate(searchQuerySchema, 'query'),
  eventController.search
);

module.exports = router;

