import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../context/AuthContext.tsx', () => ({
  useAuth: () => ({
    register: vi.fn(),
    verifyEmail: vi.fn(),
  }),
}));

vi.mock('./GoogleAuthButton.tsx', () => ({
  GoogleAuthButton: () => <div data-testid="google-auth" />,
}));

import { SignUpForm } from './SignUpForm.tsx';
import { PRIVACY_POLICY_URL, USER_AGREEMENT_URL } from '../../constants/legalDocuments.ts';

describe('SignUpForm legal documents', () => {
  it('renders two independent, unchecked consent controls with accessible PDF links', () => {
    render(<SignUpForm />);

    const terms = screen.getByRole('checkbox', { name: /Пользовательского соглашения/i });
    const privacy = screen.getByRole('checkbox', { name: /Политике конфиденциальности/i });
    expect(terms).not.toBeChecked();
    expect(privacy).not.toBeChecked();

    const termsLink = screen.getByRole('link', { name: 'Пользовательского соглашения' });
    const privacyLink = screen.getByRole('link', { name: 'Политике конфиденциальности' });
    expect(termsLink).toHaveAttribute('href', USER_AGREEMENT_URL);
    expect(privacyLink).toHaveAttribute('href', PRIVACY_POLICY_URL);
    expect(termsLink).toHaveAttribute('target', '_blank');
    expect(termsLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(privacyLink).toHaveAttribute('target', '_blank');
    expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer');

    fireEvent.click(termsLink);
    expect(terms).not.toBeChecked();
    expect(privacy).not.toBeChecked();

    fireEvent.click(terms);
    expect(terms).toBeChecked();
    expect(privacy).not.toBeChecked();
  });
});
