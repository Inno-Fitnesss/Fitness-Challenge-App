import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { signUpSchema, type SignUpFormValues } from '../../schemas/auth.schema.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Label } from '../ui/Label.tsx';
import { FieldError } from '../ui/FieldError.tsx';
import type { ApiError } from '../../types/auth.types.ts';

interface SignUpFormProps {
  redirectTo?: string;
}

const fieldClass = 'auth-field';
const inputClass = 'py-3 px-4 text-sm rounded-2xl bg-sky-50/70 border-sky-100/80 focus:bg-white';
const labelClass = 'mb-1.5 text-sm';

export function SignUpForm({ redirectTo = '/dashboard' }: SignUpFormProps) {
  const { register: registerUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = async (values: SignUpFormValues) => {
    setApiError(null);
    try {
      await registerUser(
        {
          username: values.username,
          email: values.email,
          password: values.password,
        },
        redirectTo,
      );
    } catch (error) {
      const apiErr = error as ApiError;
      setApiError(apiErr.message ?? 'Не удалось зарегистрироваться. Попробуйте снова.');
    }
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-3 animate-fade-in"
      aria-labelledby="tab-signup"
    >
      {apiError && (
        <div
          role="alert"
          className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600"
        >
          {apiError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className={fieldClass}>
          <Label htmlFor="signup-username" required className={labelClass}>
            Имя пользователя
          </Label>
          <Input
            id="signup-username"
            type="text"
            autoComplete="username"
            placeholder="runner"
            hasError={!!errors.username}
            className={inputClass}
            {...register('username')}
          />
          <FieldError id="signup-username-error" message={errors.username?.message} />
        </div>

        <div className={fieldClass}>
          <Label htmlFor="signup-email" required className={labelClass}>
            Email
          </Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="ivan@example.com"
            hasError={!!errors.email}
            className={inputClass}
            {...register('email')}
          />
          <FieldError id="signup-email-error" message={errors.email?.message} />
        </div>

        <div className={fieldClass}>
          <Label htmlFor="signup-password" required className={labelClass}>
            Пароль
          </Label>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="от 8 символов"
              hasError={!!errors.password}
              className={`${inputClass} pr-11`}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-muted hover:text-neutral-text"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <FieldError id="signup-password-error" message={errors.password?.message} />
        </div>

        <div className={fieldClass}>
          <Label htmlFor="signup-confirm-password" required className={labelClass}>
            Повтор пароля
          </Label>
          <div className="relative">
            <Input
              id="signup-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="ещё раз"
              hasError={!!errors.confirmPassword}
              className={`${inputClass} pr-11`}
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-muted hover:text-neutral-text"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <FieldError
            id="signup-confirm-password-error"
            message={errors.confirmPassword?.message}
          />
        </div>
      </div>

      <Button type="submit" fullWidth size="md" isLoading={isSubmitting} className="mt-1">
        Создать аккаунт
      </Button>
    </form>
  );
}

