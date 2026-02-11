/**
 * Parses a pipe-delimited line into a HistoricalEvent object.
 * Format: EVENT_ID|EVENT_NAME|START_DATE_ISO|END_DATE_ISO|PARENT_ID_OR_NULL|DESCRIPTION
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str) {
  return UUID_REGEX.test(str);
}

function isValidISODate(str) {
  const date = new Date(str);
  return !isNaN(date.getTime()) && str.includes('T');
}

/**
 * Parse a single pipe-delimited line.
 * @param {string} line - The raw line from the file
 * @param {number} lineNumber - The 1-based line number (for error reporting)
 * @returns {{ event: object|null, error: string|null }}
 */
function parseLine(line, lineNumber) {
  // Skip empty lines
  if (!line || line.trim() === '') {
    return { event: null, error: null }; // Skip silently
  }

  const parts = line.split('|');

  // Must have exactly 6 fields
  if (parts.length !== 6) {
    return {
      event: null,
      error: `Line ${lineNumber}: Malformed entry (expected 6 fields, got ${parts.length}): '${line.substring(0, 120)}'`,
    };
  }

  const [eventId, eventName, startDateStr, endDateStr, parentIdStr, description] = parts.map(
    (s) => s.trim()
  );

  // Validate event_id
  if (!isValidUUID(eventId)) {
    return {
      event: null,
      error: `Line ${lineNumber}: Invalid UUID for event_id: '${eventId}'`,
    };
  }

  // Validate event_name
  if (!eventName || eventName.length === 0) {
    return {
      event: null,
      error: `Line ${lineNumber}: Missing event_name for event '${eventId}'`,
    };
  }

  // Validate start_date
  if (!isValidISODate(startDateStr)) {
    return {
      event: null,
      error: `Line ${lineNumber}: Invalid date format for start_date of event '${eventId}': '${startDateStr}'`,
    };
  }

  // Validate end_date
  if (!isValidISODate(endDateStr)) {
    return {
      event: null,
      error: `Line ${lineNumber}: Invalid date format for end_date of event '${eventId}': '${endDateStr}'`,
    };
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  // Validate end_date >= start_date
  if (endDate < startDate) {
    return {
      event: null,
      error: `Line ${lineNumber}: end_date is before start_date for event '${eventId}'`,
    };
  }

  // Validate parent_event_id (NULL or valid UUID)
  let parentEventId = null;
  if (parentIdStr && parentIdStr.toUpperCase() !== 'NULL') {
    if (!isValidUUID(parentIdStr)) {
      return {
        event: null,
        error: `Line ${lineNumber}: Invalid UUID for parent_event_id: '${parentIdStr}'`,
      };
    }
    parentEventId = parentIdStr;
  }

  // Calculate duration_minutes
  const durationMinutes = Math.round((endDate - startDate) / 60000);

  return {
    event: {
      event_id: eventId,
      event_name: eventName,
      description: description || null,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      duration_minutes: durationMinutes,
      parent_event_id: parentEventId,
      metadata: {},
    },
    error: null,
  };
}

module.exports = { parseLine, isValidUUID, isValidISODate };

