"""
Alert service for sending threats to Slack and other channels.
"""

import os
import json
import requests
from typing import Dict, Optional
from utils.logger import setup_logger
from datetime import datetime

logger = setup_logger(__name__)


class AlertService:
    """Service for sending alerts to configured channels."""
    
    def __init__(self):
        """Initialize alert service."""
        self.slack_webhook_url = os.getenv("SLACK_WEBHOOK_URL", "").strip()
        self.enabled = bool(
            self.slack_webhook_url
            and self.slack_webhook_url.startswith("https://hooks.slack.com/services/")
            and "YOUR/WEBHOOK/URL" not in self.slack_webhook_url
        )

        if self.enabled:
            logger.info("Slack alerts enabled")
        else:
            logger.warning("Slack alerts not configured (SLACK_WEBHOOK_URL not set)")
    
    def send_alert(self, analysis_result: Dict) -> bool:
        """
        Send alert if message is dangerous.
        
        Args:
            analysis_result: Analysis result from AI engine
            
        Returns:
            True if alert sent successfully, False otherwise
        """
        if analysis_result.get("label") != "dangerous":
            return False
        
        if not self.enabled:
            logger.info("Slack not configured, skipping alert")
            return False
        
        try:
            payload = self._build_slack_payload(analysis_result)
            response = requests.post(
                self.slack_webhook_url,
                json=payload,
                timeout=5
            )
            
            if response.status_code == 200:
                logger.info(
                    f"Slack alert sent for analysis {analysis_result.get('analysis_id')}"
                )
                return True
            else:
                logger.error(
                    f"Slack alert failed: {response.status_code} - {response.text}"
                )
                return False
                
        except Exception as e:
            logger.error(f"Failed to send Slack alert: {str(e)}")
            return False
    
    def _build_slack_payload(self, analysis_result: Dict) -> Dict:
        """Build Slack message payload."""
        
        risk_score = analysis_result.get("risk_score", 0)
        confidence = analysis_result.get("confidence", 0)
        
        # Color based on risk score
        color = "#FF0000" if risk_score > 80 else "#FF9900"
        
        # Build risk factors text
        risk_factors_text = ""
        for factor in analysis_result.get("risk_factors", [])[:3]:
            risk_factors_text += f"• *{factor.get('factor')}*: {factor.get('description')}\n"
        
        payload = {
            "attachments": [
                {
                    "color": color,
                    "title": "🚨 AEGIS Threat Alert",
                    "title_link": f"https://aegis.local/analysis/{analysis_result.get('analysis_id')}",
                    "fields": [
                        {
                            "title": "Classification",
                            "value": analysis_result.get("label").upper(),
                            "short": True
                        },
                        {
                            "title": "Confidence",
                            "value": f"{confidence * 100:.1f}%",
                            "short": True
                        },
                        {
                            "title": "Risk Score",
                            "value": f"{risk_score:.1f}/100",
                            "short": True
                        },
                        {
                            "title": "Analysis ID",
                            "value": analysis_result.get("analysis_id"),
                            "short": True
                        },
                        {
                            "title": "Reason",
                            "value": analysis_result.get("reason"),
                            "short": False
                        },
                        {
                            "title": "Risk Factors",
                            "value": risk_factors_text or "None detected",
                            "short": False
                        }
                    ],
                    "footer": "AEGIS Threat Detection System",
                    "ts": int(datetime.utcnow().timestamp())
                }
            ]
        }
        
        return payload
