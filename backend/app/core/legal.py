"""Server-owned versions of legal documents accepted during registration."""

# Version = effective date ("дата вступления в силу") of the published document.
# Bump when a new approved version is published so consent records stay auditable.
USER_AGREEMENT_VERSION = "2026-07-22"
PRIVACY_POLICY_VERSION = "2026-07-22"

CONSENT_REQUIRED_MESSAGE = (
    "Для регистрации необходимо принять Пользовательское соглашение и дать "
    "согласие на обработку персональных данных"
)
