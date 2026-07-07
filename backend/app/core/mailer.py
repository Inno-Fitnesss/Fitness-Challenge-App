import logging
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr

from decouple import config

logger = logging.getLogger(__name__)

SMTP_HOST = config("SMTP_HOST", default="smtp.gmail.com")
SMTP_PORT = config("SMTP_PORT", default=587, cast=int)
SMTP_USER = config("SMTP_USER", default=None)
SMTP_PASSWORD = config("SMTP_PASSWORD", default=None)
SMTP_FROM_NAME = config("SMTP_FROM_NAME", default="WOWFIT")

RESET_CODE_TTL_MINUTES = 15


class Mailer:
    """Plain-SMTP mailer (STARTTLS). Gmail needs an app password, not the
    regular account password."""

    @staticmethod
    def is_configured() -> bool:
        return bool(SMTP_USER and SMTP_PASSWORD)

    @staticmethod
    def send_reset_code(to_email: str, code: str) -> None:
        if not Mailer.is_configured():
            # Dev fallback: without SMTP credentials the email can't be sent,
            # but the flow stays testable — the code shows up in server logs.
            logger.warning(
                "SMTP is not configured (empty SMTP_USER/SMTP_PASSWORD); "
                "password reset code for %s: %s", to_email, code)
            return

        body = (
            "Вы запросили восстановление пароля в WOWFIT.\n\n"
            f"Ваш код: {code}\n\n"
            f"Код действует {RESET_CODE_TTL_MINUTES} минут. "
            "Если вы не запрашивали восстановление — просто проигнорируйте это письмо."
        )
        message = MIMEText(body, "plain", "utf-8")
        message["Subject"] = f"WOWFIT: код восстановления пароля — {code}"
        message["From"] = formataddr((SMTP_FROM_NAME, SMTP_USER))
        message["To"] = to_email

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, [to_email], message.as_string())
