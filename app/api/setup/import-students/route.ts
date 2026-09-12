import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentAppUser, hasAnyRole } from "@/lib/current-user";

export const runtime = "nodejs";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

type ImportRow = {
  department?: string;
  grade?: string;
  class_name?: string;
  student_no?: string;
  student_name?: string;
};

function clean(value: unknown) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

function gradeOrder(name: string) {
  const n = name.replace(/[أإآ]/g, "ا");
  if (n.includes("اول") || n.includes("1")) return 1;
  if (n.includes("ثاني") || n.includes("2")) return 2;
  if (n.includes("ثالث") || n.includes("3")) return 3;
  return 99;
}

export async function POST(request: Request) {
  try {
    const current: any = await getCurrentAppUser();
    if (!current?.appUser) {
      return NextResponse.json({ ok: false, error: "يلزم تسجيل الدخول وتفعيل حساب إداري أولًا." }, { status: 401 });
    }

    const roles = current.appUser.roles as string[] | undefined;
    if (!hasAnyRole(roles, ADMIN_ROLES)) {
      return NextResponse.json({ ok: false, error: "ليس لديك صلاحية استيراد بيانات الطلاب." }, { status: 403 });
    }

    const body = await request.json();
    const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "لا توجد بيانات للاستيراد." }, { status: 400 });
    }
    if (rows.length > 1500) {
      return NextResponse.json({ ok: false, error: "الحد الأقصى 1500 طالب في العملية الواحدة." }, { status: 400 });
    }

    const sql = getDb();
    const schoolId = String(current.appUser.school_id);

    const years = await sql`SELECT id FROM academic_years WHERE school_id=${schoolId}::uuid AND is_current=true ORDER BY starts_on DESC NULLS LAST LIMIT 1`;
    if (!years[0]) {
      return NextResponse.json({ ok: false, error: "لا توجد سنة دراسية حالية مفعلة." }, { status: 400 });
    }
    const academicYearId = String(years[0].id);

    const departments = await sql`SELECT id, name_ar FROM departments WHERE school_id=${schoolId}::uuid ORDER BY name_ar`;
    if (!departments.length) {
      return NextResponse.json({ ok: false, error: "لا توجد مراحل/أقسام مضافة للمدرسة." }, { status: 400 });
    }

    let imported = 0;
    let failed = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const departmentName = clean(row.department);
      const gradeName = clean(row.grade);
      const className = clean(row.class_name);
      const studentNo = clean(row.student_no);
      const studentName = clean(row.student_name);

      if (!departmentName || !gradeName || !className || !studentNo || !studentName) {
        failed++;
        errors.push({ row: i + 2, error: "بيانات ناقصة: المرحلة والصف والفصل ورقم الطالب والاسم مطلوبة." });
        continue;
      }

      const depNeedle = departmentName.replace(/[أإآ]/g, "ا");
      const department = departments.find((d: any) => {
        const name = String(d.name_ar).replace(/[أإآ]/g, "ا");
        if (name === depNeedle) return true;
        if (depNeedle.includes("متوسط") && name.includes("متوسط")) return true;
        if ((depNeedle.includes("ثانوي") || depNeedle.includes("ثانويه")) && name.includes("ثانوي")) return true;
        return false;
      });

      if (!department) {
        failed++;
        errors.push({ row: i + 2, error: `المرحلة غير معروفة: ${departmentName}` });
        continue;
      }

      try {
        const gradeRows = await sql`
          INSERT INTO grades (department_id, name_ar, sort_order)
          VALUES (${String(department.id)}::uuid, ${gradeName}, ${gradeOrder(gradeName)})
          ON CONFLICT (department_id, name_ar)
          DO UPDATE SET sort_order=EXCLUDED.sort_order
          RETURNING id`;
        const gradeId = String(gradeRows[0].id);

        const classRows = await sql`
          INSERT INTO classes (grade_id, academic_year_id, name_ar, is_active)
          VALUES (${gradeId}::uuid, ${academicYearId}::uuid, ${className}, true)
          ON CONFLICT (grade_id, academic_year_id, name_ar)
          DO UPDATE SET is_active=true
          RETURNING id`;
        const classId = String(classRows[0].id);

        await sql`
          INSERT INTO students (school_id, student_no, full_name_ar, class_id, is_active)
          VALUES (${schoolId}::uuid, ${studentNo}, ${studentName}, ${classId}::uuid, true)
          ON CONFLICT (school_id, student_no)
          DO UPDATE SET full_name_ar=EXCLUDED.full_name_ar, class_id=EXCLUDED.class_id, is_active=true, updated_at=now()`;

        imported++;
      } catch (e: any) {
        failed++;
        errors.push({ row: i + 2, error: e?.message || "تعذر حفظ السطر." });
      }
    }

    return NextResponse.json({
      ok: imported > 0,
      imported,
      failed,
      errors: errors.slice(0, 20),
      message: `تمت معالجة ${rows.length} سجل: نجح ${imported} وتعذر ${failed}.`,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "حدث خطأ أثناء الاستيراد." }, { status: 500 });
  }
}
