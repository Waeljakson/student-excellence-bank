import { readFileSync, writeFileSync } from "node:fs";

const path = "src/StudentExcelImporter.tsx";
let src = readFileSync(path, "utf8");
if (src.includes("IMPORT_STAGE_SYNC_V4")) process.exit(0);

function mustReplace(search, replacement, label) {
  if (!src.includes(search)) throw new Error(`student-import-stage-sync: marker not found: ${label}`);
  src = src.replace(search, replacement);
}

mustReplace(
  '  const departmentName = options?.departments.find(d => d.id === departmentId)?.name || (departmentHint === "secondary" ? "ثانوية" : departmentHint === "middle" ? "متوسطة" : ""); // IMPORT_BUTTON_UNLOCK_V3',
  `  // IMPORT_STAGE_SYNC_V4\n  const detectedDepartment = options?.departments.find(d =>\n    departmentId ? d.id === departmentId : departmentHint === "secondary" ? /ثان/.test(d.name) : departmentHint === "middle" ? /متوسط/.test(d.name) : false\n  );\n  const effectiveDepartmentId = departmentId || detectedDepartment?.id || "";\n  const departmentName = detectedDepartment?.name || (departmentHint === "secondary" ? "ثانوية مشكاة الشعلة" : departmentHint === "middle" ? "متوسطة مشكاة الشعلة" : "");\n\n  useEffect(() => {\n    if (!departmentId && detectedDepartment?.id) setDepartmentId(detectedDepartment.id);\n  }, [departmentId, detectedDepartment?.id]);`,
  "effective department"
);

mustReplace(
  '    const effectiveDepartmentId = departmentId || options?.departments.find(d => departmentHint === "secondary" ? d.name.includes("ثان") : departmentHint === "middle" ? d.name.includes("متوسط") : false)?.id || "";\n',
  '',
  "remove local effective department"
);

mustReplace(
  '<label>القسم / المرحلة<select value={departmentId} onChange={e => setDepartmentId(e.target.value)}><option value="">اختر القسم</option>{options?.departments.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label>',
  '<label>القسم / المرحلة<select value={effectiveDepartmentId} onChange={e => setDepartmentId(e.target.value)}><option value="">اختر القسم</option>{options?.departments.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select>{departmentHint && detectedDepartment && <small className="detected-stage">تم تحديد {departmentHint === "secondary" ? "المرحلة الثانوية" : "المرحلة المتوسطة"} تلقائيًا: {detectedDepartment.name}</small>}</label>',
  "department selector"
);

mustReplace(
  '    if (!effectiveDepartmentId) { setMessage("تعذر تحديد المرحلة من الشيت الأول. اختر متوسطة أو ثانوية من خانة القسم ثم اضغط الاستيراد."); return; }',
  '    if (!effectiveDepartmentId) { setMessage("تم اكتشاف المرحلة من الملف لكن تعذر ربطها بقسم المدرسة. أعد تحميل الصفحة ثم اختر الملف مرة أخرى."); return; }',
  "department validation message"
);

writeFileSync(path, src);
