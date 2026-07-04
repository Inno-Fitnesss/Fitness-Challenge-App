import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ hasError = false, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`
          w-full min-w-0 max-w-full px-5 py-4 border rounded-2xl text-base text-neutral-text
          placeholder:text-neutral-secondary bg-white
          focus:outline-none focus:ring-2 transition-all duration-200
          ${hasError
            ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
            : 'border-neutral-border focus:border-brand focus:ring-brand/10 hover:border-brand/40'
          }
          ${className}
        `}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
