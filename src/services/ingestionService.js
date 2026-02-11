const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseLine } = require('../utils/lineParser');
const { updateJob } = require('../utils/jobStore');
const eventModel = require('../models/eventModel');
const logger = require('../utils/logger');

const BATCH_SIZE = 500;

/**
 * Process a file asynchronously, inserting valid events in batches.
 * Updates job store with progress.
 */
async function processFile(filePath, jobId) {
  updateJob(jobId, { status: 'PROCESSING', startTime: new Date().toISOString() });

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let processedLines = 0;
  let errorLines = 0;
  const errors = [];
  let batch = [];

  try {
    for await (const line of rl) {
      lineNumber++;

      const { event, error } = parseLine(line, lineNumber);

      if (error) {
        errorLines++;
        errors.push(error);
        logger.warn(error);
        continue;
      }

      // Skip empty/blank lines
      if (!event) continue;

      // Populate metadata with source file info (as required by the assignment)
      event.metadata = {
        sourceFile: path.basename(filePath),
        lineNumber,
        parsedAt: new Date().toISOString(),
      };

      batch.push(event);

      // Flush batch when full
      if (batch.length >= BATCH_SIZE) {
        try {
          await eventModel.batchInsert(batch);
          processedLines += batch.length;
        } catch (dbError) {
          logger.error(`Batch insert error at line ~${lineNumber}:`, dbError.message);
          // Insert one-by-one to identify the problematic row(s)
          for (const evt of batch) {
            try {
              await eventModel.batchInsert([evt]);
              processedLines++;
            } catch (singleErr) {
              errorLines++;
              errors.push(`Line ~${lineNumber}: DB insert error for event '${evt.event_id}': ${singleErr.message}`);
            }
          }
        }
        batch = [];

        // Update progress periodically
        updateJob(jobId, {
          processedLines,
          errorLines,
          totalLines: lineNumber,
          errors: errors.slice(0, 100), // cap stored errors
        });
      }
    }

    // Flush remaining batch
    if (batch.length > 0) {
      try {
        await eventModel.batchInsert(batch);
        processedLines += batch.length;
      } catch (dbError) {
        logger.error('Final batch insert error:', dbError.message);
        for (const evt of batch) {
          try {
            await eventModel.batchInsert([evt]);
            processedLines++;
          } catch (singleErr) {
            errorLines++;
            errors.push(`DB insert error for event '${evt.event_id}': ${singleErr.message}`);
          }
        }
      }
    }

    updateJob(jobId, {
      status: 'COMPLETED',
      processedLines,
      errorLines,
      totalLines: lineNumber,
      errors: errors.slice(0, 100),
      endTime: new Date().toISOString(),
    });

    logger.info(`Ingestion job ${jobId} completed: ${processedLines} processed, ${errorLines} errors, ${lineNumber} total lines`);
  } catch (err) {
    logger.error(`Ingestion job ${jobId} failed:`, err);
    updateJob(jobId, {
      status: 'FAILED',
      processedLines,
      errorLines,
      totalLines: lineNumber,
      errors: [...errors, `Fatal error: ${err.message}`],
      endTime: new Date().toISOString(),
    });
  }
}

module.exports = { processFile };

