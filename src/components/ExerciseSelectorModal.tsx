import { useEffect, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { EXERCISE_TEMPLATES } from '../data/exercises.ts';
import type { ExerciseTemplate } from '../types/challenge.ts';

interface ExerciseSelectorModalProps {
  selectedIds: string[];
  onSelect: (template: ExerciseTemplate) => void;
  onClose: () => void;
}

export function ExerciseSelectorModal({ selectedIds, onSelect, onClose }: ExerciseSelectorModalProps) {
  const [query, setQuery] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = EXERCISE_TEMPLATES.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Выбор упражнения"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-modal animate-scale-in overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-text">Выберите упражнение</h2>
            <p className="text-sm text-neutral-secondary mt-0.5">Нажмите на карточку для добавления</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-card text-neutral-secondary hover:text-neutral-text transition-all duration-150"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-secondary pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск упражнений..."
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-card border border-neutral-border rounded-xl text-sm text-neutral-text placeholder:text-neutral-secondary focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all duration-150"
            />
          </div>
        </div>

        <div className="px-6 pb-6 max-h-[420px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-neutral-secondary text-sm">
              Упражнения не найдены
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {filtered.map((template) => {
                const isSelected = selectedIds.includes(template.id);
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onSelect(template)}
                    aria-pressed={isSelected}
                    className={`
                      relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-center
                      transition-all duration-200 cursor-pointer
                      ${isSelected
                        ? 'border-brand bg-brand/5 shadow-sm'
                        : 'border-neutral-border bg-white hover:border-brand/40 hover:bg-brand/3 hover:shadow-sm'
                      }
                    `}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center bg-brand rounded-full">
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </span>
                    )}
                    <span className="text-3xl leading-none">{template.icon}</span>
                    <span className="text-xs font-semibold text-neutral-text leading-tight">{template.name}</span>
                    <span className="text-[10px] text-neutral-secondary leading-tight line-clamp-2">{template.description}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
