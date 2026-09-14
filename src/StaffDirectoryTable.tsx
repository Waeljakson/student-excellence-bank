import { useMemo, useState } from "react";
import "./staff-directory-table.css";

type StaffMember = {
  id: string;
  full_name_ar: string;
  job_title_ar: string;
  specialty_ar?: string | null;
  teaching_subject_ar?: string | null;
  mobile?: string | null;
  assigned_classes?: string[];
};

function normalizeSubject(value?: string | null) {
  const v = String(value || "").trim();
  if (!v) return "—";
  if (v === "E") return "لغة إنجليزية";
  if (v === "بدنية") return "التربية البدنية";
  if (v === "فنية") return "التربية الفنية";
  if (v === "ملاحظة إضافية") return "—";
  return v;
}

function subjectOrTitle(s: StaffMember) {
  if (s.job_title_ar !== "معلم") {
    if (s.job_title_ar === "الموجه الطلابي") return "موجه طلابي";
    return s.job_title_ar || "—";
  }
  const specialty = normalizeSubject(s.specialty_ar);
  if (specialty !== "—") return specialty;
  return normalizeSubject(s.teaching_subject_ar);
}

function administration(s: StaffMember) {
  const classes = (s.assigned_classes || []).join(" ");
  const hasMiddle = classes.includes("المتوسط");
  const hasSecondary = classes.includes("الثانوي");
  if (hasMiddle && hasSecondary) return "متوسطة وثانوية مشكاة الشعلة";
  if (hasSecondary) return "ثانوية مشكاة الشعلة";
  if (hasMiddle) return "متوسطة مشكاة الشعلة";
  if (s.job_title_ar !== "معلم") return "الإدارة المدرسية";
  return "غير محدد";
}

export default function StaffDirectoryTable({ staff }: { staff: StaffMember[] }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...staff].sort((a, b) => a.full_name_ar.localeCompare(b.full_name_ar, "ar"));
    if (!q) return all;
    return all.filter((s) => {
      const haystack = [s.full_name_ar, s.mobile, subjectOrTitle(s), administration(s)].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [staff, query]);

  return (
    <section className="panel staff-directory-table-panel">
      <div className="panel-title staff-directory-table-head">
        <div>
          <h3>جدول بيانات الهيئة الإدارية والتعليمية</h3>
          <p>الاسم ورقم الجوال والمادة أو المسمى والإدارة — مرتبط مباشرة ببيانات النظام.</p>
        </div>
        <span className="counter">{rows.length}</span>
      </div>
      <div className="staff-directory-tools">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث بالاسم أو الجوال أو المادة أو الإدارة"
          aria-label="بحث في بيانات الهيئة"
        />
      </div>
      <div className="table-wrap staff-directory-table-wrap">
        <table className="staff-directory-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>رقم الجوال</th>
              <th>المادة / المسمى</th>
              <th>الإدارة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td><b>{s.full_name_ar}</b></td>
                <td className="staff-mobile-cell" dir="ltr">{s.mobile || "—"}</td>
                <td>{subjectOrTitle(s)}</td>
                <td>{administration(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="staff-directory-empty">لا توجد نتائج مطابقة للبحث.</div>}
    </section>
  );
}
