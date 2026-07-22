import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthLandingHero } from './AuthLandingHero.tsx';

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthLandingHero', () => {
  it('keeps identical feature text mounted while showcase photos change', () => {
    vi.useFakeTimers();
    render(<AuthLandingHero />);

    const firstFeature = screen.getByText(
      'создавайте челленджи или участвуйте в чужих',
    );
    const secondFeature = screen.getByText(
      'отслеживайте приседания, отжимания и планку',
    );

    act(() => {
      vi.advanceTimersByTime(4_500);
    });

    expect(screen.getByText('создавайте челленджи или участвуйте в чужих')).toBe(
      firstFeature,
    );
    expect(screen.getByText('отслеживайте приседания, отжимания и планку')).toBe(
      secondFeature,
    );
  });
});
