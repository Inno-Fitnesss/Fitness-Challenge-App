import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { readImageFileAsDataUrl } from '../../utils/profileAvatarStorage.ts';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.ts';

interface ProfileEditModalProps {
  username: string;
  avatarUrl: string | null;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (username: string, avatarUrl: string | null) => void;
}

export function ProfileEditModal({
  username,
  avatarUrl,
  isSaving,
  error,
  onClose,
  onSave,
}: ProfileEditModalProps) {
  useBodyScrollLock(true);
  const [draftUsername, setDraftUsername] = useState(username);
  const [draftAvatarUrl, setDraftAvatarUrl] = useState<string | null>(avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftUsername(username);
    setDraftAvatarUrl(avatarUrl);
  }, [username, avatarUrl]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSaving, onClose]);

  const handleAvatarPick = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return;
    const dataUrl = await readImageFileAsDataUrl(file);
    setDraftAvatarUrl(dataUrl);
  };

  const avatarFallback = draftUsername.charAt(0).toUpperCase() || '?';

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-title"
    >
      <button
        type="button"
        aria-label="Закрыть"
        disabled={isSaving}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!isSaving) onClose();
        }}
      />
      <div className="absolute inset-x-0 top-0 h-[100dvh] flex items-center justify-center modal-safe-x py-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-md max-h-[92dvh] overflow-y-auto overflow-x-hidden bg-white rounded-3xl shadow-modal p-6 sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="profile-edit-title" className="text-lg font-bold text-neutral-text text-center mb-6">
          Редактирование профиля
        </h2>

        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-accent overflow-hidden flex items-center justify-center text-4xl font-extrabold text-white">
              {draftAvatarUrl ? (
                <img src={draftAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                avatarFallback
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
              aria-label="Изменить фото профиля"
              className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center shadow-card hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              <Pencil size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleAvatarPick(event.target.files?.[0])}
            />
          </div>

          {draftAvatarUrl && (
            <button
              type="button"
              onClick={() => setDraftAvatarUrl(null)}
              disabled={isSaving}
              className="mt-3 text-xs font-medium text-neutral-muted hover:text-brand transition-colors"
            >
              Убрать фото
            </button>
          )}
        </div>

        <div className="mb-6">
          <label htmlFor="profile-edit-username" className="sr-only">
            Никнейм
          </label>
          <input
            id="profile-edit-username"
            type="text"
            value={draftUsername}
            onChange={(event) => setDraftUsername(event.target.value)}
            maxLength={50}
            disabled={isSaving}
            className="w-full min-w-0 px-1 py-2 border-0 border-b-2 border-neutral-border text-center text-lg font-semibold text-neutral-text focus:outline-none focus:border-brand disabled:opacity-60"
            autoComplete="username"
          />
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-500 text-center" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-5 py-3 rounded-2xl text-sm font-semibold bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={() => onSave(draftUsername.trim(), draftAvatarUrl)}
            disabled={isSaving || !draftUsername.trim()}
            className="flex-1 px-5 py-3 rounded-2xl text-sm font-semibold bg-lime text-neutral-text hover:bg-lime-hover transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
