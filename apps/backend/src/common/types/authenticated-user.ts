export type UserRole = 'STUDENT' | 'LEADER' | 'ADMIN';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
