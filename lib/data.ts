import { getDb } from "./db";

export type PointRule = {
  id: string;
  name_ar: string;
  default_points: number;
  min_points: number;
  max_points: number;
  is_mega: boolean;
  category_name: string | null;
};

export async function getSchool() {
  const sql = getDb();
  const rows = await sql`SELECT id, name_ar, code, point_value_sar, logo_url, guidance_logo_url, developer_credit_ar, rights_holder_ar FROM schools WHERE code='MISHKAT' LIMIT 1`;
  return rows[0] ?? null;
}

export async function getDashboardData() {
  const sql = getDb();
  const school = await getSchool();
  if (!school) throw new Error("School is not initialized");
  const schoolId = school.id as string;

  const [today, month, students, reinforced, redeemed, topStudents, recentChecks] = await Promise.all([
    sql`SELECT COALESCE(SUM(points),0)::int AS value FROM excellence_checks WHERE school_id=${schoolId} AND status IN ('ISSUED','REDEEMED') AND issued_at::date=current_date`,
    sql`SELECT COUNT(*)::int AS value FROM excellence_checks WHERE school_id=${schoolId} AND issued_at >= date_trunc('month', now())`,
    sql`SELECT COUNT(*)::int AS value FROM students WHERE school_id=${schoolId} AND is_active=true`,
    sql`SELECT COUNT(DISTINCT student_id)::int AS value FROM wallet_transactions WHERE school_id=${schoolId} AND transaction_type IN ('EARN','BONUS') AND created_at >= date_trunc('month', now())`,
    sql`SELECT COALESCE(SUM(-points_delta),0)::int AS points FROM wallet_transactions WHERE school_id=${schoolId} AND transaction_type='REDEEM'`,
    sql`SELECT s.full_name_ar AS name, c.name_ar AS class_name, COALESCE(b.points_balance,0)::int AS points
        FROM students s
        JOIN classes c ON c.id=s.class_id
        LEFT JOIN student_wallet_balances b ON b.student_id=s.id
        WHERE s.school_id=${schoolId} AND s.is_active=true
        ORDER BY COALESCE(b.points_balance,0) DESC, s.full_name_ar ASC LIMIT 5`,
    sql`SELECT ec.id, ec.serial_no, ec.points, ec.reason_ar, ec.issued_at, s.full_name_ar AS student_name, u.full_name_ar AS issuer_name
        FROM excellence_checks ec
        JOIN students s ON s.id=ec.student_id
        JOIN app_users u ON u.id=ec.issued_by
        WHERE ec.school_id=${schoolId}
        ORDER BY ec.issued_at DESC LIMIT 6`,
  ]);

  return {
    school,
    stats: {
      todayPoints: Number(today[0]?.value ?? 0),
      monthChecks: Number(month[0]?.value ?? 0),
      activeStudents: Number(students[0]?.value ?? 0),
      reinforcedStudents: Number(reinforced[0]?.value ?? 0),
      redeemedPoints: Number(redeemed[0]?.points ?? 0),
    },
    topStudents,
    recentChecks,
  };
}

export async function getPointRules(): Promise<PointRule[]> {
  const sql = getDb();
  const rows = await sql`SELECT pr.id, pr.name_ar, pr.default_points, pr.min_points, pr.max_points, pr.is_mega, rc.name_ar AS category_name
      FROM point_rules pr LEFT JOIN reward_categories rc ON rc.id=pr.category_id
      WHERE pr.school_id=(SELECT id FROM schools WHERE code='MISHKAT') AND pr.is_active=true
      ORDER BY pr.sort_order, pr.default_points`;
  return rows as unknown as PointRule[];
}

export async function getStudentsForIssuing() {
  const sql = getDb();
  return sql`SELECT s.id, s.full_name_ar, s.student_no, c.name_ar AS class_name, g.name_ar AS grade_name
    FROM students s JOIN classes c ON c.id=s.class_id JOIN grades g ON g.id=c.grade_id
    WHERE s.school_id=(SELECT id FROM schools WHERE code='MISHKAT') AND s.is_active=true
    ORDER BY g.sort_order, c.name_ar, s.full_name_ar`;
}

export async function getStudentsWallets() {
  const sql = getDb();
  return sql`SELECT s.id, s.full_name_ar AS name, s.student_no, c.name_ar AS class_name,
    COALESCE(b.points_balance,0)::int AS points,
    (COALESCE(b.points_balance,0) * sch.point_value_sar)::numeric(10,2) AS value_sar,
    COALESCE((SELECT l.name_ar FROM levels l WHERE l.school_id=s.school_id AND l.min_points <= COALESCE(b.points_balance,0) ORDER BY l.min_points DESC LIMIT 1),'مبتدئ') AS level
    FROM students s
    JOIN classes c ON c.id=s.class_id
    JOIN schools sch ON sch.id=s.school_id
    LEFT JOIN student_wallet_balances b ON b.student_id=s.id
    WHERE s.school_id=(SELECT id FROM schools WHERE code='MISHKAT') AND s.is_active=true
    ORDER BY points DESC, s.full_name_ar`;
}

export async function getRewards() {
  const sql = getDb();
  return sql`SELECT id,name_ar,description_ar,cost_points,cash_value_sar,stock,is_active
    FROM rewards WHERE school_id=(SELECT id FROM schools WHERE code='MISHKAT')
    ORDER BY cost_points,name_ar`;
}
