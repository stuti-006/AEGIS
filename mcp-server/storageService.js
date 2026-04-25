"use strict";

const fs = require("fs").promises;
const path = require("path");
const { google } = require("googleapis");
const config = require("./env");
const logger = require("./logger");

// ─────────────────────────────────────────────────────────────────────────────
// Option A — Local JSON file storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves evidence as a JSON file under EVIDENCE_DIR.
 * File name: evidence_<analysis_id>_<timestamp>.json
 *
 * @param {object} analysis
 * @param {string} severity
 * @returns {Promise<{ success: boolean, path?: string, error?: string }>}
 */
async function storeLocal(analysis, severity) {
  const dir = path.resolve(config.storage.evidenceDir);

  try {
    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `evidence_${analysis.analysis_id || "unknown"}_${timestamp}.json`;
    const filepath = path.join(dir, filename);

    const payload = {
      stored_at: new Date().toISOString(),
      severity,
      analysis,
    };

    await fs.writeFile(filepath, JSON.stringify(payload, null, 2), "utf8");

    logger.info("Evidence stored locally", {
      analysis_id: analysis.analysis_id,
      filepath,
    });

    return { success: true, path: filepath };
  } catch (err) {
    logger.error("Local storage failed", {
      analysis_id: analysis.analysis_id,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Option B — Google Drive (service account)
// ─────────────────────────────────────────────────────────────────────────────

let _driveClient = null;

async function getDriveClient() {
  if (_driveClient) return _driveClient;

  const keyPath = path.resolve(config.storage.gdrive.keyPath);
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  _driveClient = google.drive({ version: "v3", auth });
  return _driveClient;
}

/**
 * Uploads evidence JSON to Google Drive folder.
 *
 * @param {object} analysis
 * @param {string} severity
 * @returns {Promise<{ success: boolean, fileId?: string, error?: string }>}
 */
async function storeGDrive(analysis, severity) {
  const folderId = config.storage.gdrive.folderId;

  if (!folderId) {
    return { success: false, error: "GDRIVE_FOLDER_ID not configured" };
  }

  try {
    const drive = await getDriveClient();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `evidence_${analysis.analysis_id || "unknown"}_${timestamp}.json`;

    const payload = JSON.stringify(
      { stored_at: new Date().toISOString(), severity, analysis },
      null,
      2
    );

    const { Readable } = require("stream");
    const stream = Readable.from([payload]);

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        mimeType: "application/json",
        parents: [folderId],
      },
      media: {
        mimeType: "application/json",
        body: stream,
      },
    });

    const fileId = response.data.id;
    logger.info("Evidence uploaded to Google Drive", {
      analysis_id: analysis.analysis_id,
      fileId,
    });

    return { success: true, fileId };
  } catch (err) {
    logger.error("Google Drive upload failed", {
      analysis_id: analysis.analysis_id,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified entry point — picks backend from config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store evidence using the configured backend.
 *
 * @param {object} analysis
 * @param {string} severity
 */
async function storeEvidence(analysis, severity) {
  const backend = config.storage.backend;

  logger.info("Storing evidence", {
    analysis_id: analysis.analysis_id,
    backend,
    severity,
  });

  if (backend === "gdrive") {
    return storeGDrive(analysis, severity);
  }

  // Default: local
  return storeLocal(analysis, severity);
}

module.exports = { storeEvidence, storeLocal, storeGDrive };
