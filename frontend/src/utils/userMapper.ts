import type { User, UserOutput } from '../types/auth.types';

export function mapUserOutputToUser(output: UserOutput): User {
  return {
    id: output.id,
    email: output.email,
    firstName: output.first_name,
    lastName: output.last_name,
  };
}

export function mapRegisterDataToApi(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  return {
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    password: data.password,
  };
}
