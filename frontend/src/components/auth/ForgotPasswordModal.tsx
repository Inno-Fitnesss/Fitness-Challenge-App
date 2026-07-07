import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Eye, EyeOff, X } from 'lucide-react';
import {
  forgotPasswordEmailSchema,
  resetPasswordSchema,
  type ForgotPasswordEmailValues,
  type ResetPasswordFormValues,
} from '../../schemas/auth.schema.ts';
import { authApi } from '../../api/authApi.ts';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.ts';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Label } from '../ui/Label.tsx';
import { FieldError } from '../ui/FieldError.tsx';
import type { ApiError } from '../../types/auth.types.ts';

const authInputClass =
  'py-3.5 px-4 text-sm rounded-2xl bg-sky-50/70 border-sky-100/80 focus:bg-white';

type Step = 'email' | 'code' | 'done';

interface ForgotPasswordModalProps {
  open: boolean;
  /** Email, уже введённый на форме входа — чтобы не набирать заново. */
  initialEmail?: string;
  onClose: () => void;
}

export function ForgotPasswordModal({ open, initialEmail, onClose }: ForgotPasswordModalProps) {
  useBodyScrollLock(open);

  if (!open) return null;
  // Внутренний компонент монтируется заново при каждом открытии,
  // поэтому шаги и поля всегда начинаются с чистого состояния.
  return <ForgotPasswordDialog initialEmail={initialEmail} onClose={onClose} />;
}

function ForgotPasswordDialog({
  initialEmail,
  onClose,
}: Omit<ForgotPasswordModalProps, 'open'>) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const emailForm = useForm<ForgotPasswordEmailValues>({
    resolver: zodResolver(forgotPasswordEmailSchema),
    defaultValues: { email: initialEmail ?? '' },
    mode: 'onBlur',
  });

  const resetForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  const onSubmitEmail = async (values: ForgotPasswordEmailValues) => {
    setApiError(null);
    try {
      await authApi.forgotPassword(values.email);
      setEmail(values.email);
      setStep('code');
    } catch (error) {
      setApiError((error as ApiError).message ?? 'Не удалось отправить код. Попробуйте снова.');
    }
  };

  const onSubmitReset = async (values: ResetPasswordFormValues) => {
    setApiError(null);
    try {
      await authApi.resetPassword({
        email,
        code: values.code,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      setStep('done');
    } catch (error) {
      setApiError((error as ApiError).message ?? 'Не удалось сменить пароль. Попробуйте снова.');
    }
  };

  const resendCode = async () => {
    setApiError(null);
    setResendNotice(false);
    setIsResending(true);
    try {
      await authApi.forgotPassword(email);
      setResendNotice(true);
    } catch (error) {
      setApiError((error as ApiError).message ?? 'Не удалось отправить код. Попробуйте снова.');
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

      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
          className="pointer-events-auto relative bg-white rounded-t-3xl sm:rounded-3xl shadow-modal w-full sm:max-w-[440px] mx-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 animate-fade-in"
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
            id="forgot-password-title"
            className="text-lg font-extrabold text-neutral-text mb-2 pr-8"
          >
            {step === 'done' ? 'Пароль изменён' : 'Восстановление пароля'}
          </h2>

          {apiError && (
            <div
              role="alert"
              className="mb-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-600"
            >
              {apiError}
            </div>
          )}

          {step === 'email' && (
            <form noValidate onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-4">
              <p className="text-sm text-neutral-secondary leading-relaxed">
                Укажите email, с которым вы регистрировались, — мы отправим на него
                6-значный код для смены пароля.
              </p>

              <div>
                <Label htmlFor="forgot-email" required>
                  Email
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="ivan@example.com"
                  hasError={!!emailForm.formState.errors.email}
                  className={authInputClass}
                  aria-describedby={
                    emailForm.formState.errors.email ? 'forgot-email-error' : undefined
                  }
                  aria-invalid={!!emailForm.formState.errors.email}
                  {...emailForm.register('email')}
                />
                <FieldError
                  id="forgot-email-error"
                  message={emailForm.formState.errors.email?.message}
                />
              </div>

              <Button type="submit" fullWidth isLoading={emailForm.formState.isSubmitting}>
                Отправить код
              </Button>
            </form>
          )}

          {step === 'code' && (
            <form noValidate onSubmit={resetForm.handleSubmit(onSubmitReset)} className="space-y-4">
              <p className="text-sm text-neutral-secondary leading-relaxed">
                Если <span className="font-semibold text-neutral-text">{email}</span>{' '}
                зарегистрирован, мы отправили на него код. Введите его и придумайте
                новый пароль. Код действует 15 минут.
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
                <Label htmlFor="reset-code" required>
                  Код из письма
                </Label>
                <Input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  placeholder="000000"
                  hasError={!!resetForm.formState.errors.code}
                  className={`${authInputClass} tracking-[0.5em] font-semibold`}
                  aria-describedby={
                    resetForm.formState.errors.code ? 'reset-code-error' : undefined
                  }
                  aria-invalid={!!resetForm.formState.errors.code}
                  {...resetForm.register('code')}
                />
                <FieldError
                  id="reset-code-error"
                  message={resetForm.formState.errors.code?.message}
                />
              </div>

              <div>
                <Label htmlFor="reset-new-password" required>
                  Новый пароль
                </Label>
                <div className="relative">
                  <Input
                    id="reset-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Минимум 8 символов"
                    hasError={!!resetForm.formState.errors.newPassword}
                    className={`${authInputClass} pr-14`}
                    aria-describedby={
                      resetForm.formState.errors.newPassword
                        ? 'reset-new-password-error'
                        : undefined
                    }
                    aria-invalid={!!resetForm.formState.errors.newPassword}
                    {...resetForm.register('newPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-xl
                      text-neutral-secondary hover:text-neutral-text hover:bg-neutral-card
                      transition-all duration-150"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <FieldError
                  id="reset-new-password-error"
                  message={resetForm.formState.errors.newPassword?.message}
                />
              </div>

              <div>
                <Label htmlFor="reset-confirm-password" required>
                  Повторите пароль
                </Label>
                <Input
                  id="reset-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Ещё раз новый пароль"
                  hasError={!!resetForm.formState.errors.confirmPassword}
                  className={authInputClass}
                  aria-describedby={
                    resetForm.formState.errors.confirmPassword
                      ? 'reset-confirm-password-error'
                      : undefined
                  }
                  aria-invalid={!!resetForm.formState.errors.confirmPassword}
                  {...resetForm.register('confirmPassword')}
                />
                <FieldError
                  id="reset-confirm-password-error"
                  message={resetForm.formState.errors.confirmPassword?.message}
                />
              </div>

              <Button type="submit" fullWidth isLoading={resetForm.formState.isSubmitting}>
                Сменить пароль
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setApiError(null);
                    setResendNotice(false);
                    setStep('email');
                  }}
                  className="font-medium text-neutral-secondary hover:text-neutral-text transition-colors duration-150"
                >
                  Изменить email
                </button>
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
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={22} className="shrink-0 mt-0.5 text-emerald-500" />
                <p className="text-sm text-neutral-secondary leading-relaxed">
                  Пароль для <span className="font-semibold text-neutral-text">{email}</span>{' '}
                  успешно изменён. Теперь войдите с новым паролем.
                </p>
              </div>
              <Button type="button" fullWidth onClick={onClose}>
                Войти
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
