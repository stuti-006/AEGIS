"use strict";

/**
 * Minimal structured logger.
 * In production swap this with winston/pino — the interface is the same.
 */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel =
  LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

function log(level, message, meta = {}) {
  if (LEVELS[level] > currentLevel) return;
  const entry = {
    ts: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...meta,
  };
  const out = level === "error" ? console.error : console.log;
  out(JSON.stringify(entry));
}

const logger = {
  info: (msg, meta) => log("info", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  error: (msg, meta) => log("error", msg, meta),
  debug: (msg, meta) => log("debug", msg, meta),
};

module.exports = logger;
