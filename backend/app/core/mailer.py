import logging
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr

import requests
from decouple import config

logger = logging.getLogger(__name__)

SMTP_HOST = config("SMTP_HOST", default="smtp.gmail.com")
SMTP_PORT = config("SMTP_PORT", default=587, cast=int)
SMTP_USER = config("SMTP_USER", default=None)
SMTP_PASSWORD = config("SMTP_PASSWORD", default=None)
SMTP_FROM_NAME = config("SMTP_FROM_NAME", default="WOWFIT")
# Envelope/From address. For Gmail the login IS the address, so it falls back to
# SMTP_USER. Relays like UniOne use a numeric login (e.g. 7161392), so the
# actual sender must be set separately to a verified address (e.g.
# no-reply@wowfit.pro) — otherwise "From: WOWFIT <7161392>" is rejected.
# `or SMTP_USER` (not decouple's default=) so a present-but-empty env var —
# how docker-compose passes an unset value — still falls back correctly.
SMTP_FROM_EMAIL = config("SMTP_FROM_EMAIL", default="") or SMTP_USER

# UniOne's HTTPS API. The prod host blocks outbound SMTP — 587/465/2525 all
# time out there (to any relay: UniOne, Gmail, Yandex) while 443 is open — so
# plain SMTP simply cannot deliver from that machine. Setting UNIONE_API_KEY
# switches the transport to HTTPS; leaving it empty keeps the SMTP path, which
# is what local dev and the old hi-baam.space box still use (Gmail creds there,
# and its ports aren't blocked).
UNIONE_API_KEY = config("UNIONE_API_KEY", default="") or ""
# `or` rather than decouple's default=, for the same reason as SMTP_FROM_EMAIL
# above: docker-compose passes an unset variable through as an empty string,
# which would otherwise win over the default and leave us POSTing to "".
UNIONE_API_URL = config("UNIONE_API_URL", default="") or \
    "https://eu1.unione.io/ru/transactional/api/v1/email/send.json"
# A no-reply From with nowhere to reply to scores slightly worse with inbox
# filters; point replies at a mailbox that exists. Empty = header omitted.
REPLY_TO_EMAIL = config("REPLY_TO_EMAIL", default="") or ""
# UniOne appends an "unsubscribe from the mailing" footer to every message and
# rejects the field that suppresses it (error 1588) until support sets the
# account's allow_skip_unsubscribe flag. A footer offering to unsubscribe from
# a password-reset code is both wrong and a Promotions-tab signal, so this is
# a switch rather than a constant: once the flag is granted, set the env var
# and restart — no code change, no redeploy. Turning it on without the flag
# makes UniOne refuse every send, hence off by default.
UNIONE_SKIP_UNSUBSCRIBE = (config("UNIONE_SKIP_UNSUBSCRIBE", default="") or "0") == "1"

# Одноразовые коды из писем (сброс пароля, подтверждение email) живут одинаково.
CODE_TTL_MINUTES = 15


class Mailer:
    """Sends the one-off codes over one of two transports: UniOne's HTTPS API
    when UNIONE_API_KEY is set, plain SMTP (STARTTLS) otherwise. Gmail needs an
    app password, not the regular account password."""

    @staticmethod
    def is_configured() -> bool:
        return bool(UNIONE_API_KEY or (SMTP_USER and SMTP_PASSWORD))

    @staticmethod
    def _send(to_email: str, subject: str, body: str) -> None:
        """The single point where mail actually leaves the process — conftest
        monkeypatches exactly this to catch stray sends in tests, so every
        transport has to stay behind it."""
        if UNIONE_API_KEY:
            Mailer._send_via_api(to_email, subject, body)
        else:
            Mailer._send_via_smtp(to_email, subject, body)

    @staticmethod
    def _send_via_api(to_email: str, subject: str, body: str) -> None:
        if not SMTP_FROM_EMAIL:
            raise RuntimeError(
                "SMTP_FROM_EMAIL is required when sending via the UniOne API "
                "(it must be an address on a domain verified with them)")

        message = {
            "recipients": [{"email": to_email}],
            "body": {"plaintext": body},
            "subject": subject,
            "from_email": SMTP_FROM_EMAIL,
            "from_name": SMTP_FROM_NAME,
            # These are transactional, not marketing. The open-tracking pixel
            # and the link rewriting (which points links at a unione.io
            # redirector) are both signals that land mail in Gmail's
            # "Promotions" tab — a place where a login code is useless.
            "track_links": 0,
            "track_read": 0,
        }
        if UNIONE_SKIP_UNSUBSCRIBE:
            # Drops both the visible footer and the List-Unsubscribe header.
            message["skip_unsubscribe"] = 1
        if REPLY_TO_EMAIL:
            message["headers"] = {"Reply-To": REPLY_TO_EMAIL}

        response = requests.post(
            UNIONE_API_URL,
            json={"message": message},
            headers={"X-API-KEY": UNIONE_API_KEY},
            timeout=15,
        )
        # Refusals arrive as HTTP 4xx with the reason in the JSON body, so read
        # both before treating the message as sent — a bare status_code check
        # would call a rejected send a success.
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        if response.status_code != 200 or payload.get("status") != "success":
            raise RuntimeError(
                "UniOne rejected the message (HTTP %s): %s" % (
                    response.status_code,
                    payload.get("message") or response.text[:200]))

    @staticmethod
    def _send_via_smtp(to_email: str, subject: str, body: str) -> None:
        message = MIMEText(body, "plain", "utf-8")
        message["Subject"] = subject
        message["From"] = formataddr((SMTP_FROM_NAME, SMTP_FROM_EMAIL))
        message["To"] = to_email
        if REPLY_TO_EMAIL:
            message["Reply-To"] = REPLY_TO_EMAIL

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to_email], message.as_string())

    @staticmethod
    def _send_code(to_email: str, code: str, log_label: str,
                   subject: str, body: str) -> None:
        if not Mailer.is_configured():
            # Dev fallback: without credentials the email can't be sent, but the
            # flow stays testable — the code shows up in server logs.
            logger.warning(
                "Mailer is not configured (no UNIONE_API_KEY, empty "
                "SMTP_USER/SMTP_PASSWORD); %s for %s: %s",
                log_label, to_email, code)
            return
        Mailer._send(to_email, subject, body)

    # NB: тесты и userService ссылаются на send_reset_code/send_verification_code
    # по имени (monkeypatch, background_tasks) — не переименовывать.
    @staticmethod
    def send_reset_code(to_email: str, code: str) -> None:
        Mailer._send_code(
            to_email, code, "password reset code",
            f"WOWFIT: код восстановления пароля — {code}",
            "Вы запросили восстановление пароля в WOWFIT.\n\n"
            f"Ваш код: {code}\n\n"
            f"Код действует {CODE_TTL_MINUTES} минут. "
            "Если вы не запрашивали восстановление — просто проигнорируйте это письмо.",
        )

    @staticmethod
    def send_verification_code(to_email: str, code: str) -> None:
        Mailer._send_code(
            to_email, code, "email verification code",
            f"WOWFIT: подтверждение email — {code}",
            "Добро пожаловать в WOWFIT!\n\n"
            f"Ваш код подтверждения email: {code}\n\n"
            f"Код действует {CODE_TTL_MINUTES} минут. "
            "Если вы не регистрировались в WOWFIT — просто проигнорируйте это письмо.",
        )
