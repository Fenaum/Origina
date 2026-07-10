"""
Minimal email sender. Consumers build the message; this module only
delivers it. SMTP is disabled by default (when SMTP_HOST is empty) so
local dev never spams anyone.
"""
from __future__ import annotations

import logging
import smtplib
from email.mime.text import MIMEText

from app.core import config

log = logging.getLogger("origina_backend")


def send_email(to: str, subject: str, body: str) -> bool:
    """Send a plain-text email. Returns True if sent, False if skipped or failed.

    Skips silently when NOTIFICATIONS_ENABLED is False (i.e. SMTP_HOST is unset).
    Never raises — callers (notification_consumer.handle) wrap this in their
    own try/except and rely on the return value.
    """
    if not getattr(config, "NOTIFICATIONS_ENABLED", False):
        log.debug("Notifications disabled (SMTP_HOST not set) — skipping email to %s", to)
        return False
    try:
        msg = MIMEText(body, "plain")
        msg["Subject"] = subject
        msg["From"] = config.SMTP_FROM
        msg["To"] = to
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as smtp:
            smtp.starttls()
            smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
            smtp.send_message(msg)
        log.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as exc:
        log.warning("Failed to send email to %s: %s", to, exc)
        return False
