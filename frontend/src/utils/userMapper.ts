import type { User, UserOutput } from '../types/auth.types.ts';

export function mapUserOutputToUser(output: UserOutput): User {
  return {
    id: output.id,
    username: output.username,
    email: output.email,
    // Старые ответы сервера поля не содержат — считаем подтверждённым.
    emailVerified: output.email_verified ?? true,
    firstName: output.first_name ?? undefined,
    lastName: output.last_name ?? undefined,
  };
}

export function mapRegisterDataToApi(data: {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}) {
  return {
    username: data.username,
    email: data.email,
    password: data.password,
    terms_accepted: data.termsAccepted,
    privacy_accepted: data.privacyAccepted,
    ...(data.firstName ? { first_name: data.firstName } : {}),
    ...(data.lastName ? { last_name: data.lastName } : {}),
  };
}
