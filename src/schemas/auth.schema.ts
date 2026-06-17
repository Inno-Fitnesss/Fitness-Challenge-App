import { z } from 'zod';

export const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Введите корректный email')
    .max(70, 'Email не должен превышать 70 символов'),
  password: z
    .string()
    .min(1, 'Пароль обязателен')
    .min(8, 'Пароль должен содержать минимум 8 символов'),
  rememberMe: z.boolean(),
});

export const signUpSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'Имя обязательно')
      .min(2, 'Имя должно содержать минимум 2 символа')
      .max(50, 'Имя не должно превышать 50 символов'),
    lastName: z
      .string()
      .min(1, 'Фамилия обязательна')
      .min(2, 'Фамилия должна содержать минимум 2 символа')
      .max(100, 'Фамилия не должна превышать 100 символов'),
    email: z
      .string()
      .min(1, 'Email обязателен')
      .email('Введите корректный email')
      .max(70, 'Email не должен превышать 70 символов'),
    password: z
      .string()
      .min(1, 'Пароль обязателен')
      .min(8, 'Пароль должен содержать минимум 8 символов'),
    confirmPassword: z.string().min(1, 'Подтвердите пароль'),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'Необходимо принять условия использования',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

export type SignInFormValues = z.infer<typeof signInSchema>;
export type SignUpFormValues = z.infer<typeof signUpSchema>;
