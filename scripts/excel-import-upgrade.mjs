import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let src = readFileSync(path, "utf8");
if (src.includes('import StudentExcelImporter from "./StudentExcelImporter"')) process.exit(0);

const importMarker = 'import { neon, niceError, rpc } from "./client";';
if (!src.includes(importMarker)) throw new Error("excel-import-upgrade: client import marker not found");
src = src.replace(importMarker, importMarker + '\nimport StudentExcelImporter from "./StudentExcelImporter";');

const panelMarker = '    <section className="panel"><div className="panel-title"><div><h3>طلبات اعتماد حسابات جديدة</h3>';
const at = src.indexOf(panelMarker);
if (at < 0) throw new Error("excel-import-upgrade: admin panel marker not found");
src = src.slice(0, at) + '    <StudentExcelImporter onImported={reload}/>\n' + src.slice(at);

writeFileSync(path, src);
