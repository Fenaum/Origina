"""Sprint 5 §5.2 — coverage for the email sender.

The function never raises; it returns True only on a successful SMTP
delivery, False otherwise. We mock SMTP at the boundary so the test
runs without a real mail server.
"""
import pytest
from unittest.mock import patch, MagicMock


def test_send_email_skips_when_disabled(monkeypatch):
    """No SMTP_HOST → no attempt to send, returns False."""
    from app.services import notification_service
    monkeypatch.setattr(notification_service.config, "NOTIFICATIONS_ENABLED", False)

    result = notification_service.send_email(
        to="anyone@anywhere.dev",
        subject="Sprint 5 test",
        body="hello",
    )
    assert result is False


def test_send_email_returns_true_on_success(monkeypatch):
    """Successful SMTP send returns True."""
    from app.services import notification_service
    monkeypatch.setattr(notification_service.config, "NOTIFICATIONS_ENABLED", True)

    # smtplib.SMTP is used as a context manager — __enter__ returns the
    # connected instance. MagicMock supports this automatically.
    fake_smtp = MagicMock()
    with patch("smtplib.SMTP", return_value=fake_smtp):
        result = notification_service.send_email(
            to="dest@origina.dev",
            subject="OK",
            body="body",
        )
    assert result is True
    # The send_message call happens inside the with-block, so we look at
    # the MagicMock that was bound to the context-manager __enter__.
    fake_smtp.__enter__.return_value.send_message.assert_called_once()


def test_send_email_returns_false_on_smtp_failure(monkeypatch):
    """SMTP errors are swallowed; function returns False, never raises."""
    from app.services import notification_service
    monkeypatch.setattr(notification_service.config, "NOTIFICATIONS_ENABLED", True)

    with patch("smtplib.SMTP", side_effect=RuntimeError("connection refused")):
        result = notification_service.send_email(
            to="x@y.dev",
            subject="x",
            body="y",
        )
    assert result is False
