import { getAuthUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";

export async function POST() {
  const authUser = await getAuthUser();

  if (!authUser?.id) {
    return Response.json(
      { ok: false, error: "يجب تسجيل الدخول أولًا" },
      { status: 401 },
    );
  }

  const sql = getDb();

  try {
    const rows = await sql`
      SELECT claim_first_super_admin(
        ${authUser.id}::uuid,
        ${authUser.email ?? null},
        ${authUser.name ?? null}
      ) AS user_id
    `;

    return Response.json({
      ok: true,
      userId: rows[0]?.user_id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تفعيل مدير النظام";
    const alreadyClaimed = message.includes("مسبقًا");

    return Response.json(
      { ok: false, error: message },
      { status: alreadyClaimed ? 409 : 400 },
    );
  }
}
