import { AlertCircle } from 'lucide-react';

interface FieldErrorProps {
  message?: string;
  id?: string;
}

export function FieldError({ message, id }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className="flex items-center gap-1.5 text-sm text-red-500 mt-2 animate-fade-in"
    >
      <AlertCircle size={14} className="flex-shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
