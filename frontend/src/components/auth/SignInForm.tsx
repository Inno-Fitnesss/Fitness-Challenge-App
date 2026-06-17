import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { signInSchema, type SignInFormValues } from '../../schemas/auth.schema';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Checkbox } from '../ui/Checkbox';
import { FieldError } from '../ui/FieldError';
import type { ApiError } from '../../types/auth.types';

export function SignInForm() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    mode: 'onBlur',
  });

  const onSubmit = async (values: SignInFormValues) => {
    setApiError(null);
    try {
      await login(
        { email: values.email, password: values.password },
        values.rememberMe,
      );
    } catch (error) {
      const apiErr = error as ApiError;
      setApiError(apiErr.message ?? 'Не удалось войти. Попробуйте снова.');
    }
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 animate-fade-in"
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
            className="pr-14"
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Checkbox
          id="remember-me"
          label="Запомнить меня"
          {...register('rememberMe')}
        />
        <a
          href="#"
          className="text-sm font-medium text-brand hover:text-brand-hover transition-colors duration-150"
          onClick={(e) => e.preventDefault()}
        >
          Забыли пароль?
        </a>
      </div>

      <Button type="submit" fullWidth isLoading={isSubmitting}>
        Войти
      </Button>
    </form>
  );
}
