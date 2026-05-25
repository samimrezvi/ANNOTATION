export type UserRole = 'annotator' | 'reviewer' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  annotator: 'Annotator',
  reviewer:  'Reviewer',
  admin:     'Admin',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  annotator: '#38bdf8',
  reviewer:  '#34d399',
  admin:     '#a855f7',
};
