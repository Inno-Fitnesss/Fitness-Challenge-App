import type { User, UserOutput } from '../types/auth.types';

export function mapUserOutputToUser(output: UserOutput): User {
  return {
    id: output.id,
    username: output.username,
    email: output.email,
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
}) {
  return {
    username: data.username,
    email: data.email,
    password: data.password,
    ...(data.firstName ? { first_name: data.firstName } : {}),
    ...(data.lastName ? { last_name: data.lastName } : {}),
  };
}
