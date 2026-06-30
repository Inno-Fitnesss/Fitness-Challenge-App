import { Calendar } from 'lucide-react';
import { useId, useRef } from 'react';
import {
  DATE_MAX_ISO,
  DATE_MIN_ISO,
  formatIsoForDisplay,
  isValidIsoDate,
} from '../../utils/dateFormat.ts';

interface DateFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
}

export function DateField({
  id,
  label,
  value,
  onChange,
  min = DATE_MIN_ISO,
  max = DATE_MAX_ISO,
  disabled = false,
  required = false,
  hint,
}: DateFieldProps) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input || disabled) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  };

  const handleChange = (nextValue: string) => {
    if (!nextValue || isValidIsoDate(nextValue)) {
      onChange(nextValue);
    }
  };

  const readableValue = value && isValidIsoDate(value) ? formatIsoForDisplay(value) : '';

  return (
    <div className="min-w-0 max-w-full">
      <label htmlFor={fieldId} className="block text-xs text-neutral-secondary mb-1.5">
        {label}
        {required && <span className="text-brand ml-0.5">*</span>}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id={fieldId}
          type="date"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={(e) => {
            if (e.target.value && !isValidIsoDate(e.target.value)) {
              onChange('');
            }
          }}
          className="date-field-input w-full min-w-0 max-w-full pl-4 pr-12 py-2.5 border border-neutral-border rounded-xl text-sm text-neutral-text bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:bg-neutral-card disabled:text-neutral-muted"
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label={`Открыть календарь: ${label.toLowerCase()}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-neutral-muted hover:text-brand hover:bg-brand/5 transition-colors disabled:opacity-50"
        >
          <Calendar size={18} />
        </button>
      </div>

      {readableValue && (
        <p className="mt-1 text-xs text-neutral-muted">{readableValue}</p>
      )}
      {hint && !readableValue && (
        <p className="mt-1 text-xs text-neutral-muted">{hint}</p>
      )}
    </div>
  );
}
