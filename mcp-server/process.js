"use strict";

const { Router } = require("express");
const {
  handleProcess,
  handleTriggerAlert,
  handleStoreEvidence,
} = require("./processController");

const router = Router();

/**
 * POST /process
 * Primary entry point — receives FastAPI analysis result, runs decision logic,
 * triggers alert and/or storage based on severity.
 *
 * Body: full FastAPI analysis JSON
 * Returns: { status, severity, actions_taken, detail }
 */
router.post("/process", handleProcess);

/**
 * POST /trigger-alert
 * Manually fire a Slack alert for any analysis result.
 * Useful for testing or manual escalation.
 *
 * Body: analysis JSON + optional { "severity": "HIGH" }
 */
router.post("/trigger-alert", handleTriggerAlert);

/**
 * POST /store-evidence
 * Manually persist evidence for any analysis result.
 * Useful for testing or archiving LOW severity cases on demand.
 *
 * Body: analysis JSON + optional { "severity": "LOW" }
 */
router.post("/store-evidence", handleStoreEvidence);

module.exports = router;
