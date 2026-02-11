/**
 * In-memory job store for tracking async ingestion jobs.
 * In production, this would be backed by Redis/Bull.
 */
const crypto = require('crypto');

const jobs = new Map();

function createJob() {
  const jobId = `ingest-job-${crypto.randomUUID()}`;
  const job = {
    jobId,
    status: 'PENDING',
    processedLines: 0,
    errorLines: 0,
    totalLines: 0,
    errors: [],
    startTime: null,
    endTime: null,
  };
  jobs.set(jobId, job);
  return job;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, updates);
  return job;
}

module.exports = { createJob, getJob, updateJob };

