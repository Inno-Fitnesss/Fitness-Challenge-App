import { z } from 'zod';

const optionalName = (label: string, max: number) =>
  z
    .string()
    .max(max, `${label} не должно превышать ${max} символов`)
    .refine((val) => val === '' || val.length >= 2, {
      message: `${label} должно содержать минимум 2 символа`,
    });

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
});

export const signUpSchema = z
  .object({
    username: z
      .string()
      .min(1, 'Имя пользователя обязательно')
      .min(3, 'Минимум 3 символа')
      .max(50, 'Максимум 50 символов')
      .regex(/^[a-zA-Z0-9_]+$/, 'Только латиница, цифры и подчёркивание'),
    firstName: optionalName('Имя', 50),
    lastName: optionalName('Фамилия', 100),
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
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

export type SignInFormValues = z.infer<typeof signInSchema>;
export type SignUpFormValues = z.infer<typeof signUpSchema>;
