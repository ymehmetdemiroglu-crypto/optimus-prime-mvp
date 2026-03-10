"""
Notification Service for Optimus Pryme.

Sends digest notifications via multiple channels:
- In-app (stored in Supabase `notifications` table)
- Slack webhook (if configured)
- Email via SMTP (if configured)

Used by the autonomous executor to inform users about
what the system did overnight.
"""
import os
import json
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field

import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logger = logging.getLogger("notifications")

_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.getenv("SUPABASE_URL", ""),
            os.getenv("SUPABASE_KEY", ""),
        )
        try:
            _supabase.auth.sign_in_with_password({
                "email": os.getenv("SERVICE_EMAIL", ""),
                "password": os.getenv("SERVICE_PASSWORD", ""),
            })
        except Exception:
            pass
    return _supabase


@dataclass
class NotificationPayload:
    """A notification to be sent."""
    title: str
    message: str
    severity: str = "info"  # info, warning, critical
    category: str = "autonomous"  # autonomous, alert, experiment, system
    metadata: dict = field(default_factory=dict)


class NotificationService:
    """Multi-channel notification dispatcher."""

    def __init__(self):
        self.slack_webhook = os.getenv("SLACK_WEBHOOK_URL")
        self.smtp_host = os.getenv("SMTP_HOST")
        self.smtp_from = os.getenv("SMTP_FROM")

    async def send(self, payload: NotificationPayload, seller_id: str | None = None):
        """Send notification to all configured channels."""
        # Always store in-app
        self._store_in_app(payload, seller_id)

        # Slack (if configured)
        if self.slack_webhook:
            await self._send_slack(payload)

        # Email (if configured) — only for critical
        if self.smtp_host and payload.severity == "critical":
            await self._send_email(payload, seller_id)

    async def send_daily_digest(self, digest: dict):
        """Send the overnight autonomous actions digest."""
        auto_applied = digest.get("auto_applied", 0)
        notified = digest.get("notified", 0)
        queued = digest.get("queued", 0)
        experiments_concluded = digest.get("experiments_concluded", 0)
        keywords_negated = digest.get("keywords_negated", 0)
        rollouts_advanced = digest.get("rollouts_advanced", 0)

        lines = []
        if auto_applied:
            lines.append(f"Auto-optimized {auto_applied} keyword bids")
        if notified:
            lines.append(f"Applied {notified} bids (review recommended)")
        if keywords_negated:
            lines.append(f"Auto-negated {keywords_negated} wasteful search terms")
        if experiments_concluded:
            lines.append(f"Auto-concluded {experiments_concluded} A/B experiments")
        if rollouts_advanced:
            lines.append(f"Auto-advanced {rollouts_advanced} rollout stages")
        if queued:
            lines.append(f"**{queued} actions pending your approval**")

        if not lines:
            return  # Nothing to report

        message = "Overnight summary:\n" + "\n".join(f"• {l}" for l in lines)

        payload = NotificationPayload(
            title="Optimus Overnight Digest",
            message=message,
            severity="info" if queued == 0 else "warning",
            category="autonomous",
            metadata=digest,
        )

        await self.send(payload)

    def _store_in_app(self, payload: NotificationPayload, seller_id: str | None):
        """Store notification in Supabase for in-app display."""
        try:
            sb = _get_supabase()
            sb.table("notifications").insert({
                "seller_id": seller_id,
                "title": payload.title,
                "message": payload.message,
                "severity": payload.severity,
                "category": payload.category,
                "metadata": payload.metadata,
                "is_read": False,
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to store in-app notification: {e}")

    async def _send_slack(self, payload: NotificationPayload):
        """Send notification to Slack webhook."""
        if not self.slack_webhook:
            return

        severity_emoji = {
            "info": "ℹ️",
            "warning": "⚠️",
            "critical": "🚨",
        }
        emoji = severity_emoji.get(payload.severity, "ℹ️")

        slack_message = {
            "text": f"{emoji} *{payload.title}*\n{payload.message}",
        }

        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    self.slack_webhook,
                    json=slack_message,
                    timeout=10.0,
                )
        except Exception as e:
            logger.warning(f"Slack notification failed: {e}")

    async def _send_email(self, payload: NotificationPayload, seller_id: str | None):
        """Send email notification via SMTP. Only for critical alerts."""
        # Placeholder — implement with smtplib or a service like SES
        logger.info(f"[EMAIL] Would send critical alert: {payload.title}")


# Singleton instance
notification_service = NotificationService()
