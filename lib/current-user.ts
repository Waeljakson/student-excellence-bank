import { auth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";

export async function getAuthUser() {
  const result: any = await auth.getSession();
  const payload = result?.data ?? result;
  const user = payload?.user ?? result?.user ?? null;
  return user as null | { id: string; email?: string; name?: string; image?: string };
}

export async function getCurrentAppUser() {
  const authUser = await getAuthUser();
  if (!authUser) return null;
  const sql = getDb();
  const rows = await sql`SELECT u.id,u.school_id,u.full_name_ar,u.email,u.is_active,
      COALESCE(array_agg(DISTINCT ur.role::text) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::text[]) AS roles
    FROM app_users u LEFT JOIN user_roles ur ON ur.user_id=u.id
    WHERE u.auth_user_id=${authUser.id}::uuid
    GROUP BY u.id LIMIT 1`;
  if (!rows[0]) return { authUser, appUser: null };
  return { authUser, appUser: rows[0] };
}

export function hasAnyRole(roles: string[] | undefined, allowed: string[]) {
  return !!roles?.some((r) => allowed.includes(r));
}
