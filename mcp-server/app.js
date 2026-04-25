"use strict";

require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const config = require("./env");
const logger = require("./logger");
const processRoutes = require("./process");

const app = express();

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging (dev: coloured, prod: combined)
if (config.server.env !== "test") {
  app.use(morgan(config.server.env === "development" ? "dev" : "combined"));
}

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "AEGIS MCP Server",
    version: "1.0.0",
    env: config.server.env,
    storage_backend: config.storage.backend,
    slack_enabled: config.slack.enabled,
    uptime_seconds: Math.floor(process.uptime()),
  });
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use("/", processRoutes);

// ─────────────────────────────────────────────
// 404 handler
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─────────────────────────────────────────────
// Global error handler
// ─────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`AEGIS MCP Server running`, {
    port: PORT,
    env: config.server.env,
    storage: config.storage.backend,
    slack: config.slack.enabled ? "enabled" : "disabled",
  });
});

module.exports = app;
