import {readFileSync,writeFileSync} from "node:fs";
const path="src/StudentExcelImporter.tsx";
let s=readFileSync(path,"utf8");
if(!s.includes('student_mobile_guardian_v1')){
  s=s.replace('type ImportRow = { student_no: string; student_name: string; grade: string; class_name: string };','type ImportRow = { student_no: string; student_name: string; grade: string; class_name: string; mobile?: string }; // student_mobile_guardian_v1');
  s=s.replace('  created_classes: number;\n  errors?:','  created_classes: number;\n  guardian_links?: number;\n  errors?:');
  s=s.replace('type ColMap = { studentNo: number; studentName: number; grade: number; className: number };','type ColMap = { studentNo: number; studentName: number; grade: number; className: number; studentMobile: number };');
  s=s.replace('const EMPTY_MAP: ColMap = { studentNo: -1, studentName: -1, grade: -1, className: -1 };','const EMPTY_MAP: ColMap = { studentNo: -1, studentName: -1, grade: -1, className: -1, studentMobile: -1 };');
  s=s.replace('  className: ["الفصل", "رقم الفصل", "الشعبة", "class", "section"],','  className: ["الفصل", "رقم الفصل", "الشعبة", "class", "section"],\n  studentMobile: ["رقم جوال الطالب", "جوال الطالب", "رقم الجوال", "الجوال", "هاتف الطالب", "رقم الهاتف", "student mobile", "mobile", "phone"],');
  s=s.replace('function cleanClass(value: unknown) {','function cleanMobile(value: unknown) {\n  let v = latinDigits(text(value)).replace(/\\D/g, "");\n  if (v.startsWith("009665")) v = "0" + v.slice(4);\n  else if (v.startsWith("9665")) v = "0" + v.slice(3);\n  else if (v.length === 9 && v.startsWith("5")) v = "0" + v;\n  return v;\n}\nfunction cleanClass(value: unknown) {');
  s=s.replace('    created_classes: Number(r?.created_classes || 0),\n    errors:', '    created_classes: Number(r?.created_classes || 0),\n    guardian_links: Number(r?.guardian_links || 0),\n    errors:');
  s=s.replace('    if (!departmentName || Object.values(mapping).some(v => v < 0)) return { rows: [] as ImportRow[], invalid: 0, duplicates: 0 };','    const requiredMapped = mapping.studentNo >= 0 && mapping.studentName >= 0 && mapping.grade >= 0 && mapping.className >= 0;\n    if (!departmentName || !requiredMapped) return { rows: [] as ImportRow[], invalid: 0, duplicates: 0 };');
  s=s.replace('        class_name: cleanClass(row[mapping.className]),\n      };','        class_name: cleanClass(row[mapping.className]),\n        mobile: mapping.studentMobile >= 0 ? cleanMobile(row[mapping.studentMobile]) : "",\n      };');
  s=s.replace('const total: ImportResult = { inserted: 0, updated: 0, skipped: 0, created_grades: 0, created_classes: 0, errors: [] };','const total: ImportResult = { inserted: 0, updated: 0, skipped: 0, created_grades: 0, created_classes: 0, guardian_links: 0, errors: [] };');
  s=s.replace('        total.created_classes += r.created_classes;\n        total.errors?.push', '        total.created_classes += r.created_classes;\n        total.guardian_links = Number(total.guardian_links || 0) + Number(r.guardian_links || 0);\n        total.errors?.push');
  s=s.replace('setMessage(`تم استيراد الطلاب بنجاح: ${total.inserted} طالب جديد، وتحديث ${total.updated} طالب.`);','setMessage(`تم استيراد الطلاب بنجاح: ${total.inserted} طالب جديد، وتحديث ${total.updated} طالب، وربط ${Number(total.guardian_links || 0)} سجل بولي الأمر.`);');
  s=s.replace('["رقم الطالب", "اسم الطالب", "رقم الصف", "الفصل"],\n      ["10001", "اسم الطالب رباعي", "1030", "1"],','["رقم الطالب", "اسم الطالب", "رقم الصف", "الفصل", "رقم جوال الطالب"],\n      ["10001", "اسم الطالب رباعي", "1030", "1", "0500000000"],');
  s=s.replace('          ["className", "الفصل"],\n        ] as Array<[keyof ColMap, string]>','          ["className", "الفصل"],\n          ["studentMobile", "رقم جوال الطالب (دخول ولي الأمر)"],\n        ] as Array<[keyof ColMap, string]>');
  s=s.replace('<p>راجع أن الأعمدة الأربعة صحيحة قبل الضغط على الاستيراد.</p>','<p>راجع الأعمدة الأساسية. رقم جوال الطالب اختياري، وإذا وُجد سيتم استخدامه تلقائيًا لحساب ولي الأمر.</p>');
  s=s.replace('<div className="table-wrap"><table><thead><tr><th>رقم الطالب</th><th>اسم الطالب</th><th>الصف</th><th>الفصل</th></tr></thead><tbody>','<div className="table-wrap"><table><thead><tr><th>رقم الطالب</th><th>اسم الطالب</th><th>الصف</th><th>الفصل</th><th>رقم جوال الطالب / ولي الأمر</th></tr></thead><tbody>');
  s=s.replace('<td>{r.grade}</td><td>{r.class_name}</td></tr>','<td>{r.grade}</td><td>{r.class_name}</td><td>{r.mobile || "—"}</td></tr>');
  s=s.replace('<tr><td colSpan={4}>لا توجد أسماء جاهزة بعد. راجع مطابقة الأعمدة.</td></tr>','<tr><td colSpan={5}>لا توجد أسماء جاهزة بعد. راجع مطابقة الأعمدة.</td></tr>');
  s=s.replace('      <div><b>{result.created_classes}</b><span>فصول جديدة</span></div>','      <div><b>{result.created_classes}</b><span>فصول جديدة</span></div>\n      <div><b>{Number(result.guardian_links || 0)}</b><span>روابط ولي أمر</span></div>');
}
writeFileSync(path,s);
