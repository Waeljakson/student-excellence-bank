import { readFileSync, writeFileSync } from "node:fs";

const path = "src/StudentExcelImporter.tsx";
let src = readFileSync(path, "utf8");
if (src.includes("IMPORT_DEPARTMENT_FALLBACK_V6")) process.exit(0);

const typeMarker = 'type Department = { id: string; name: string };';
if (!src.includes(typeMarker)) throw new Error("department-fallback: Department type marker not found");
src = src.replace(typeMarker, `${typeMarker}\n\n// IMPORT_DEPARTMENT_FALLBACK_V6\nconst MISHKAT_DEPARTMENTS: Department[] = [\n  { id: "bd67db56-4910-440e-b78a-ea23c4d12998", name: "متوسطة مشكاة الشعلة" },\n  { id: "d7fe2e14-9943-4d1b-bdb8-084108579e79", name: "ثانوية مشكاة الشعلة" },\n];`);

// Always expose the two school departments even if the options RPC is late/empty.
const deptNameMarker = '  const detectedDepartment = options?.departments.find(d =>';
if (!src.includes(deptNameMarker)) throw new Error("department-fallback: detectedDepartment marker not found");
src = src.replace(
  deptNameMarker,
  '  const availableDepartments = options?.departments?.length ? options.departments : MISHKAT_DEPARTMENTS;\n  const detectedDepartment = availableDepartments.find(d =>'
);

src = src.replace(
  /\{options\?\.departments\.map\(d => <option value=\{d\.id\} key=\{d\.id\}>\{d\.name\}<\/option>\)\}/g,
  '{availableDepartments.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}'
);

// When a file stage is detected, immediately select the matching known department.
const setHintMarker = '      setDepartmentHint(kind);';
if (src.includes(setHintMarker)) {
  src = src.replace(setHintMarker, `${setHintMarker}\n      if (kind) {\n        const autoDepartment = (options?.departments?.length ? options.departments : MISHKAT_DEPARTMENTS).find(d =>\n          kind === "secondary" ? /ثان/.test(d.name) : /متوسط/.test(d.name)\n        );\n        if (autoDepartment) setDepartmentId(autoDepartment.id);\n      }`);
}

// Resolve against fallback list during import as well.
src = src.replace(
  /let resolvedDepartmentId = effectiveDepartmentId;/,
  'let resolvedDepartmentId = effectiveDepartmentId || (departmentHint ? MISHKAT_DEPARTMENTS.find(d => departmentHint === "secondary" ? /ثان/.test(d.name) : /متوسط/.test(d.name))?.id || "" : "");'
);

writeFileSync(path, src);
