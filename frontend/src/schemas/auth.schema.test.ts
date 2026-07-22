import { describe, expect, it } from 'vitest';
import { signUpSchema } from './auth.schema.ts';
import {
  LEGAL_CONSENT_ERROR,
  PRIVACY_POLICY_URL,
  USER_AGREEMENT_URL,
} from '../constants/legalDocuments.ts';

const validSignup = {
  username: 'runner',
  email: 'runner@example.com',
  password: 'Password123!',
  confirmPassword: 'Password123!',
  termsAccepted: true,
  privacyAccepted: true,
};

describe('signUpSchema legal consents', () => {
  it.each(['termsAccepted', 'privacyAccepted'] as const)(
    'rejects registration when %s is false',
    (field) => {
      const result = signUpSchema.safeParse({ ...validSignup, [field]: false });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message === LEGAL_CONSENT_ERROR)).toBe(true);
      }
    },
  );

  it('accepts registration only when both consents are true', () => {
    expect(signUpSchema.safeParse(validSignup).success).toBe(true);
  });

  it('keeps stable public PDF addresses', () => {
    expect(USER_AGREEMENT_URL).toBe('/legal/user-agreement.pdf');
    expect(PRIVACY_POLICY_URL).toBe('/legal/privacy-policy.pdf');
  });
});
