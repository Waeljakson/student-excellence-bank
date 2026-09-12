import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { niceError, rpc } from "./client";
import "./student-importer.css";

type Department = { id: string; name: string };
type ImportOptions = { academic_year_id: string; academic_year: string; departments: Department[] };
type ImportRow = { student_no: string; student_name: string; grade: string; class_name: string };
type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  created_grades: number;
  created_classes: number;
  errors?: Array<{ row: number; student_no?: string; error: string }>;
};
type ColMap = { studentNo: number; studentName: number; grade: number; className: number };
type StageKind = "secondary" | "middle" | "";

const EMPTY_MAP: ColMap = { studentNo: -1, studentName: -1, grade: -1, className: -1 };
const MISHKAT_DEPARTMENTS: Department[] = [
  { id: "bd67db56-4910-440e-b78a-ea23c4d12998", name: "متوسطة مشكاة الشعلة" },
  { id: "d7fe2e14-9943-4d1b-bdb8-084108579e79", name: "ثانوية مشكاة الشعلة" },
];

const aliases: Record<keyof ColMap, string[]> = {
  studentNo: ["رقم الطالب", "رقم الطالب/ة", "رقم الطالبـ", "رقم الطالب / الطالبة", "الرقم التعريفي", "student no", "student number", "student id"],
  studentName: ["اسم الطالب", "اسم الطالب/ة", "اسم الطالبـ", "اسم الطالب / الطالبة", "الاسم", "student name", "name"],
  grade: ["رقم الصف", "رمز الصف", "الصف", "الصف الدراسي", "grade", "level"],
  className: ["الفصل", "رقم الفصل", "الشعبة", "class", "section"],
};

