import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { signUpSchema, type SignUpFormValues } from '../../schemas/auth.schema';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Checkbox } from '../ui/Checkbox';
import { FieldError } from '../ui/FieldError';
import type { ApiError } from '../../types/auth.types';

interface SignUpFormProps {
  onSuccess: () => void;
}

export function SignUpForm({ onSuccess }: SignUpFormProps) {
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
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
    mode: 'onBlur',
  });

  const onSubmit = async (values: SignUpFormValues) => {
    setApiError(null);
    try {
      await registerUser({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
      });
      onSuccess();
    } catch (error) {
      const apiErr = error as ApiError;
      setApiError(apiErr.message ?? 'Не удалось зарегистрироваться. Попробуйте снова.');
    }
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5 animate-fade-in"
      aria-labelledby="tab-signup"
    >
      {apiError && (
        <div
          role="alert"
          className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-600"
        >
          {apiError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <Label htmlFor="signup-firstname" required>
            Имя
          </Label>
          <Input
            id="signup-firstname"
            type="text"
            autoComplete="given-name"
            placeholder="Иван"
            hasError={!!errors.firstName}
            aria-describedby={errors.firstName ? 'signup-firstname-error' : undefined}
            aria-invalid={!!errors.firstName}
            {...register('firstName')}
          />
          <FieldError id="signup-firstname-error" message={errors.firstName?.message} />
        </div>

        <div>
          <Label htmlFor="signup-lastname" required>
            Фамилия
          </Label>
          <Input
            id="signup-lastname"
            type="text"
            autoComplete="family-name"
            placeholder="Иванов"
            hasError={!!errors.lastName}
            aria-describedby={errors.lastName ? 'signup-lastname-error' : undefined}
            aria-invalid={!!errors.lastName}
            {...register('lastName')}
          />
          <FieldError id="signup-lastname-error" message={errors.lastName?.message} />
        </div>
      </div>

      <div>
        <Label htmlFor="signup-email" required>
          Email
        </Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="ivan@example.com"
          hasError={!!errors.email}
          aria-describedby={errors.email ? 'signup-email-error' : undefined}
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        <FieldError id="signup-email-error" message={errors.email?.message} />
      </div>

      <div>
        <Label htmlFor="signup-password" required>
          Пароль
        </Label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Минимум 8 символов"
            hasError={!!errors.password}
            aria-describedby={errors.password ? 'signup-password-error' : undefined}
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
        <FieldError id="signup-password-error" message={errors.password?.message} />
      </div>

      <div>
        <Label htmlFor="signup-confirm-password" required>
          Подтверждение пароля
        </Label>
        <div className="relative">
          <Input
            id="signup-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Повторите пароль"
            hasError={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'signup-confirm-password-error' : undefined}
            aria-invalid={!!errors.confirmPassword}
            className="pr-14"
            {...register('confirmPassword')}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-xl
              text-neutral-secondary hover:text-neutral-text hover:bg-neutral-card
              transition-all duration-150"
          >
            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        <FieldError
          id="signup-confirm-password-error"
          message={errors.confirmPassword?.message}
        />
      </div>

      <div>
        <Checkbox
          id="accept-terms"
          hasError={!!errors.acceptTerms}
          label={
            <>
              Я согласен с{' '}
              <a
                href="#"
                className="text-brand hover:text-brand-hover font-medium transition-colors"
                onClick={(e) => e.preventDefault()}
              >
                условиями использования
              </a>
            </>
          }
          {...register('acceptTerms')}
        />
        <FieldError message={errors.acceptTerms?.message} />
      </div>

      <Button type="submit" fullWidth isLoading={isSubmitting}>
        Создать аккаунт
      </Button>
    </form>
  );
}
