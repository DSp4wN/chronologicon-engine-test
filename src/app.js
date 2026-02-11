const express = require('express');
const cors = require('cors');
const eventRoutes = require('./routes/eventRoutes');
const timelineRoutes = require('./routes/timelineRoutes');
const insightRoutes = require('./routes/insightRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Global Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/events', eventRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/insights', insightRoutes);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;

