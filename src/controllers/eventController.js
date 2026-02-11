const fs = require('fs');
const path = require('path');
const { createJob, getJob } = require('../utils/jobStore');
const ingestionService = require('../services/ingestionService');
const eventService = require('../services/eventService');
const logger = require('../utils/logger');

/**
 * POST /api/events/ingest
 * Initiates async file ingestion. Supports JSON body with filePath or multipart file upload.
 */
async function ingest(req, res, next) {
  try {
    let filePath;

    if (req.file) {
      // Multipart file upload via multer
      filePath = req.file.path;
    } else if (req.body && req.body.filePath) {
      // JSON body with server file path
      filePath = req.body.filePath;
    } else {
      return res.status(400).json({
        error: 'No file provided. Send a file via multipart/form-data or provide a "filePath" in JSON body.',
      });
    }

    // Resolve to absolute path
    filePath = path.resolve(filePath);

    // Check file exists
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        error: `File not found: ${filePath}`,
      });
    }

    // Create job and start async processing
    const job = createJob();
    logger.info(`Ingestion job ${job.jobId} created for file: ${filePath}`);

    // Fire and forget — process in background
    ingestionService.processFile(filePath, job.jobId);

    return res.status(202).json({
      status: 'Ingestion initiated',
      jobId: job.jobId,
      message: `Check /api/events/ingestion-status/${job.jobId} for updates.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/events/ingestion-status/:jobId
 */
async function ingestionStatus(req, res, next) {
  try {
    const { jobId } = req.params;
    const job = getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: `Job '${jobId}' not found.` });
    }

    return res.status(200).json(job);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/events/search
 */
async function search(req, res, next) {
  try {
    const query = req.validatedQuery || req.query;
    const {
      name,
      start_date_after: startDateAfter,
      end_date_before: endDateBefore,
      sortBy,
      sortOrder,
      page,
      limit,
    } = query;

    const result = await eventService.searchEvents({
      name,
      startDateAfter,
      endDateBefore,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { ingest, ingestionStatus, search };

