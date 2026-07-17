import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import {
  verifyEmailSchema,
  type VerifyEmailFormValues,
} from '../../schemas/auth.schema.ts';
import { authApi } from '../../api/authApi.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.ts';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Label } from '../ui/Label.tsx';
import { FieldError } from '../ui/FieldError.tsx';
import type { ApiError } from '../../types/auth.types.ts';

const authInputClass =
  'py-3.5 px-4 text-sm rounded-2xl bg-sky-50/70 border-sky-100/80 focus:bg-white';

interface VerifyEmailModalProps {
  open: boolean;
  /** Email, на который отправлен код подтверждения. */
  email: string;
  /**
   * Сразу запросить новый код при открытии — для случая, когда модалка
   * открылась из формы входа (старый код мог истечь или потеряться).
   */
  autoResend?: boolean;
  redirectTo?: string;
  onClose: () => void;
}

export function VerifyEmailModal({
  open,
  email,
  autoResend,
  redirectTo,
  onClose,
}: VerifyEmailModalProps) {
  useBodyScrollLock(open);

  if (!open) return null;
  // Внутренний компонент монтируется заново при каждом открытии,
  // поэтому поля и статусы всегда начинаются с чистого состояния.
  return (
    <VerifyEmailDialog
      email={email}
      autoResend={autoResend}
      redirectTo={redirectTo}
      onClose={onClose}
    />
  );
}

function VerifyEmailDialog({
  email,
  autoResend,
  redirectTo = '/dashboard',
  onClose,
}: Omit<VerifyEmailModalProps, 'open'>) {
  const { verifyEmail } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const autoResendDone = useRef(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (!autoResend || autoResendDone.current) return;
    autoResendDone.current = true;
    void authApi.resendVerification(email).catch(() => {
      // Тихо игнорируем: пользователь всегда может нажать «Отправить ещё раз».
    });
  }, [autoResend, email]);

  const form = useForm<VerifyEmailFormValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: '' },
    mode: 'onBlur',
  });

  const onSubmit = async (values: VerifyEmailFormValues) => {
    setApiError(null);
    try {
      // Успешное подтверждение сразу логинит и уводит на redirectTo.
      await verifyEmail(email, values.code, redirectTo);
    } catch (error) {
      setApiError(
        (error as ApiError).message ?? 'Не удалось подтвердить email. Попробуйте снова.',
      );
    }
  };

  const resendCode = async () => {
    setApiError(null);
    setResendNotice(false);
    setIsResending(true);
    try {
      await authApi.resendVerification(email);
      setResendNotice(true);
    } catch (error) {
      setApiError(
        (error as ApiError).message ?? 'Не удалось отправить код. Попробуйте снова.',
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 top-0 h-[100dvh] flex items-end justify-center sm:items-center sm:p-6 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-email-title"
          className="pointer-events-auto relative bg-white rounded-t-3xl sm:rounded-3xl shadow-modal w-full sm:max-w-[440px] mx-auto max-h-[92dvh] overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 animate-fade-in"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно"
            className="absolute right-4 top-4 p-1.5 rounded-xl text-neutral-secondary
              hover:text-neutral-text hover:bg-neutral-card transition-all duration-150"
          >
            <X size={20} />
          </button>

          <h2
            id="verify-email-title"
            className="text-lg font-extrabold text-neutral-text mb-2 pr-8"
          >
            Подтвердите email
          </h2>

          {apiError && (
            <div
              role="alert"
              className="mb-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-600"
            >
              {apiError}
            </div>
          )}

          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-sm text-neutral-secondary leading-relaxed">
              Мы отправили 6-значный код на{' '}
              <span className="font-semibold text-neutral-text">{email}</span>.
              Введите его, чтобы подтвердить адрес и войти. Код действует 15 минут.
            </p>

            {resendNotice && (
              <div
                role="status"
                className="px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"
              >
                Код отправлен повторно.
              </div>
            )}

            <div>
              <Label htmlFor="verify-code" required>
                Код из письма
              </Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                placeholder="000000"
                hasError={!!form.formState.errors.code}
                className={`${authInputClass} tracking-[0.5em] font-semibold`}
                aria-describedby={
                  form.formState.errors.code ? 'verify-code-error' : undefined
                }
                aria-invalid={!!form.formState.errors.code}
                {...form.register('code')}
              />
              <FieldError
                id="verify-code-error"
                message={form.formState.errors.code?.message}
              />
            </div>

            <Button type="submit" fullWidth isLoading={form.formState.isSubmitting}>
              Подтвердить и войти
            </Button>

            <div className="flex justify-end text-sm">
              <button
                type="button"
                onClick={resendCode}
                disabled={isResending}
                className="font-medium text-brand hover:text-brand-hover transition-colors duration-150 disabled:opacity-50"
              >
                {isResending ? 'Отправляем…' : 'Отправить код ещё раз'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
