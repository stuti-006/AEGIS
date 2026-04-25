"use strict";

const config = require("./env");
const logger = require("./logger");

const { highConfidenceMin, mediumConfidenceMin } = config.decision;

/**
 * Severity levels
 * ─────────────────────────────────────────────
 * HIGH   → label == "dangerous"  AND  confidence > 0.9
 * MEDIUM → label == "suspicious" OR   confidence between 0.75–0.9
 * LOW    → everything else
 *
 * Actions
 * ─────────────────────────────────────────────
 * HIGH   → Slack alert + store evidence
 * MEDIUM → store evidence only
 * LOW    → no action
 */

/**
 * @param {object} analysis  Structured output from FastAPI
 * @returns {{ severity: string, actions: string[] }}
 */
function evaluate(analysis) {
  const { label, confidence } = analysis;

  let severity;

  if (label === "dangerous" && confidence > highConfidenceMin) {
    severity = "HIGH";
  } else if (
    label === "suspicious" ||
    (confidence >= mediumConfidenceMin && confidence <= highConfidenceMin)
  ) {
    severity = "MEDIUM";
  } else {
    severity = "LOW";
  }

  const actions = resolveActions(severity);

  logger.info("Decision evaluated", {
    analysis_id: analysis.analysis_id,
    label,
    confidence,
    severity,
    actions,
  });

  return { severity, actions };
}

/**
 * Map severity → list of action strings that should be executed.
 * @param {string} severity
 * @returns {string[]}
 */
function resolveActions(severity) {
  switch (severity) {
    case "HIGH":
      return ["alert", "store"];
    case "MEDIUM":
      return ["store"];
    case "LOW":
    default:
      return [];
  }
}

module.exports = { evaluate };
