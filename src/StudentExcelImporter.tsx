import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { niceError, rpc } from "./client";
import "./student-importer.css";

type Department = { id: string; name: string };
type ImportOptions = { academic_year_id: string; academic_year: string; departments: Department[] };
type ImportRow = { student_no: string; student_name: string; grade: string; class_name: string };
type ImportResult = { inserted: number; updated: number; skipped: number; created_grades: number; created_classes: number; errors?: Array<{ row: number; student_no?: string; error: string }> };

type ColMap = { studentNo: number; studentName: number; grade: number; className: number };

const EMPTY_MAP: ColMap = { studentNo: -1, studentName: -1, grade: -1, className: -1 };
const aliases: Record<keyof ColMap, string[]> = {
  studentNo: ["رقم الطالب", "رقم الطالب/ة", "رقم الطالبـ", "الرقم", "رقم", "student no", "student number", "student id", "id"],
  studentName: ["اسم الطالب", "اسم الطالب/ة", "اسم الطالبـ", "الاسم", "اسم", "student name", "name"],
  grade: ["الصف", "الصف الدراسي", "grade", "level"],
  className: ["الفصل", "الشعبة", "رقم الفصل", "class", "section"],
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
function canonicalGrade(value: unknown, departmentName: string) {
  const raw = latinDigits(text(value));
  const n = normalized(raw);
  const secondary = departmentName.includes("ثان");
  const middle = departmentName.includes("متوسط");

  const first = /(^|\D)(1|01)(\D|$)/.test(raw) || /(^|\D)(07|070|0730|10|100|1030)(\D|$)/.test(raw) || /الأول|الاول|اول|أول/.test(n);
  const second = /(^|\D)(2|02)(\D|$)/.test(raw) || /(^|\D)(08|080|0830|11|110|1130)(\D|$)/.test(raw) || /الثاني|ثانى|ثاني/.test(n);
  const third = /(^|\D)(3|03)(\D|$)/.test(raw) || /(^|\D)(09|090|0930|12|120|1230)(\D|$)/.test(raw) || /الثالث|ثالث/.test(n);

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
function cleanClass(value: unknown) {
  let v = latinDigits(text(value));
  v = v.replace(/^الفصل\s*/i, "").replace(/^شعبة\s*/i, "").trim();
  return v.replace(/\.0+$/, "");
}
function detectHeaderRow(matrix: unknown[][]) {
  let best = 0, bestScore = -1;
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const row = matrix[i] || [];
    const vals = row.map(normalized);
    let aliasScore = 0;
    (Object.keys(aliases) as Array<keyof ColMap>).forEach(k => {
      if (vals.some(v => aliases[k].some(a => v === normalized(a) || v.includes(normalized(a))))) aliasScore += 4;
    });
    const nonEmpty = vals.filter(Boolean).length;
    const score = aliasScore + Math.min(nonEmpty, 8) * 0.15;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
function autoMap(headers: string[]): ColMap {
  const map = { ...EMPTY_MAP };
  (Object.keys(aliases) as Array<keyof ColMap>).forEach(key => {
    const idx = headers.findIndex(h => aliases[key].some(a => normalized(h) === normalized(a) || normalized(h).includes(normalized(a))));
    if (idx >= 0) map[key] = idx;
  });
  return map;
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

export default function StudentExcelImporter({ onImported }: { onImported: () => Promise<void> | void }) {
  const [options, setOptions] = useState<ImportOptions | null>(null);
  const [departmentId, setDepartmentId] = useState("");
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

  useEffect(() => {
    rpc<ImportOptions>("api_student_import_options").then(o => {
      setOptions(o);
      if (o.departments.length === 1) setDepartmentId(o.departments[0].id);
    }).catch(e => setMessage(niceError(e)));
  }, []);

  const departmentName = options?.departments.find(d => d.id === departmentId)?.name || "";

  function applyHeader(data: unknown[][], rowIndex: number) {
    const safeIndex = Math.max(0, Math.min(rowIndex, Math.max(0, data.length - 1)));
    const hs = uniqueHeaders(data[safeIndex] || []);
    setHeaderRow(safeIndex);
    setHeaders(hs);
    setMapping(autoMap(hs));
  }

  function parseSheet(wb: XLSX.WorkBook, name: string) {
    const ws = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false, blankrows: false }) as unknown[][];
    setSheetName(name);
    setMatrix(data);
    applyHeader(data, detectHeaderRow(data));
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    setBusy(true); setMessage(""); setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: false });
      if (!wb.SheetNames.length) throw new Error("ملف Excel لا يحتوي على أي شيت.");
      setBook(wb); setFileName(file.name);
      const guessed = options?.departments.find(d => file.name.includes("ثانو") ? d.name.includes("ثان") : file.name.includes("متوسط") ? d.name.includes("متوسط") : false);
      if (guessed) setDepartmentId(guessed.id);
      parseSheet(wb, wb.SheetNames[0]);
    } catch (e) { setMessage("تعذر قراءة ملف Excel: " + niceError(e)); }
    finally { setBusy(false); }
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
      if (!item.student_no || !item.student_name || !item.grade || !item.class_name) { invalid++; continue; }
      mapped.push(item);
    }
    const byNo = new Map<string, ImportRow>();
    let duplicates = 0;
    mapped.forEach(r => { if (byNo.has(r.student_no)) duplicates++; byNo.set(r.student_no, r); });
    return { rows: Array.from(byNo.values()), invalid, duplicates };
  }, [rawRows, mapping, departmentName]);

  const mappingReady = departmentId && Object.values(mapping).every(v => v >= 0) && prepared.rows.length > 0;

  async function importStudents() {
    if (!mappingReady) return;
    setBusy(true); setMessage(""); setResult(null);
    try {
      const total: ImportResult = { inserted: 0, updated: 0, skipped: 0, created_grades: 0, created_classes: 0, errors: [] };
      for (let i = 0; i < prepared.rows.length; i += 300) {
        const chunk = prepared.rows.slice(i, i + 300);
        const r = await rpc<ImportResult>("api_import_students", { p_department_id: departmentId, p_rows: chunk });
        total.inserted += Number(r.inserted || 0); total.updated += Number(r.updated || 0); total.skipped += Number(r.skipped || 0);
        total.created_grades += Number(r.created_grades || 0); total.created_classes += Number(r.created_classes || 0);
        total.errors?.push(...(r.errors || []));
      }
      setResult(total);
      setMessage(`تم الاستيراد: ${total.inserted} طالب جديد، وتحديث ${total.updated} طالب.`);
      await onImported();
    } catch (e) { setMessage(niceError(e)); }
    finally { setBusy(false); }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["رقم الطالب", "اسم الطالب", "الصف", "الفصل"],
      ["10001", "اسم الطالب رباعي", "الأول المتوسط", "1"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
    XLSX.writeFile(wb, "نموذج-استيراد-الطلاب.xlsx");
  }

  return <section className="panel excel-importer">
    <div className="panel-title excel-import-title">
      <div><h3>إضافة / تحديث الطلاب من Excel</h3><p>يدعم XLSX وXLS القديم. يتم إنشاء الصفوف والفصول الناقصة تلقائيًا دون حذف الطلاب الحاليين.</p></div>
      <button type="button" className="mini-btn" onClick={downloadTemplate}>تحميل نموذج Excel</button>
    </div>

    <div className="excel-import-grid">
      <label className="excel-drop">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={e => chooseFile(e.target.files?.[0])} />
        <span className="excel-icon">▦</span>
        <b>{fileName || "اختر شيت الطلاب"}</b>
        <small>اضغط لاختيار ملف .xlsx أو .xls</small>
      </label>

      <div className="excel-config">
        <label>القسم / المرحلة<select value={departmentId} onChange={e => setDepartmentId(e.target.value)}><option value="">اختر القسم</option>{options?.departments.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
        {book && <label>الشيت<select value={sheetName} onChange={e => changeSheet(e.target.value)}>{book.SheetNames.map(s => <option key={s}>{s}</option>)}</select></label>}
        {matrix.length > 0 && <label>صف العناوين<input type="number" min={1} max={Math.min(matrix.length, 30)} value={headerRow + 1} onChange={e => applyHeader(matrix, Number(e.target.value || 1) - 1)} /></label>}
        {options?.academic_year && <div className="excel-year"><small>العام الدراسي الحالي</small><b>{options.academic_year}</b></div>}
      </div>
    </div>

    {headers.length > 0 && <>
      <div className="excel-mapping">
        <h4>مطابقة أعمدة الشيت</h4>
        <p>النظام يحاول اكتشاف الأعمدة تلقائيًا، ويمكنك تعديل أي اختيار.</p>
        <div>{([
          ["studentNo", "رقم الطالب"], ["studentName", "اسم الطالب"], ["grade", "الصف"], ["className", "الفصل"],
        ] as Array<[keyof ColMap, string]>).map(([key, label]) => <label key={key}>{label}<select value={mapping[key]} onChange={e => setMapping(m => ({ ...m, [key]: Number(e.target.value) }))}><option value={-1}>اختر العمود</option>{headers.map((h, i) => <option value={i} key={i}>{h}</option>)}</select></label>)}</div>
      </div>

      <div className="excel-summary">
        <span><b>{rawRows.length}</b><small>صف في الشيت</small></span>
        <span><b>{prepared.rows.length}</b><small>طالب جاهز</small></span>
        <span className={prepared.invalid ? "warn" : ""}><b>{prepared.invalid}</b><small>صف ناقص سيتم تجاهله</small></span>
        <span className={prepared.duplicates ? "warn" : ""}><b>{prepared.duplicates}</b><small>رقم مكرر — سيؤخذ آخر صف</small></span>
      </div>

      {prepared.rows.length > 0 && <div className="excel-preview"><div className="panel-title"><div><h4>معاينة قبل الحفظ</h4><p>أول 10 طلاب بعد تنظيف الصف والفصل وأرقام الطلاب.</p></div><span className="counter">{prepared.rows.length}</span></div><div className="table-wrap"><table><thead><tr><th>رقم الطالب</th><th>اسم الطالب</th><th>الصف</th><th>الفصل</th></tr></thead><tbody>{prepared.rows.slice(0, 10).map((r, i) => <tr key={r.student_no + i}><td>{r.student_no}</td><td><b>{r.student_name}</b></td><td>{r.grade}</td><td>{r.class_name}</td></tr>)}</tbody></table></div></div>}

      <div className="excel-actions"><button className="btn primary" disabled={busy || !mappingReady} onClick={importStudents}>{busy ? "جارٍ معالجة الملف..." : `استيراد ${prepared.rows.length || ""} طالب`}</button><small>لن يتم حذف أي طالب. إذا كان رقم الطالب موجودًا سيتم تحديث اسمه وفصله فقط.</small></div>
    </>}

    {message && <div className="notice">{message}</div>}
    {result && <div className="excel-result"><div><b>{result.inserted}</b><span>طلاب جدد</span></div><div><b>{result.updated}</b><span>طلاب محدثون</span></div><div><b>{result.created_grades}</b><span>صفوف جديدة</span></div><div><b>{result.created_classes}</b><span>فصول جديدة</span></div>{result.skipped > 0 && <div className="warn"><b>{result.skipped}</b><span>صفوف لم تُحفظ</span></div>}</div>}
  </section>;
}
