const AVATAR_PREFIX = 'wowfit_profile_avatar_';

export function getStoredAvatarUrl(userId: number): string | null {
  try {
    return localStorage.getItem(`${AVATAR_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

export function setStoredAvatarUrl(userId: number, dataUrl: string | null): void {
  try {
    const key = `${AVATAR_PREFIX}${userId}`;
    if (!dataUrl) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, dataUrl);
    }
    window.dispatchEvent(new CustomEvent('wowfit-avatar-updated', { detail: { userId } }));
  } catch {
    // ignore quota errors
  }
}

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}
