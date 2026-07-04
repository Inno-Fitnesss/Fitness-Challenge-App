import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import type { ApiExercise } from '../../types/api.types.ts';

interface ExerciseSelectProps {
  exercises: ApiExercise[];
  value: number | null;
  usedExerciseIds: Set<number>;
  onChange: (exerciseId: number) => void;
}

interface MenuPos {
  top: number;
  left: number;
  width: number;
  openUp: boolean;
}

const MENU_MAX_HEIGHT = 256;

/**
 * Styled exercise picker. The menu is portaled to <body> so it is never clipped
 * by the form's overflow-hidden section or the modal's scroll container.
 */
export function ExerciseSelect({ exercises, value, usedExerciseIds, onChange }: ExerciseSelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = exercises.find((e) => e.id === value) ?? null;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < MENU_MAX_HEIGHT + 16 && rect.top > spaceBelow;
    setPos({ top: openUp ? rect.top : rect.bottom, left: rect.left, width: rect.width, openUp });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => updatePosition();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 text-left text-base font-medium rounded-lg px-1 py-1 transition-colors ${
          selected ? 'text-neutral-text' : 'text-neutral-muted'
        }`}
      >
        <span className="truncate lowercase">
          {selected ? selected.name.toLowerCase() : 'выберите упражнение'}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-neutral-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: pos.openUp ? undefined : pos.top + 6,
              bottom: pos.openUp ? window.innerHeight - pos.top + 6 : undefined,
              left: pos.left,
              width: pos.width,
              maxHeight: MENU_MAX_HEIGHT,
            }}
            className="z-[70] overflow-y-auto bg-white rounded-2xl border border-neutral-border shadow-modal p-1.5"
          >
            {exercises.map((exercise) => {
              const isSelected = exercise.id === value;
              const isUsed = !isSelected && usedExerciseIds.has(exercise.id);
              return (
                <button
                  key={exercise.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={isUsed}
                  onClick={() => {
                    onChange(exercise.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 text-left text-base rounded-xl px-3.5 py-3 transition-colors lowercase ${
                    isSelected
                      ? 'bg-brand/10 text-brand font-semibold'
                      : isUsed
                        ? 'text-neutral-muted/60 cursor-not-allowed'
                        : 'text-neutral-text hover:bg-neutral-card'
                  }`}
                >
                  <span className="truncate">{exercise.name.toLowerCase()}</span>
                  {isSelected && <Check size={16} className="flex-shrink-0" />}
                  {isUsed && (
                    <span className="text-[10px] font-medium flex-shrink-0 uppercase tracking-wide text-neutral-muted">
                      добавлено
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
