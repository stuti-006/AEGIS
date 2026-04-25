"""
Storage service for persisting analysis logs and evidence.
"""

import json
import os
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional
from utils.logger import setup_logger

logger = setup_logger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "aegis.db")
LOG_FILE = os.path.join(DATA_DIR, "analysis_log.jsonl")


class StorageService:
    """Service for storing analysis logs and evidence."""

    def __init__(self):
        """Initialize storage service."""
        self._init_database()
        logger.info("Storage service initialized")

    def _init_database(self):
        """Initialize SQLite database."""
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            # Create analysis table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS analyses (
                    analysis_id TEXT PRIMARY KEY,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    user_id TEXT,
                    message TEXT,
                    label TEXT,
                    confidence REAL,
                    reason TEXT,
                    risk_factors TEXT,
                    risk_score REAL,
                    full_response TEXT,
                    created_at DATETIME
                )
            """
            )

            # Lightweight migration: add user_id column if the DB existed before.
            try:
                cursor.execute("PRAGMA table_info(analyses)")
                cols = {row[1] for row in cursor.fetchall()}
                if "user_id" not in cols:
                    cursor.execute("ALTER TABLE analyses ADD COLUMN user_id TEXT")
            except Exception:
                # Non-fatal; keep running even if migration fails.
                pass

            # Create alerts table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS alerts (
                    alert_id TEXT PRIMARY KEY,
                    analysis_id TEXT UNIQUE,
                    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    alert_type TEXT,
                    status TEXT,
                    FOREIGN KEY(analysis_id) REFERENCES analyses(analysis_id)
                )
            """
            )

            # Create indices
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_analyses_timestamp 
                ON analyses(timestamp DESC)
            """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_analyses_label 
                ON analyses(label)
            """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_analyses_user
                ON analyses(user_id)
            """
            )

            conn.commit()
            conn.close()
            logger.info(f"Database initialized at {DB_PATH}")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")

    def save_analysis(self, analysis_result: Dict) -> bool:
        """
        Save analysis result to storage.

        Args:
            analysis_result: Analysis result from AI engine

        Returns:
            True if saved successfully
        """
        try:
            # Save to SQLite
            self._save_to_sqlite(analysis_result)

            # Save to JSONL (for easier export)
            self._save_to_jsonl(analysis_result)

            logger.info(f"Analysis {analysis_result.get('analysis_id')} saved")
            return True
        except Exception as e:
            logger.error(f"Failed to save analysis: {e}")
            return False

    def _save_to_sqlite(self, analysis_result: Dict):
        """Save analysis to SQLite database."""
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            # The message is now required for history replay
            message = analysis_result.get("evidence", {}).get(
                "message"
            ) or analysis_result.get("message", "")

            cursor.execute(
                """
                INSERT INTO analyses 
                (analysis_id, user_id, message, label, confidence, reason, risk_factors, risk_score, full_response, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    analysis_result.get("analysis_id"),
                    analysis_result.get("user_id"),
                    message,
                    analysis_result.get("label"),
                    analysis_result.get("confidence"),
                    analysis_result.get("summary", analysis_result.get("reason", "")),
                    json.dumps(analysis_result.get("breakdown", [])),
                    analysis_result.get("risk_score"),
                    json.dumps(analysis_result),
                    analysis_result.get("timestamp"),
                ),
            )

            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"SQLite save failed: {e}")
            raise

    def _save_to_jsonl(self, analysis_result: Dict):
        """Save analysis to JSONL file (excludes message for privacy)."""
        try:
            safe_result = {
                "analysis_id": analysis_result.get("analysis_id"),
                "label": analysis_result.get("label"),
                "confidence": analysis_result.get("confidence"),
                "reason": analysis_result.get("reason"),
                "risk_factors": analysis_result.get("risk_factors"),
                "risk_score": analysis_result.get("risk_score"),
                "timestamp": analysis_result.get("timestamp"),
            }

            with open(LOG_FILE, "a") as f:
                f.write(json.dumps(safe_result) + "\n")
        except Exception as e:
            logger.error(f"JSONL save failed: {e}")
            raise

    def get_recent_analyses(self, limit: int = 50, user_id: str | None = None) -> List[Dict]:
        """
        Get recent analyses from database.

        Args:
            limit: Number of records to retrieve

        Returns:
            List of analysis records
        """
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            if user_id:
                cursor.execute(
                    """
                    SELECT * FROM analyses
                    WHERE user_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                """,
                    (user_id, limit),
                )
            else:
                cursor.execute(
                    """
                    SELECT * FROM analyses 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                """,
                    (limit,),
                )

            rows = cursor.fetchall()
            conn.close()

            results = []
            for row in rows:
                if row["full_response"]:
                    try:
                        res = json.loads(row["full_response"])
                        # Ensure basic fields are present if missing from full_response
                        res["analysis_id"] = (
                            res.get("analysis_id") or row["analysis_id"]
                        )
                        res["timestamp"] = res.get("timestamp") or row["timestamp"]
                        results.append(res)
                        continue
                    except:
                        pass

                results.append(
                    {
                        "analysis_id": row["analysis_id"],
                        "timestamp": row["timestamp"],
                        "label": row["label"],
                        "confidence": row["confidence"],
                        "reason": row["reason"],
                        "risk_factors": (
                            json.loads(row["risk_factors"])
                            if row["risk_factors"]
                            else []
                        ),
                        "risk_score": row["risk_score"],
                        "message": row["message"],
                        "user_id": row["user_id"],
                    }
                )

            return results
        except Exception as e:
            logger.error(f"Failed to get recent analyses: {e}")
            return []

    def get_analysis_statistics(self, user_id: str | None = None) -> Dict:
        """
        Get statistics about stored analyses.

        If user_id is provided, statistics are scoped to that user.
        """
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            where = ""
            args = ()
            if user_id:
                where = "WHERE user_id = ?"
                args = (user_id,)

            cursor.execute(f"SELECT COUNT(*) FROM analyses {where}", args)
            total_analyses = cursor.fetchone()[0]

            cursor.execute(f"SELECT label, COUNT(*) FROM analyses {where} GROUP BY label", args)
            by_label = {row[0]: row[1] for row in cursor.fetchall()}

            cursor.execute(f"SELECT AVG(confidence) FROM analyses {where}", args)
            average_confidence = cursor.fetchone()[0] or 0.0

            cursor.execute(f"SELECT AVG(risk_score) FROM analyses {where}", args)
            average_risk_score = cursor.fetchone()[0] or 0.0

            conn.close()

            return {
                "total_analyses": int(total_analyses),
                "by_label": by_label,
                "average_confidence": float(round(average_confidence, 4)),
                "average_risk_score": float(round(average_risk_score, 2)),
            }
        except Exception as e:
            logger.error(f"Failed to get analysis statistics: {e}")
            return {
                "total_analyses": 0,
                "by_label": {},
                "average_confidence": 0.0,
                "average_risk_score": 0.0,
            }
