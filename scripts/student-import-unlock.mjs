import { readFileSync, writeFileSync } from "node:fs";

const path = "src/StudentExcelImporter.tsx";
let src = readFileSync(path, "utf8");
if (src.includes("IMPORT_BUTTON_UNLOCK_V3")) process.exit(0);

src = src.replace(
  /const departmentName = options\?\.departments\.find\(d => d\.id === departmentId\)\?\.name \|\| "";/,
  'const departmentName = options?.departments.find(d => d.id === departmentId)?.name || (departmentHint === "secondary" ? "ثانوية" : departmentHint === "middle" ? "متوسطة" : ""); // IMPORT_BUTTON_UNLOCK_V3'
);

src = src.replace(
  /const mappingReady = departmentId && Object\.values\(mapping\)\.every\(v => v >= 0\) && prepared\.rows\.length > 0;/,
  'const mappingReady = Object.values(mapping).every(v => v >= 0) && prepared.rows.length > 0;'
);

src = src.replace(
  /async function importStudents\(\) \{\n\s*if \(!mappingReady\) return;\n\s*setBusy\(true\); setMessage\(""\); setResult\(null\);/,
  `async function importStudents() {
    const effectiveDepartmentId = departmentId || options?.departments.find(d => departmentHint === "secondary" ? d.name.includes("ثان") : departmentHint === "middle" ? d.name.includes("متوسط") : false)?.id || "";
    if (!book) { setMessage("اختر ملف Excel أولًا."); return; }
    const missing: string[] = [];
    if (mapping.studentNo < 0) missing.push("رقم الطالب");
    if (mapping.studentName < 0) missing.push("اسم الطالب");
    if (mapping.grade < 0) missing.push("الصف / رقم الصف");
    if (mapping.className < 0) missing.push("الفصل");
    if (missing.length) { setMessage("تعذر تحديد الأعمدة التالية تلقائيًا: " + missing.join("، ") + ". اخترها من مطابقة الأعمدة ثم اضغط الاستيراد."); return; }
    if (!prepared.rows.length) { setMessage("لم يتم العثور على صفوف طلاب صالحة في الشيت المحدد. تأكد أن شيت الطلاب هو المختار وأن صف العناوين صحيح."); return; }
    if (!effectiveDepartmentId) { setMessage("تعذر تحديد المرحلة من الشيت الأول. اختر متوسطة أو ثانوية من خانة القسم ثم اضغط الاستيراد."); return; }
    setBusy(true); setMessage(""); setResult(null);`
);

src = src.replace(/p_department_id: departmentId/g, "p_department_id: effectiveDepartmentId");
src = src.replace(/disabled=\{busy \|\| !mappingReady\}/g, "disabled={busy || !book}");

writeFileSync(path, src);
