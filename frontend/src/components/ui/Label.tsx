interface LabelProps {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}

export function Label({ htmlFor, children, required, className = '' }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className={`block text-sm font-semibold text-neutral-text mb-2 ${className}`}>
      {children}
      {required && <span className="text-brand ml-0.5" aria-hidden="true">*</span>}
    </label>
  );
}
