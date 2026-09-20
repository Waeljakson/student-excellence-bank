import {readFileSync,writeFileSync} from "node:fs";
const path="src/App.tsx";
let s=readFileSync(path,"utf8");
const importAnchor='import StudentClassEditor from "./StudentClassEditor";';
if(!s.includes('import StudentAddModal from "./StudentAddModal";')){
  if(!s.includes(importAnchor))throw new Error("student-add-control: import anchor missing");
  s=s.replace(importAnchor,importAnchor+'\nimport StudentAddModal from "./StudentAddModal";');
}
if(!s.includes("const canAddStudent=")){
  const anchor='  const canDeleteStudent=roles.includes("SUPER_ADMIN");';
  if(!s.includes(anchor))throw new Error("student-add-control: role anchor missing");
  s=s.replace(anchor,anchor+'\n  const canAddStudent=roles.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL"].includes(r));');
}
const oldPanel="      <div className=\"panel-title\"><div><h3>محافظ الطلاب</h3><p>{selected?selected.grade_name+\" — فصل \"+selected.class_name:\"جميع الطلاب\"} · {scoped.length} طالب</p></div><input className=\"search\" value={q} onChange={e=>setQ(e.target.value)} placeholder=\"ابحث داخل القائمة...\"/></div>";
const newPanel="      <div className=\"panel-title\"><div><h3>محافظ الطلاب</h3><p>{selected?selected.grade_name+\" — فصل \"+selected.class_name:\"جميع الطلاب\"} · {scoped.length} طالب</p></div><div className=\"student-panel-tools\">{canAddStudent&&<StudentAddModal onAdded={reload}/>}<input className=\"search\" value={q} onChange={e=>setQ(e.target.value)} placeholder=\"ابحث داخل القائمة...\"/></div></div>";
if(s.includes(oldPanel))s=s.replace(oldPanel,newPanel);
if(!s.includes("<StudentAddModal onAdded={reload}/>")||!s.includes("canAddStudent")){
  throw new Error("student-add-control: add student UI missing");
}
writeFileSync(path,s);
console.log("student-add-control: manual full student form verified");
