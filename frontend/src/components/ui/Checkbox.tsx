import { forwardRef, type InputHTMLAttributes } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
  hasError?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, hasError = false, className = '', id, ...props }, ref) => {
    return (
      <div className={`flex items-start gap-3 ${className}`}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className={`
            mt-1 w-5 h-5 min-w-5 min-h-5 shrink-0 rounded-md border-2 cursor-pointer
            text-brand focus:ring-2 focus:ring-brand/20 focus:ring-offset-0
            transition-colors duration-150
            ${hasError ? 'border-red-400' : 'border-neutral-border'}
          `}
          {...props}
        />
        <label
          htmlFor={id}
          className="min-w-0 flex-1 text-sm leading-5 text-neutral-secondary cursor-pointer select-none"
        >
          {label}
        </label>
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
