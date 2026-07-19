import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner.tsx';

const BANNER_TEXT = /Подключитесь к интернету/;

function setNavigatorOnLine(value: boolean) {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OfflineBanner', () => {
  it('не показывается, когда сеть есть', () => {
    setNavigatorOnLine(true);
    render(<OfflineBanner />);
    expect(screen.queryByText(BANNER_TEXT)).toBeNull();
  });

  it('показывается сразу, если приложение открыли без сети (PWA с иконки)', () => {
    setNavigatorOnLine(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent(BANNER_TEXT);
  });

  it('появляется по событию offline и исчезает по online', () => {
    setNavigatorOnLine(true);
    render(<OfflineBanner />);
    expect(screen.queryByText(BANNER_TEXT)).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(BANNER_TEXT);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(BANNER_TEXT)).toBeNull();
  });

  it('снимает слушатели при размонтировании', () => {
    setNavigatorOnLine(true);
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<OfflineBanner />);
    unmount();
    const removed = removeSpy.mock.calls.map((c) => c[0]);
    expect(removed).toContain('offline');
    expect(removed).toContain('online');
  });
});