function text(v: unknown) {
  return String(v ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function normalized(v: unknown) {
  return text(v).toLowerCase().replace(/[ـ_\-:/\\]/g, " ").replace(/\s+/g, " ").trim();
}
function latinDigits(v: string) {
  const ar = "٠١٢٣٤٥٦٧٨٩";
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  return v.replace(/[٠-٩]/g, d => String(ar.indexOf(d))).replace(/[۰-۹]/g, d => String(fa.indexOf(d)));
}
function cleanStudentNo(v: unknown) {
  return latinDigits(text(v)).replace(/\.0+$/, "");
}
function cleanClass(value: unknown) {
  let v = latinDigits(text(value));
  v = v.replace(/^الفصل\s*/i, "").replace(/^شعبة\s*/i, "").trim();
  return v.replace(/\.0+$/, "");
}
function canonicalGrade(value: unknown, departmentName: string) {
  const raw = latinDigits(text(value));
  const compact = raw.replace(/\D/g, "");
  const n = normalized(raw);
  const secondary = departmentName.includes("ثان");
  const middle = departmentName.includes("متوسط");

  const first = ["1", "01", "7", "07", "070", "730", "0730", "10", "100", "1030"].includes(compact) || /الأول|الاول|اول|أول/.test(n);
  const second = ["2", "02", "8", "08", "080", "830", "0830", "11", "110", "1130"].includes(compact) || /الثاني|ثانى|ثاني/.test(n);
  const third = ["3", "03", "9", "09", "090", "930", "0930", "12", "120", "1230"].includes(compact) || /الثالث|ثالث/.test(n);

  if (secondary) {
    if (first) return "الأول الثانوي";
    if (second) return "الثاني الثانوي";
    if (third) return "الثالث الثانوي";
  }
  if (middle) {
    if (first) return "الأول المتوسط";
    if (second) return "الثاني المتوسط";
    if (third) return "الثالث المتوسط";
  }
  return raw;
}
function uniqueHeaders(values: unknown[]) {
  const used = new Map<string, number>();
  return values.map((v, i) => {
    const base = text(v) || `عمود ${i + 1}`;
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}
function headerMatches(header: string, alias: string) {
  const h = normalized(header);
  const a = normalized(alias);
  return h === a || (a.length >= 5 && h.includes(a));
}
function autoMap(headers: string[]): ColMap {
  const map = { ...EMPTY_MAP };
  (Object.keys(aliases) as Array<keyof ColMap>).forEach(key => {
    const idx = headers.findIndex(h => aliases[key].some(a => headerMatches(h, a)));
    if (idx >= 0) map[key] = idx;
  });
  return map;
}
function detectHeaderRow(matrix: unknown[][]) {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const headers = uniqueHeaders(matrix[i] || []);
    const map = autoMap(headers);
    const matched = Object.values(map).filter(v => v >= 0).length;
    const nonEmpty = headers.filter(h => !/^عمود \d+$/.test(h)).length;
    const score = matched * 100 + Math.min(nonEmpty, 10);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}
function sheetMatrix(wb: XLSX.WorkBook, name: string) {
  const ws = wb.Sheets[name];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false, blankrows: false }) as unknown[][];
}
function studentSheetCandidate(wb: XLSX.WorkBook) {
  let best: { name: string; headerRow: number; score: number } | null = null;
  for (const name of wb.SheetNames) {
    const data = sheetMatrix(wb, name);
    const headerRow = detectHeaderRow(data);
    const headers = uniqueHeaders(data[headerRow] || []);
    const map = autoMap(headers);
    const mapped = Object.values(map).filter(v => v >= 0).length;
    const dataRows = data.slice(headerRow + 1).filter(r => r.some(v => text(v) !== "")).length;
    const score = mapped * 1000 + Math.min(dataRows, 999);
    if (!best || score > best.score) best = { name, headerRow, score };
  }
  return best;
}
function inferDepartmentKind(wb: XLSX.WorkBook, fileName: string): StageKind {
  const samples: string[] = [fileName, ...wb.SheetNames];
  for (const name of wb.SheetNames.slice(0, 2)) {
    for (const row of sheetMatrix(wb, name).slice(0, 30)) samples.push(...row.map(v => text(v)));
  }
  const all = normalized(samples.join(" "));
  if (/ثانو|الثانوي|ثانوية/.test(all)) return "secondary";
  if (/متوسط|المتوسطة/.test(all)) return "middle";
  if (/\b(1030|1130|1230)\b/.test(latinDigits(all))) return "secondary";
  if (/\b(0730|0830|0930)\b/.test(latinDigits(all))) return "middle";
  return "";
}
function stageDepartment(kind: StageKind, departments: Department[]) {
  if (!kind) return undefined;
  return departments.find(d => kind === "secondary" ? /ثان/.test(d.name) : /متوسط/.test(d.name));
}
function unwrapOptions(value: any): ImportOptions | null {
  const candidate = Array.isArray(value) ? (value[0]?.api_student_import_options ?? value[0]) : (value?.api_student_import_options ?? value);
  if (!candidate || typeof candidate !== "object") return null;
  return {
    academic_year_id: String(candidate.academic_year_id || ""),
    academic_year: String(candidate.academic_year || ""),
    departments: Array.isArray(candidate.departments) ? candidate.departments.map((d: any) => ({ id: String(d.id), name: String(d.name) })) : [],
  };
}
function unwrapImportResult(value: any): ImportResult {
  const r = Array.isArray(value) ? (value[0]?.api_import_students ?? value[0]) : (value?.api_import_students ?? value);
  return {
    inserted: Number(r?.inserted || 0),
    updated: Number(r?.updated || 0),
    skipped: Number(r?.skipped || 0),
    created_grades: Number(r?.created_grades || 0),
    created_classes: Number(r?.created_classes || 0),
    errors: Array.isArray(r?.errors) ? r.errors : [],
  };
}

export default function StudentExcelImporter({ onImported }: { onImported: () => Promise<void> | void }) {
  const [options, setOptions] = useState<ImportOptions | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [departmentHint, setDepartmentHint] = useState<StageKind>("");
  const [book, setBook] = useState<XLSX.WorkBook | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [matrix, setMatrix] = useState<unknown[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColMap>(EMPTY_MAP);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const availableDepartments = useMemo(() => {
    const merged = new Map<string, Department>();
    MISHKAT_DEPARTMENTS.forEach(d => merged.set(d.id, d));
    (options?.departments || []).forEach(d => merged.set(d.id, d));
    return Array.from(merged.values());
  }, [options]);

  useEffect(() => {
    rpc<any>("api_student_import_options").then(raw => {
      const o = unwrapOptions(raw);
      if (!o) return;
      setOptions(o);
      if (o.departments.length === 1) setDepartmentId(o.departments[0].id);
    }).catch(() => {
      // القسمان الأساسيان موجودان كـ fallback؛ لا نعطل الاستيراد بسبب تأخر خيارات Neon.
    });
  }, []);

  useEffect(() => {
    const d = stageDepartment(departmentHint, availableDepartments);
    if (departmentHint && d && departmentId !== d.id) setDepartmentId(d.id);
  }, [departmentHint, availableDepartments, departmentId]);

  const departmentName = availableDepartments.find(d => d.id === departmentId)?.name || "";

  function applyHeader(data: unknown[][], rowIndex: number) {
    const safeIndex = Math.max(0, Math.min(rowIndex, Math.max(0, data.length - 1)));
    const hs = uniqueHeaders(data[safeIndex] || []);
    setHeaderRow(safeIndex);
    setHeaders(hs);
    setMapping(autoMap(hs));
  }

  function parseSheet(wb: XLSX.WorkBook, name: string, forcedHeaderRow?: number) {
    const data = sheetMatrix(wb, name);
    setSheetName(name);
    setMatrix(data);
    applyHeader(data, forcedHeaderRow ?? detectHeaderRow(data));
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: false });
      if (!wb.SheetNames.length) throw new Error("ملف Excel لا يحتوي على أي شيت.");

      setBook(wb);
      setFileName(file.name);

      const kind = inferDepartmentKind(wb, file.name);
      setDepartmentHint(kind);
      const autoDepartment = stageDepartment(kind, availableDepartments);
      if (autoDepartment) setDepartmentId(autoDepartment.id);

      const candidate = studentSheetCandidate(wb);
      const fallbackSheet = wb.SheetNames[Math.min(1, wb.SheetNames.length - 1)];
      const chosen = candidate && candidate.score >= 3000 ? candidate : { name: fallbackSheet, headerRow: detectHeaderRow(sheetMatrix(wb, fallbackSheet)), score: 0 };
      parseSheet(wb, chosen.name, chosen.headerRow);

      const stageLabel = kind === "secondary" ? "المرحلة الثانوية" : kind === "middle" ? "المرحلة المتوسطة" : "المرحلة غير محددة";
      setMessage(`تم اكتشاف ${stageLabel} وشيت الطلاب «${chosen.name}» تلقائيًا.`);
    } catch (e) {
      setMessage("تعذر قراءة ملف Excel: " + niceError(e));
    } finally {
      setBusy(false);
    }
  }

  function changeSheet(name: string) {
    if (book) parseSheet(book, name);
  }

  const rawRows = useMemo(() => matrix.slice(headerRow + 1).filter(r => r.some(v => text(v) !== "")), [matrix, headerRow]);

  const prepared = useMemo(() => {
    if (!departmentName || Object.values(mapping).some(v => v < 0)) return { rows: [] as ImportRow[], invalid: 0, duplicates: 0 };
    const mapped: ImportRow[] = [];
    let invalid = 0;
    for (const row of rawRows) {
      const item: ImportRow = {
        student_no: cleanStudentNo(row[mapping.studentNo]),
        student_name: text(row[mapping.studentName]),
        grade: canonicalGrade(row[mapping.grade], departmentName),
        class_name: cleanClass(row[mapping.className]),
      };
      if (!item.student_no || !item.student_name || !item.grade || !item.class_name) {
        invalid++;
        continue;
      }
      mapped.push(item);
    }
    const byNo = new Map<string, ImportRow>();
    let duplicates = 0;
    for (const r of mapped) {
      if (byNo.has(r.student_no)) duplicates++;
      byNo.set(r.student_no, r);
    }
    return { rows: Array.from(byNo.values()), invalid, duplicates };
  }, [rawRows, mapping, departmentName]);

  async function importStudents() {
    if (!book) {
      setMessage("اختر ملف Excel أولًا.");
      return;
    }

    const missing: string[] = [];
    if (mapping.studentNo < 0) missing.push("رقم الطالب");
    if (mapping.studentName < 0) missing.push("اسم الطالب");
    if (mapping.grade < 0) missing.push("الصف / رقم الصف");
    if (mapping.className < 0) missing.push("الفصل");
    if (missing.length) {
      setMessage("تعذر تحديد الأعمدة التالية: " + missing.join("، ") + ". اخترها من مطابقة الأعمدة ثم أعد الاستيراد.");
      return;
    }
    if (!prepared.rows.length) {
      setMessage("لم يتم العثور على أسماء طلاب صالحة للاستيراد في الشيت المحدد. راجع صف العناوين ومطابقة الأعمدة.");
      return;
    }

    let importDepartmentId = departmentId || stageDepartment(departmentHint, availableDepartments)?.id || "";
    if (!importDepartmentId && departmentHint) {
      const fallback = stageDepartment(departmentHint, MISHKAT_DEPARTMENTS);
      if (fallback) {
        importDepartmentId = fallback.id;
        setDepartmentId(fallback.id);
      }
    }
    if (!importDepartmentId) {
      setMessage("اختر القسم / المرحلة قبل الاستيراد.");
      return;
    }

    setBusy(true);
    setMessage("جارٍ إرسال أسماء الطلاب إلى قاعدة البيانات...");
    setResult(null);
    try {
      const total: ImportResult = { inserted: 0, updated: 0, skipped: 0, created_grades: 0, created_classes: 0, errors: [] };
      for (let i = 0; i < prepared.rows.length; i += 300) {
        const chunk = prepared.rows.slice(i, i + 300);
        const raw = await rpc<any>("api_import_students", { p_department_id: importDepartmentId, p_rows: chunk });
        const r = unwrapImportResult(raw);
        total.inserted += r.inserted;
        total.updated += r.updated;
        total.skipped += r.skipped;
        total.created_grades += r.created_grades;
        total.created_classes += r.created_classes;
        total.errors?.push(...(r.errors || []));
      }

      setResult(total);
      const affected = total.inserted + total.updated;
      if (affected <= 0) {
        setMessage(`لم يتم استيراد أي طالب. تم تخطي ${total.skipped} صف. راجع بيانات المعاينة قبل المحاولة مرة أخرى.`);
        return;
      }

      setMessage(`تم استيراد الطلاب بنجاح: ${total.inserted} طالب جديد، وتحديث ${total.updated} طالب.`);
      await onImported();
    } catch (e) {
      setMessage("فشل استيراد الطلاب: " + niceError(e));
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["رقم الطالب", "اسم الطالب", "رقم الصف", "الفصل"],
      ["10001", "اسم الطالب رباعي", "1030", "1"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
    XLSX.writeFile(wb, "نموذج-استيراد-الطلاب.xlsx");
  }

  return <section className="panel excel-importer">
    <div className="panel-title excel-import-title">
      <div>
        <h3>إضافة / تحديث الطلاب من Excel</h3>
        <p>يدعم XLSX وXLS القديم. يقرأ بيانات المدرسة من الشيت الأول ويبحث عن شيت الطلاب تلقائيًا.</p>
      </div>
      <button type="button" className="mini-btn" onClick={downloadTemplate}>تحميل نموذج Excel</button>
    </div>

    <div className="excel-import-grid">
      <label className="excel-drop">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={e => chooseFile(e.target.files?.[0])} />
        <span className="excel-icon">▦</span>
        <b>{fileName || "اختر ملف الطلاب"}</b>
        <small>اضغط لاختيار ملف .xlsx أو .xls</small>
      </label>

      <div className="excel-config">
        <label>القسم / المرحلة
          <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
            <option value="">اختر القسم</option>
            {availableDepartments.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}
          </select>
          {departmentHint && <small>تم تحديد {departmentHint === "secondary" ? "المرحلة الثانوية" : "المرحلة المتوسطة"} تلقائيًا.</small>}
        </label>
        {book && <label>الشيت
          <select value={sheetName} onChange={e => changeSheet(e.target.value)}>{book.SheetNames.map(s => <option key={s}>{s}</option>)}</select>
        </label>}
        {matrix.length > 0 && <label>صف العناوين
          <input type="number" min={1} max={Math.min(matrix.length, 30)} value={headerRow + 1} onChange={e => applyHeader(matrix, Number(e.target.value || 1) - 1)} />
        </label>}
        {options?.academic_year && <div className="excel-year"><small>العام الدراسي الحالي</small><b>{options.academic_year}</b></div>}
      </div>
    </div>

    {headers.length > 0 && <>
      <div className="excel-mapping">
        <h4>مطابقة أعمدة الشيت</h4>
        <p>راجع أن الأعمدة الأربعة صحيحة قبل الضغط على الاستيراد.</p>
        <div>{([
          ["studentNo", "رقم الطالب"],
          ["studentName", "اسم الطالب"],
          ["grade", "الصف / رقم الصف"],
          ["className", "الفصل"],
        ] as Array<[keyof ColMap, string]>).map(([key, label]) => <label key={key}>{label}
          <select value={mapping[key]} onChange={e => setMapping(m => ({ ...m, [key]: Number(e.target.value) }))}>
            <option value={-1}>اختر العمود</option>
            {headers.map((h, i) => <option value={i} key={i}>{h}</option>)}
          </select>
        </label>)}</div>
      </div>

      <div className="excel-summary">
        <span><b>{rawRows.length}</b><small>صف في الشيت</small></span>
        <span><b>{prepared.rows.length}</b><small>طالب جاهز للاستيراد</small></span>
        <span className={prepared.invalid ? "warn" : ""}><b>{prepared.invalid}</b><small>صف غير مكتمل</small></span>
        <span className={prepared.duplicates ? "warn" : ""}><b>{prepared.duplicates}</b><small>رقم طالب مكرر</small></span>
      </div>

      <div className="excel-preview">
        <h4>معاينة أسماء الطلاب قبل الاستيراد</h4>
        <p>إذا ظهرت الأسماء هنا بشكل صحيح، فهذه هي البيانات التي سترسل إلى Neon.</p>
        <div className="table-wrap"><table><thead><tr><th>رقم الطالب</th><th>اسم الطالب</th><th>الصف</th><th>الفصل</th></tr></thead><tbody>
          {prepared.rows.slice(0, 12).map((r, i) => <tr key={`${r.student_no}-${i}`}><td>{r.student_no}</td><td>{r.student_name}</td><td>{r.grade}</td><td>{r.class_name}</td></tr>)}
          {!prepared.rows.length && <tr><td colSpan={4}>لا توجد أسماء جاهزة بعد. راجع مطابقة الأعمدة.</td></tr>}
        </tbody></table></div>
      </div>

      <div className="excel-actions">
        <button className="btn primary" disabled={busy || !book} onClick={importStudents}>{busy ? "جارٍ استيراد الطلاب..." : `استيراد ${prepared.rows.length || ""} طالب`}</button>
        <small>لن تظهر رسالة نجاح إلا بعد أن يؤكد Neon أنه أضاف أو حدّث الطلاب فعليًا.</small>
      </div>
    </>}

    {message && <p className="form-message">{message}</p>}
    {result && <div className="excel-result">
      <div><b>{result.inserted}</b><span>طلاب جدد</span></div>
      <div><b>{result.updated}</b><span>طلاب تم تحديثهم</span></div>
      <div className={result.skipped ? "warn" : ""}><b>{result.skipped}</b><span>صفوف متخطاة</span></div>
      <div><b>{result.created_grades}</b><span>صفوف دراسية جديدة</span></div>
      <div><b>{result.created_classes}</b><span>فصول جديدة</span></div>
    </div>}
  </section>;
}
