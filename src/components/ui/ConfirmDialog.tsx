import { useEffect } from 'react';
import { Button } from './Button.tsx';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.ts';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  tone = 'default',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, isLoading, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <button
        type="button"
        aria-label="Отмена"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => !isLoading && onCancel()}
      />

      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6 pointer-events-none">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={description ? 'confirm-dialog-desc' : undefined}
          className="pointer-events-auto relative bg-white rounded-t-3xl sm:rounded-3xl shadow-modal w-full sm:max-w-[420px] mx-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 animate-fade-in"
        >
          <h2 id="confirm-dialog-title" className="text-lg font-extrabold text-neutral-text mb-2">
            {title}
          </h2>
          {description && (
            <p
              id="confirm-dialog-desc"
              className="text-sm text-neutral-secondary leading-relaxed mb-6"
            >
              {description}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="secondary" size="md" onClick={onCancel} disabled={isLoading}>
              {cancelLabel}
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={onConfirm}
              isLoading={isLoading}
              className={
                tone === 'danger'
                  ? '!bg-red-500 hover:!bg-red-600 disabled:hover:!bg-red-500'
                  : ''
              }
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
