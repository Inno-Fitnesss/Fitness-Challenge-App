import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = 'success', onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div
      role="alert"
      className={`
        fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50
        flex items-center gap-3 px-5 py-4 rounded-2xl shadow-modal
        text-sm font-semibold animate-slide-up
        ${type === 'success'
          ? 'bg-success text-green-800'
          : 'bg-red-50 text-red-700 border border-red-200'
        }
      `}
    >
      <span aria-hidden="true">{type === 'success' ? '✅' : '❌'}</span>
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть уведомление"
        className="p-1 rounded-lg hover:bg-black/5 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
