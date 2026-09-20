import { readFileSync, writeFileSync } from "node:fs";

const path="src/App.tsx";
let src=readFileSync(path,"utf8");

if(!src.includes('import StudentClassEditor from "./StudentClassEditor";')){
  const marker='import StaffDirectoryTable from "./StaffDirectoryTable";';
  if(!src.includes(marker)) throw new Error("student-class-edit: import marker missing");
  src=src.replace(marker,marker+'\nimport StudentClassEditor from "./StudentClassEditor";');
}

const oldSig='function StudentsView({students}:{students:Student[]}){';
const newSig='function StudentsView({students,roles,reload}:{students:Student[];roles:string[];reload:()=>Promise<void>}){';
if(src.includes(oldSig)) src=src.replace(oldSig,newSig);
else if(!src.includes('function StudentsView({students,roles,reload}')) throw new Error("student-class-edit: StudentsView signature missing");

if(!src.includes('const canEditStudentClass=roles.some')){
  const marker='  const[activeClass,setActiveClass]=useState("ALL");';
  if(!src.includes(marker)) throw new Error("student-class-edit: activeClass marker missing");
  src=src.replace(marker,marker+'\n  const canEditStudentClass=roles.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r));');
}

const oldHead='<th>القيمة</th></tr>';
const newHead='<th>القيمة</th>{canEditStudentClass&&<th>الإجراء</th>}</tr>';
if(src.includes(oldHead)) src=src.replace(oldHead,newHead);
else if(!src.includes('{canEditStudentClass&&<th>الإجراء</th>}')) throw new Error("student-class-edit: table header marker missing");

const oldTail='<td>{Number(s.value_sar).toLocaleString("ar-SA")} ر.س</td></tr>';
const newTail='<td>{Number(s.value_sar).toLocaleString("ar-SA")} ر.س</td>{canEditStudentClass&&<td><StudentClassEditor student={s} onChanged={reload}/></td>}</tr>';
if(src.includes(oldTail)) src=src.replace(oldTail,newTail);
else if(!src.includes('<StudentClassEditor student={s} onChanged={reload}/>')) throw new Error("student-class-edit: row marker missing");

const oldCall='<StudentsView students={students}/>';
const loadAllCall='<StudentsView students={students} roles={profile.roles||[]} reload={loadAll}/>';
const cachedCall='<StudentsView students={students} roles={profile.roles||[]} reload={refreshStudents}/>';
const cachedDeleteCall='<StudentsView students={students} roles={profile.roles||[]} reload={refreshStudents} onDeleted={removeStudentLocally}/>';
if(src.includes(oldCall)) src=src.replace(oldCall,loadAllCall);
else if(!src.includes(loadAllCall)&&!src.includes(cachedCall)&&!src.includes(cachedDeleteCall)) throw new Error("student-class-edit: call marker missing");

writeFileSync(path,src);
