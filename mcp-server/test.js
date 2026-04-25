#!/usr/bin/env node
/**
 * tests/test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Quick integration smoke-tests for the AEGIS MCP Server.
 * Run: node tests/test.js
 * Requires the server to be running on PORT 3001.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const http = require("http");

const BASE = "http://localhost:3001";

// ── Helper ────────────────────────────────────────────────────────────────────

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port || 3001,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    }).on("error", reject);
  });
}

// ── Sample payloads ───────────────────────────────────────────────────────────

const HIGH_PAYLOAD = {
  label: "dangerous",
  confidence: 0.97,
  risk_score: 91.5,
  reason: "Explicit threat to cause harm to multiple individuals.",
  risk_factors: [
    { factor: "Violence", description: "Direct threats of physical harm" },
    { factor: "Specificity", description: "Named targets and location" },
  ],
  analysis_id: "test-high-001",
  timestamp: new Date().toISOString(),
  message: "I will harm everyone at the conference tomorrow.",
};

const MEDIUM_PAYLOAD = {
  label: "suspicious",
  confidence: 0.82,
  risk_score: 62.0,
  reason: "Suspicious language patterns detected.",
  risk_factors: [{ factor: "Vague threat", description: "Ambiguous harmful intent" }],
  analysis_id: "test-medium-001",
  timestamp: new Date().toISOString(),
};

const LOW_PAYLOAD = {
  label: "safe",
  confidence: 0.55,
  risk_score: 10.0,
  reason: "No harmful intent detected.",
  risk_factors: [],
  analysis_id: "test-low-001",
  timestamp: new Date().toISOString(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════");
  console.log("  AEGIS MCP Server — Integration Tests");
  console.log("═══════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.log(`  ❌ ${name}`);
      console.log(`     ${err.message}`);
      failed++;
    }
  }

  function assert(condition, msg) {
    if (!condition) throw new Error(msg);
  }

  // ── Health ──
  await test("GET /health returns ok", async () => {
    const { status, body } = await get("/health");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.status === "ok", "Expected status:ok");
  });

  // ── HIGH severity ──
  await test("POST /process HIGH → severity=HIGH, actions=[alert,stored]", async () => {
    const { status, body } = await post("/process", HIGH_PAYLOAD);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.severity === "HIGH", `Expected HIGH, got ${body.severity}`);
    // "stored" is expected even if Slack isn't configured
    assert(body.actions_taken.includes("stored"), "Expected 'stored' in actions_taken");
    console.log(`     actions_taken: [${body.actions_taken.join(", ")}]`);
  });

  // ── MEDIUM severity ──
  await test("POST /process MEDIUM → severity=MEDIUM, actions=[stored]", async () => {
    const { status, body } = await post("/process", MEDIUM_PAYLOAD);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.severity === "MEDIUM", `Expected MEDIUM, got ${body.severity}`);
    assert(body.actions_taken.includes("stored"), "Expected 'stored' in actions_taken");
  });

  // ── LOW severity ──
  await test("POST /process LOW → severity=LOW, no actions", async () => {
    const { status, body } = await post("/process", LOW_PAYLOAD);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.severity === "LOW", `Expected LOW, got ${body.severity}`);
    assert(body.actions_taken.length === 0, "Expected no actions for LOW");
  });

  // ── Validation ──
  await test("POST /process missing required fields → 400", async () => {
    const { status } = await post("/process", { risk_score: 50 });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  // ── Direct trigger-alert ──
  await test("POST /trigger-alert direct (Slack may be unconfigured)", async () => {
    const { status, body } = await post("/trigger-alert", HIGH_PAYLOAD);
    // 200 = sent, 502 = Slack not configured — both are valid responses
    assert([200, 502].includes(status), `Unexpected status ${status}`);
    console.log(`     result: ${body.status}`);
  });

  // ── Direct store-evidence ──
  await test("POST /store-evidence direct → evidence_stored", async () => {
    const { status, body } = await post("/store-evidence", HIGH_PAYLOAD);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.status === "evidence_stored", `Unexpected status: ${body.status}`);
  });

  // ── 404 ──
  await test("GET /unknown → 404", async () => {
    const { status } = await get("/unknown-route");
    assert(status === 404, `Expected 404, got ${status}`);
  });

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner crashed:", err.message);
  console.error("Is the MCP server running on port 3001?");
  process.exit(1);
});
