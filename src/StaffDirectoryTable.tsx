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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

  function printTable() {
    const printWindow = window.open("", "staff-directory-print", "width=1100,height=800");
    if (!printWindow) {
      window.alert("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.");
      return;
    }

    const tableRows = rows.map((s) => `
      <tr>
        <td>${escapeHtml(s.full_name_ar)}</td>
        <td class="mobile">${escapeHtml(s.mobile || "—")}</td>
        <td>${escapeHtml(subjectOrTitle(s))}</td>
        <td>${escapeHtml(administration(s))}</td>
      </tr>`).join("");

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>جدول بيانات الهيئة الإدارية والتعليمية</title>
<style>
  @page{size:A4 landscape;margin:10mm}
  *{box-sizing:border-box}
  body{margin:0;background:#fff;color:#111;font-family:Cairo,Tahoma,Arial,sans-serif;direction:rtl}
  .print-head{text-align:center;margin:0 0 14px}
  .print-head h1{font-size:20px;margin:0 0 5px;color:#0b3a65}
  .print-head p{font-size:11px;margin:0;color:#444}
  .count{font-size:11px;margin-top:5px}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px}
  thead{display:table-header-group}
  th{background:#eaf1f7;color:#0b3a65;font-weight:800}
  th,td{border:1px solid #777;padding:7px 8px;text-align:right;vertical-align:middle;word-break:break-word}
  tr{break-inside:avoid;page-break-inside:avoid}
  th:nth-child(1),td:nth-child(1){width:31%}
  th:nth-child(2),td:nth-child(2){width:17%}
  th:nth-child(3),td:nth-child(3){width:22%}
  th:nth-child(4),td:nth-child(4){width:30%}
  td.mobile{direction:ltr;text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
  <div class="print-head">
    <h1>جدول بيانات الهيئة الإدارية والتعليمية</h1>
    <p>متوسطة وثانوية مشكاة الشعلة</p>
    <div class="count">عدد السجلات: ${rows.length}</div>
  </div>
  <table>
    <thead><tr><th>الاسم</th><th>رقم الجوال</th><th>المادة / المسمى</th><th>الإدارة</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
<script>
  window.addEventListener('load', function(){
    setTimeout(function(){ window.focus(); window.print(); }, 120);
  });
<\/script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

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
        <button type="button" className="btn ghost staff-directory-print" onClick={printTable}>طباعة الجدول</button>
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
