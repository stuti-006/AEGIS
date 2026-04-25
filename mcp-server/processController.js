"use strict";

const { evaluate } = require("./decisionEngine");
const { sendAlert } = require("./slackService");
const { storeEvidence } = require("./storageService");
const logger = require("./logger");

// ─────────────────────────────────────────────────────────────────────────────
// POST /process
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main orchestration handler.
 * Receives analysis result from FastAPI, evaluates severity,
 * and dispatches the appropriate actions in parallel.
 */
async function handleProcess(req, res) {
  const analysis = req.body;

  // Basic schema validation
  const missing = ["label", "confidence", "analysis_id"].filter(
    (k) => analysis[k] === undefined || analysis[k] === null
  );
  if (missing.length) {
    return res.status(400).json({
      error: "Invalid analysis payload",
      missing_fields: missing,
    });
  }

  try {
    // 1. Decide severity + which actions to run
    const { severity, actions } = evaluate(analysis);

    // 2. Execute actions concurrently
    const actionResults = {};
    const actionsTaken = [];

    const tasks = [];

    if (actions.includes("alert")) {
      tasks.push(
        sendAlert(analysis, severity).then((result) => {
          actionResults.alert = result;
          if (result.success) actionsTaken.push("alert");
        })
      );
    }

    if (actions.includes("store")) {
      tasks.push(
        storeEvidence(analysis, severity).then((result) => {
          actionResults.store = result;
          if (result.success) actionsTaken.push("stored");
        })
      );
    }

    await Promise.allSettled(tasks);

    logger.info("Process complete", {
      analysis_id: analysis.analysis_id,
      severity,
      actions_taken: actionsTaken,
    });

    return res.status(200).json({
      status: "processed",
      severity,
      actions_taken: actionsTaken,
      detail: actionResults,
    });
  } catch (err) {
    logger.error("Process handler error", { error: err.message });
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /trigger-alert
// Direct Slack alert — bypasses decision logic (manual override / testing)
// ─────────────────────────────────────────────────────────────────────────────

async function handleTriggerAlert(req, res) {
  const analysis = req.body;
  const severity = req.body.severity || "HIGH";

  if (!analysis.analysis_id) {
    return res.status(400).json({ error: "analysis_id is required" });
  }

  try {
    const result = await sendAlert(analysis, severity);
    return res.status(result.success ? 200 : 502).json({
      status: result.success ? "alert_sent" : "alert_failed",
      ...result,
    });
  } catch (err) {
    logger.error("Trigger-alert handler error", { error: err.message });
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /store-evidence
// Direct storage — bypasses decision logic (manual override / testing)
// ─────────────────────────────────────────────────────────────────────────────

async function handleStoreEvidence(req, res) {
  const analysis = req.body;
  const severity = req.body.severity || "MEDIUM";

  if (!analysis.analysis_id) {
    return res.status(400).json({ error: "analysis_id is required" });
  }

  try {
    const result = await storeEvidence(analysis, severity);
    return res.status(result.success ? 200 : 500).json({
      status: result.success ? "evidence_stored" : "storage_failed",
      ...result,
    });
  } catch (err) {
    logger.error("Store-evidence handler error", { error: err.message });
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}

module.exports = { handleProcess, handleTriggerAlert, handleStoreEvidence };
