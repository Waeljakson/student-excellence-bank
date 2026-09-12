import { readFileSync, writeFileSync } from "node:fs";

const path = "src/StudentExcelImporter.tsx";
let src = readFileSync(path, "utf8");
if (src.includes("AUTO_STUDENT_SHEET_V2")) process.exit(0);

function mustReplace(search, replacement, label) {
  if (!src.includes(search)) throw new Error(`student-import-autodetect-v2: marker not found: ${label}`);
  src = src.replace(search, replacement);
}

mustReplace(
`const aliases: Record<keyof ColMap, string[]> = {
  studentNo: ["رقم الطالب", "رقم الطالب/ة", "رقم الطالبـ", "الرقم", "رقم", "student no", "student number", "student id", "id"],
  studentName: ["اسم الطالب", "اسم الطالب/ة", "اسم الطالبـ", "الاسم", "اسم", "student name", "name"],
  grade: ["الصف", "الصف الدراسي", "grade", "level"],
  className: ["الفصل", "الشعبة", "رقم الفصل", "class", "section"],
};`,
`const aliases: Record<keyof ColMap, string[]> = {
  studentNo: ["رقم الطالب", "رقم الطالب/ة", "رقم الطالبـ", "الرقم التعريفي", "student no", "student number", "student id"],
  studentName: ["اسم الطالب", "اسم الطالب/ة", "اسم الطالبـ", "الاسم", "student name", "name"],
  grade: ["رقم الصف", "الصف", "الصف الدراسي", "grade", "level"],
  className: ["الفصل", "الشعبة", "رقم الفصل", "class", "section"],
};`,
"column aliases"
);

mustReplace(
`function uniqueHeaders(values: unknown[]) {
  const used = new Map<string, number>();
  return values.map((v, i) => {
    const base = text(v) || \`عمود \${i + 1}\`;
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : \`\${base} (\${count})\`;
  });
}
`,
`function uniqueHeaders(values: unknown[]) {
  const used = new Map<string, number>();
  return values.map((v, i) => {
    const base = text(v) || \`عمود \${i + 1}\`;
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : \`\${base} (\${count})\`;
  });
}

// AUTO_STUDENT_SHEET_V2
function sheetMatrix(wb: XLSX.WorkBook, name: string) {
  const ws = wb.Sheets[name];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false, blankrows: false }) as unknown[][];
}

function studentSheetCandidate(wb: XLSX.WorkBook) {
  let best: { name: string; score: number; headerRow: number } | null = null;
  for (const name of wb.SheetNames) {
    const data = sheetMatrix(wb, name);
    const rowIndex = detectHeaderRow(data);
    const headers = uniqueHeaders(data[rowIndex] || []);
    const map = autoMap(headers);
    const mapped = Object.values(map).filter(v => v >= 0).length;
    const dataRows = data.slice(rowIndex + 1).filter(r => r.some(v => text(v) !== "")).length;
    const score = mapped * 1000 + Math.min(dataRows, 999);
    if (!best || score > best.score) best = { name, score, headerRow: rowIndex };
  }
  return best;
}

function inferDepartmentKind(wb: XLSX.WorkBook, fileName: string): "secondary" | "middle" | "" {
  const samples: string[] = [fileName, ...wb.SheetNames];
  for (const name of wb.SheetNames.slice(0, 2)) {
    const data = sheetMatrix(wb, name).slice(0, 20);
    for (const row of data) samples.push(...row.map(v => text(v)));
  }
  const all = normalized(samples.join(" "));
  if (/ثانو|الثانوي|ثانوية/.test(all)) return "secondary";
  if (/متوسط|المتوسطة/.test(all)) return "middle";
  return "";
}
`,
"workbook detection helpers"
);

mustReplace(
`  const [result, setResult] = useState<ImportResult | null>(null);
`,
`  const [result, setResult] = useState<ImportResult | null>(null);
  const [departmentHint, setDepartmentHint] = useState<"secondary" | "middle" | "">("");
`,
"department hint state"
);

mustReplace(
`  useEffect(() => {
    rpc<ImportOptions>("api_student_import_options").then(o => {
      setOptions(o);
      if (o.departments.length === 1) setDepartmentId(o.departments[0].id);
    }).catch(e => setMessage(niceError(e)));
  }, []);
`,
`  useEffect(() => {
    rpc<ImportOptions>("api_student_import_options").then(o => {
      setOptions(o);
      if (o.departments.length === 1) setDepartmentId(o.departments[0].id);
      else if (departmentHint) {
        const d = o.departments.find(x => departmentHint === "secondary" ? x.name.includes("ثان") : x.name.includes("متوسط"));
        if (d) setDepartmentId(d.id);
      }
    }).catch(e => setMessage(niceError(e)));
  }, []);

  useEffect(() => {
    if (!options || !departmentHint) return;
    const d = options.departments.find(x => departmentHint === "secondary" ? x.name.includes("ثان") : x.name.includes("متوسط"));
    if (d) setDepartmentId(d.id);
  }, [options, departmentHint]);
`,
"department hint effect"
);

mustReplace(
`  function parseSheet(wb: XLSX.WorkBook, name: string) {
    const ws = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false, blankrows: false }) as unknown[][];
    setSheetName(name);
    setMatrix(data);
    applyHeader(data, detectHeaderRow(data));
  }
`,
`  function parseSheet(wb: XLSX.WorkBook, name: string, forcedHeaderRow?: number) {
    const data = sheetMatrix(wb, name);
    setSheetName(name);
    setMatrix(data);
    applyHeader(data, forcedHeaderRow ?? detectHeaderRow(data));
  }
`,
"parse sheet"
);

mustReplace(
`  async function chooseFile(file?: File) {
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
`,
`  async function chooseFile(file?: File) {
    if (!file) return;
    setBusy(true); setMessage(""); setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: false });
      if (!wb.SheetNames.length) throw new Error("ملف Excel لا يحتوي على أي شيت.");
      setBook(wb); setFileName(file.name);

      const kind = inferDepartmentKind(wb, file.name);
      setDepartmentHint(kind);
      if (options && kind) {
        const guessed = options.departments.find(d => kind === "secondary" ? d.name.includes("ثان") : d.name.includes("متوسط"));
        if (guessed) setDepartmentId(guessed.id);
      }

      const candidate = studentSheetCandidate(wb);
      if (!candidate || candidate.score < 3000) {
        parseSheet(wb, wb.SheetNames[Math.min(1, wb.SheetNames.length - 1)]);
        setMessage("تم فتح الملف. اختر شيت الطلاب أو طابق الأعمدة يدويًا إذا لم يتم اكتشافها تلقائيًا.");
      } else {
        parseSheet(wb, candidate.name, candidate.headerRow);
        const stageLabel = kind === "secondary" ? "الثانوية" : kind === "middle" ? "المتوسطة" : "";
        setMessage("تم اكتشاف " + (stageLabel ? "المرحلة " + stageLabel + " و" : "") + "شيت الطلاب «" + candidate.name + "» تلقائيًا.");
      }
    } catch (e) { setMessage("تعذر قراءة ملف Excel: " + niceError(e)); }
    finally { setBusy(false); }
  }
`,
"choose file auto detection"
);

writeFileSync(path, src);
