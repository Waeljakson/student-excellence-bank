"use client";

import { useMemo, useState } from "react";

type Row = {
  department: string;
  grade: string;
  class_name: string;
  student_no: string;
  student_name: string;
};

const HEADER_ALIASES: Record<keyof Row, string[]> = {
  department: ["المرحلة", "القسم", "department"],
  grade: ["الصف", "grade"],
  class_name: ["الفصل", "class", "class_name"],
  student_no: ["رقم الطالب", "الرقم", "student_no", "student number"],
  student_name: ["اسم الطالب", "الاسم", "student_name", "name"],
};

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function splitDelimitedLine(line: string, delimiter: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function detectDelimiter(header: string) {
  if (header.includes("\t")) return "\t";
  const semis = (header.match(/;/g) || []).length;
  const commas = (header.match(/,/g) || []).length;
  return semis > commas ? ";" : ",";
}

function parseTable(text: string): Row[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  if (lines.length < 2) throw new Error("الملف لا يحتوي على صفوف بيانات كافية.");
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader);

  const indexes = {} as Record<keyof Row, number>;
  (Object.keys(HEADER_ALIASES) as (keyof Row)[]).forEach((key) => {
    const idx = headers.findIndex((h) => HEADER_ALIASES[key].includes(h));
    if (idx === -1) throw new Error(`العمود المطلوب غير موجود: ${HEADER_ALIASES[key][0]}`);
    indexes[key] = idx;
  });

  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    return {
      department: values[indexes.department] || "",
      grade: values[indexes.grade] || "",
      class_name: values[indexes.class_name] || "",
      student_no: values[indexes.student_no] || "",
      student_name: values[indexes.student_name] || "",
    };
  }).filter((r) => Object.values(r).some(Boolean));
}

export default function StudentImporter() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ row: number; error: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const preview = useMemo(() => rows.slice(0, 8), [rows]);

  function downloadTemplate() {
    const content = "المرحلة,الصف,الفصل,رقم الطالب,اسم الطالب\nمتوسطة مشكاة الشعلة,الأول المتوسط,1/1,1001,اسم الطالب\nثانوية مشكاة الشعلة,الأول الثانوي,1/1,2001,اسم الطالب";
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    setMessage("");
    setErrors([]);
    try {
      const text = await file.text();
      const parsed = parseTable(text);
      setRows(parsed);
      setFileName(file.name);
      setMessage(`تمت قراءة ${parsed.length} طالب من الملف. راجع المعاينة ثم اضغط استيراد.`);
    } catch (e: any) {
      setRows([]);
      setFileName(file.name);
      setMessage(e?.message || "تعذر قراءة الملف.");
    }
  }

  async function submit() {
    if (!rows.length) return;
    setLoading(true);
    setMessage("");
    setErrors([]);
    try {
      const response = await fetch("/api/setup/import-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const result = await response.json();
      setMessage(result.message || result.error || "انتهت عملية الاستيراد.");
      setErrors(result.errors || []);
      if (result.ok && !result.failed) {
        setRows([]);
        setFileName("");
      }
    } catch {
      setMessage("تعذر الاتصال بخدمة الاستيراد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>استيراد الصفوف والفصول والطلاب</h3>
          <p>ملف واحد ينشئ الصف والفصل تلقائيًا ثم يضيف أو يحدّث الطالب حسب رقم الطالب.</p>
        </div>
        <button className="btn" type="button" onClick={downloadTemplate}>تحميل النموذج</button>
      </div>

      <div className="form-grid">
        <label>
          ملف CSV
          <input type="file" accept=".csv,text/csv" onChange={(e) => chooseFile(e.target.files?.[0])} />
        </label>
        <div className="form-note">
          الأعمدة المطلوبة: المرحلة، الصف، الفصل، رقم الطالب، اسم الطالب.
        </div>
      </div>

      {fileName && <p className="form-note">الملف: {fileName}</p>}
      {message && <p className="form-note">{message}</p>}

      {!!preview.length && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>المرحلة</th><th>الصف</th><th>الفصل</th><th>رقم الطالب</th><th>اسم الطالب</th></tr></thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={`${row.student_no}-${i}`}>
                  <td>{row.department}</td><td>{row.grade}</td><td>{row.class_name}</td><td>{row.student_no}</td><td>{row.student_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > preview.length && <p className="form-note">المعاينة تعرض أول {preview.length} فقط من إجمالي {rows.length}.</p>}
        </div>
      )}

      {!!rows.length && (
        <button className="btn primary" disabled={loading} onClick={submit}>
          {loading ? "جارٍ الاستيراد..." : `استيراد ${rows.length} طالب`}
        </button>
      )}

      {!!errors.length && (
        <div className="form-note error-text">
          <b>أول الأخطاء:</b>
          <ul>{errors.map((e) => <li key={`${e.row}-${e.error}`}>السطر {e.row}: {e.error}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
