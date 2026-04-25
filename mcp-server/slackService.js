"use strict";

const axios = require("axios");
const config = require("./env");
const logger = require("./logger");

/**
 * Sends a formatted Slack alert.
 * Payload mirrors the AEGIS Python alert_service.py format exactly.
 *
 * @param {object} analysis  Structured output from FastAPI
 * @param {string} severity  HIGH | MEDIUM | LOW
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendAlert(analysis, severity = "HIGH") {
  if (!config.slack.enabled) {
    logger.warn("Slack not configured — skipping alert", {
      analysis_id: analysis.analysis_id,
    });
    return { success: false, error: "SLACK_WEBHOOK_URL not configured" };
  }

  try {
    const payload = buildSlackPayload(analysis, severity);
    const response = await axios.post(config.slack.webhookUrl, payload, {
      timeout: 5000,
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 200) {
      logger.info("Slack alert sent", { analysis_id: analysis.analysis_id });
      return { success: true };
    }

    throw new Error(`Slack returned status ${response.status}`);
  } catch (err) {
    const message = err.response?.data || err.message;
    logger.error("Failed to send Slack alert", {
      analysis_id: analysis.analysis_id,
      error: message,
    });
    return { success: false, error: String(message) };
  }
}

/**
 * Build the Slack Block Kit / attachments payload.
 * Matches the Python _build_slack_payload() structure in alert_service.py.
 */
function buildSlackPayload(analysis, severity) {
  const {
    label,
    confidence = 0,
    risk_score = 0,
    reason = "N/A",
    risk_factors = [],
    analysis_id,
    timestamp,
    message: originalMessage,
  } = analysis;

  // Colour logic from original Python code
  const color = risk_score > 80 ? "#FF0000" : "#FF9900";

  // Risk factors (first 3) — same bullet format as Python
  const riskFactorsText =
    risk_factors
      .slice(0, 3)
      .map(
        (f) =>
          `• *${f.factor || f.name || "Factor"}*: ${
            f.description || f.detail || ""
          }`
      )
      .join("\n") || "None detected";

  const severityEmoji = severity === "HIGH" ? "🚨" : "⚠️";

  const fields = [
    {
      title: "Classification",
      value: String(label).toUpperCase(),
      short: true,
    },
    {
      title: "Severity",
      value: severity,
      short: true,
    },
    {
      title: "Confidence",
      value: `${(confidence * 100).toFixed(1)}%`,
      short: true,
    },
    {
      title: "Risk Score",
      value: `${Number(risk_score).toFixed(1)}/100`,
      short: true,
    },
    {
      title: "Analysis ID",
      value: analysis_id || "N/A",
      short: true,
    },
    {
      title: "Timestamp",
      value: timestamp || new Date().toISOString(),
      short: true,
    },
    {
      title: "Reason",
      value: reason,
      short: false,
    },
    {
      title: "Risk Factors",
      value: riskFactorsText,
      short: false,
    },
  ];

  // Optionally surface the original intercepted message
  if (originalMessage) {
    fields.splice(6, 0, {
      title: "Intercepted Message",
      value: `\`\`\`${originalMessage}\`\`\``,
      short: false,
    });
  }

  return {
    attachments: [
      {
        color,
        title: `${severityEmoji} AEGIS Threat Alert`,
        title_link: `https://aegis.local/analysis/${analysis_id}`,
        fields,
        footer: "AEGIS Threat Detection System · MCP Orchestration Layer",
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
}

module.exports = { sendAlert };
