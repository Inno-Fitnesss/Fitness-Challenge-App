import { z } from 'zod';
import { LEGAL_CONSENT_ERROR } from '../constants/legalDocuments.ts';

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
    termsAccepted: z.boolean().refine((accepted) => accepted, LEGAL_CONSENT_ERROR),
    privacyAccepted: z.boolean().refine((accepted) => accepted, LEGAL_CONSENT_ERROR),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

export const forgotPasswordEmailSchema = z.object({
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Введите корректный email')
    .max(70, 'Email не должен превышать 70 символов'),
});

export const resetPasswordSchema = z
  .object({
    code: z
      .string()
      .min(1, 'Введите код из письма')
      .regex(/^\d{6}$/, 'Код — 6 цифр'),
    newPassword: z
      .string()
      .min(1, 'Пароль обязателен')
      .min(8, 'Пароль должен содержать минимум 8 символов'),
    confirmPassword: z.string().min(1, 'Подтвердите пароль'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .min(1, 'Введите код из письма')
    .regex(/^\d{6}$/, 'Код — 6 цифр'),
});

export type SignInFormValues = z.infer<typeof signInSchema>;
export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;
export type SignUpFormValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordEmailValues = z.infer<typeof forgotPasswordEmailSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
