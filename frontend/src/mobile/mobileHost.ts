function getBooleanEnv(value: unknown): boolean | null {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return null;
}

export function shouldUseMobileExperience(): boolean {
  const forced = getBooleanEnv(import.meta.env.VITE_FORCE_MOBILE_APP);
  if (forced !== null) return forced;

  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get('mobile') === '1') return true;
  if (params.get('desktop') === '1') return false;

  const hostname = window.location.hostname.toLowerCase();
  return hostname.startsWith('m.') || hostname.startsWith('mobile.');
}
