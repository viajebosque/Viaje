import { apiAuthGet, apiAuthPatch } from './api';
import type { Lang } from '../i18n';
import type { Role } from './profile';

// Datos que el panel de admin muestra de cada usuario.
export type AdminUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  is_paid: boolean;
  lang: Lang;
  created_at: string;
};

// Ordenamientos que acepta el backend (lista cerrada).
export const USER_SORTS = [
  'name_asc',
  'name_desc',
  'created_desc',
  'created_asc',
] as const;
export type UserSort = (typeof USER_SORTS)[number];
export const DEFAULT_SORT: UserSort = 'created_desc';

// Lista de usuarios, filtrada por nombre/correo y ordenada.
// Todo pasa por el backend: con la anon key el usuario solo ve su propia fila.
export async function listUsers(
  search: string,
  sort: UserSort
): Promise<AdminUser[]> {
  const params = new URLSearchParams({ sort });
  if (search.trim()) params.set('search', search.trim());
  const { users } = await apiAuthGet<{ users: AdminUser[] }>(
    `/api/admin/users?${params.toString()}`
  );
  return users;
}

// Marca a un usuario como pagado o no pagado.
export async function setUserPaid(
  userId: string,
  isPaid: boolean
): Promise<AdminUser> {
  const { user } = await apiAuthPatch<{ user: AdminUser }>(
    `/api/admin/users/${userId}/paid`,
    { is_paid: isPaid }
  );
  return user;
}
