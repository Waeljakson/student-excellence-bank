import { readFileSync, writeFileSync } from "node:fs";

const clientPath = "src/client.ts";
let client = readFileSync(clientPath, "utf8");
const errLine = '  if (message.includes("EVALUATION_REQUEST_REASSIGNED")) return "تم نقل الطالب إلى فصل آخر، وتم تحويل طلب التقييم إلى معلمي فصله الحالي. حدّث الصفحة.";\n';
if (!client.includes('EVALUATION_REQUEST_REASSIGNED')) {
  const marker = '  if (message.includes("TEACHER_REQUIRED")) return "هذه العملية متاحة للمعلم فقط.";\n';
  if (!client.includes(marker)) throw new Error("evaluation-class-sync-ui: client marker missing");
  client = client.replace(marker, marker + errLine);
  writeFileSync(clientPath, client);
}

const editorPath = "src/StudentClassEditor.tsx";
let editor = readFileSync(editorPath, "utf8");
const oldAlert = '      window.alert(`تم تعديل فصل ${student.name} من ${student.class_name} إلى ${result?.class_name||"الفصل الجديد"}.`);';
const newAlert = '      const syncNote=Number(result?.evaluation_reports_synced||0)>0?`\\nتم كذلك تحديث ${result.evaluation_reports_synced} تقرير تقييم مفتوح وتحويل الطلبات المعلقة إلى معلمي الفصل الجديد.`:"";\n      window.alert(`تم تعديل فصل ${student.name} من ${student.class_name} إلى ${result?.class_name||"الفصل الجديد"}.${syncNote}`);';
if (!editor.includes('evaluation_reports_synced')) {
  if (!editor.includes(oldAlert)) throw new Error("evaluation-class-sync-ui: editor marker missing");
  editor = editor.replace(oldAlert, newAlert);
  writeFileSync(editorPath, editor);
}
