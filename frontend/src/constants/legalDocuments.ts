export const USER_AGREEMENT_URL = '/legal/user-agreement.pdf';
export const PRIVACY_POLICY_URL = '/legal/privacy-policy.pdf';

// Version = effective date ("дата вступления в силу") of the published document.
// Keep in sync with backend/app/core/legal.py — that value is what gets recorded
// against each user's consent.
export const USER_AGREEMENT_VERSION = '2026-07-22';
export const PRIVACY_POLICY_VERSION = '2026-07-22';

export const LEGAL_CONSENT_ERROR =
  'Для регистрации необходимо принять Пользовательское соглашение и дать согласие на обработку персональных данных';
