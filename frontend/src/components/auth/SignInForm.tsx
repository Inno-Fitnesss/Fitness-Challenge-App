import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { signInSchema, type SignInFormValues } from '../../schemas/auth.schema.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Label } from '../ui/Label.tsx';
import { FieldError } from '../ui/FieldError.tsx';
import { ForgotPasswordModal } from './ForgotPasswordModal.tsx';
import { VerifyEmailModal } from './VerifyEmailModal.tsx';
import type { ApiError } from '../../types/auth.types.ts';

const authInputClass =
  'py-3.5 px-4 text-sm rounded-2xl bg-sky-50/70 border-sky-100/80 focus:bg-white';

interface SignInFormProps {
  redirectTo?: string;
}

export function SignInForm({ redirectTo = '/dashboard' }: SignInFormProps) {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  // Email аккаунта, которому сервер отказал во входе из-за неподтверждённой
  // почты (401/403 "Email not verified") — открывает модалку с кодом.
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = async (values: SignInFormValues) => {
    setApiError(null);
    try {
      await login({ email: values.email, password: values.password }, redirectTo);
    } catch (error) {
      const apiErr = error as ApiError;
      if (apiErr.status === 403) {
        // Пароль верный, но email не подтверждён — предлагаем ввести код.
        setVerifyEmail(values.email);
        return;
      }
      setApiError(apiErr.message ?? 'Не удалось войти. Попробуйте снова.');
    }
  };

  return (
    <>
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 animate-fade-in"
      aria-labelledby="tab-signin"
    >
      {apiError && (
        <div
          role="alert"
          className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-600"
        >
          {apiError}
        </div>
      )}

      <div>
        <Label htmlFor="signin-email" required>
          Email
        </Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          placeholder="ivan@example.com"
          hasError={!!errors.email}
          className={authInputClass}
          aria-describedby={errors.email ? 'signin-email-error' : undefined}
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        <FieldError id="signin-email-error" message={errors.email?.message} />
      </div>

      <div>
        <Label htmlFor="signin-password" required>
          Пароль
        </Label>
        <div className="relative">
          <Input
            id="signin-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Введите пароль"
            hasError={!!errors.password}
            aria-describedby={errors.password ? 'signin-password-error' : undefined}
            aria-invalid={!!errors.password}
            className={`${authInputClass} pr-14`}
            {...register('password')}
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
        <FieldError id="signin-password-error" message={errors.password?.message} />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="text-sm font-medium text-brand hover:text-brand-hover transition-colors duration-150"
          onClick={() => setForgotOpen(true)}
        >
          Забыли пароль?
        </button>
      </div>

      <Button type="submit" fullWidth isLoading={isSubmitting}>
        Войти
      </Button>
    </form>

    <ForgotPasswordModal
      open={forgotOpen}
      initialEmail={getValues('email')}
      onClose={() => setForgotOpen(false)}
    />

    <VerifyEmailModal
      open={verifyEmail !== null}
      email={verifyEmail ?? ''}
      autoResend
      redirectTo={redirectTo}
      onClose={() => setVerifyEmail(null)}
    />
    </>
  );
}
