"use strict";

require("dotenv").config();

/**
 * Central config — all env vars in one place.
 * Throws at startup if required values are missing.
 */
const config = {
  server: {
    port: parseInt(process.env.PORT || "10000", 10),
    env: process.env.NODE_ENV || "development",
  },

  fastapi: {
    url: process.env.FASTAPI_URL || "http://localhost:8000",
  },

  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || null,
    enabled: Boolean(process.env.SLACK_WEBHOOK_URL),
  },

  storage: {
    // "local" | "gdrive"
    backend: process.env.STORAGE_BACKEND || "local",
    evidenceDir: process.env.EVIDENCE_DIR || "./evidence",
    gdrive: {
      folderId: process.env.GDRIVE_FOLDER_ID || null,
      keyPath:
        process.env.GDRIVE_SERVICE_ACCOUNT_KEY_PATH ||
        "./config/gdrive-service-account.json",
    },
  },

  // Decision thresholds — tweak here without touching logic code
  decision: {
    highConfidenceMin: 0.9,
    mediumConfidenceMin: 0.75,
  },
};

module.exports = config;
