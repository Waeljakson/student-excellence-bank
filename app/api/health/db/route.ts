import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const sql = getDb();
    const result = await sql`select now() as server_time, current_database() as database_name`;
    return Response.json({ ok: true, database: result[0] });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unknown database error" }, { status: 503 });
  }
}
