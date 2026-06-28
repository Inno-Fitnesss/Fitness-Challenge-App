const DISPLAY_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DATE_MIN_ISO = '2020-01-01';
export const DATE_MAX_ISO = '2035-12-31';

export function todayIso(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoToDisplay(iso: string): string {
  if (!iso || !ISO_RE.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function displayToIso(display: string): string | null {
  const match = display.trim().match(DISPLAY_RE);
  if (!match) return null;
  return isValidIsoDate(`${match[3]}-${match[2]}-${match[1]}`)
    ? `${match[3]}-${match[2]}-${match[1]}`
    : null;
}

export function isValidIsoDate(iso: string): boolean {
  const match = iso.match(ISO_RE);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 2020 || year > 2035 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function formatIsoForDisplay(iso: string): string {
  if (!isValidIsoDate(iso)) return '';
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

/** @deprecated Use native date input with ISO values instead. */
export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}
