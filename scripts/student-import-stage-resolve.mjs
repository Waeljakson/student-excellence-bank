import { readFileSync, writeFileSync } from "node:fs";

const path = "src/StudentExcelImporter.tsx";
let src = readFileSync(path, "utf8");
if (src.includes("IMPORT_STAGE_RESOLVE_V5")) process.exit(0);

const start = `async function importStudents() {\n    if (!book) { setMessage("اختر ملف Excel أولًا."); return; }`;
const replacement = `async function importStudents() {\n    // IMPORT_STAGE_RESOLVE_V5\n    let importDepartmentId = effectiveDepartmentId;\n    if (!importDepartmentId && departmentHint) {\n      try {\n        const freshOptions = await rpc<ImportOptions>("api_student_import_options");\n        setOptions(freshOptions);\n        const resolved = freshOptions.departments.find(d => departmentHint === "secondary" ? /ثان/.test(d.name) : /متوسط/.test(d.name));\n        if (resolved) {\n          importDepartmentId = resolved.id;\n          setDepartmentId(resolved.id);\n        }\n      } catch {}\n    }\n    if (!book) { setMessage("اختر ملف Excel أولًا."); return; }`;
if (!src.includes(start)) throw new Error("student-import-stage-resolve: import start marker not found");
src = src.replace(start, replacement);

src = src.replace(
  '    if (!effectiveDepartmentId) { setMessage("تم اكتشاف المرحلة من الملف لكن تعذر ربطها بقسم المدرسة. أعد تحميل الصفحة ثم اختر الملف مرة أخرى."); return; }',
  '    if (!importDepartmentId) { setMessage("تم اكتشاف المرحلة من الملف لكن تعذر العثور على القسم المقابل في إعدادات المدرسة."); return; }'
);

src = src.replace(/p_department_id: effectiveDepartmentId/g, "p_department_id: importDepartmentId");
writeFileSync(path, src);
