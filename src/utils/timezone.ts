/**
 * Best-effort detection of the browser's IANA timezone (e.g. "Europe/Moscow",
 * "Asia/Almaty"). This is what closes the loop on the backend's timezone
 * support added in PATCH /me — without something calling that endpoint with
 * a real value, every user stays stuck on the "UTC" column default forever.
 */
export function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || 'UTC';
  } catch {
    // Very old browsers / some locked-down environments don't expose this.
    return 'UTC';
  }
}