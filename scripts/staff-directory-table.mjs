import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let src = readFileSync(path, "utf8");

if (!src.includes('import StaffDirectoryTable from "./StaffDirectoryTable";')) {
  const marker = 'import AddTeacherPanel from "./AddTeacherPanel";';
  if (!src.includes(marker)) throw new Error("staff-directory-table: import marker not found");
  src = src.replace(marker, marker + '\nimport StaffDirectoryTable from "./StaffDirectoryTable";');
}

if (!src.includes('<StaffDirectoryTable staff={staff}/>')) {
  const marker = '<section className="panel"><div className="panel-title"><div><h3>دليل الهيئة التعليمية والإدارية</h3>';
  if (!src.includes(marker)) throw new Error("staff-directory-table: directory marker not found");
  src = src.replace(marker, '<StaffDirectoryTable staff={staff}/>' + marker);
}

writeFileSync(path, src);
