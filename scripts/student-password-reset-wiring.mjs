import {readFileSync,writeFileSync} from "node:fs";

const path="src/App.tsx";
let s=readFileSync(path,"utf8");

if(!s.includes('import StudentPasswordResetButton from "./StudentPasswordResetButton";')){
  const anchors=[
    'import GuardianAccessLinkButton from "./GuardianAccessLinkButton";',
    'import StudentMobileEditor from "./StudentMobileEditor";',
    'import StudentClassEditor from "./StudentClassEditor";'
  ];
  const anchor=anchors.find(x=>s.includes(x));
  if(!anchor)throw new Error("student-password-reset-wiring: import anchor missing");
  s=s.replace(anchor,anchor+'\nimport StudentPasswordResetButton from "./StudentPasswordResetButton";');
}

const start=s.indexOf("function StudentsView(");
const end=s.indexOf("function RankingsView(",start);
if(start<0||end<0)throw new Error("student-password-reset-wiring: StudentsView block missing");
let block=s.slice(start,end);

if(!block.includes("const canResetStudentPassword=")){
  const anchor='  const canAddStudent=roles.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL"].includes(r));';
  if(!block.includes(anchor))throw new Error("student-password-reset-wiring: permission anchor missing");
  block=block.replace(
    anchor,
    anchor+'\n  const canResetStudentPassword=roles.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r));'
  );
}

block=block.replace(
  '{(canEditStudentClass||canDeleteStudent)&&<th>الإجراء</th>}',
  '{(canEditStudentClass||canDeleteStudent||canResetStudentPassword)&&<th>الإجراء</th>}'
);

block=block.replace(
  '{(canEditStudentClass||canDeleteStudent)&&<td><div className="student-row-actions">',
  '{(canEditStudentClass||canDeleteStudent||canResetStudentPassword)&&<td><div className="student-row-actions">'
);

if(!block.includes('<StudentPasswordResetButton student={s}/>')){
  const anchor='<GuardianAccessLinkButton student={s}/>';
  if(block.includes(anchor)){
    block=block.replace(anchor,anchor+'{canResetStudentPassword&&<StudentPasswordResetButton student={s}/>}');
  }else{
    const fallback='{canDeleteStudent&&<button type="button" className="student-delete-btn"';
    if(!block.includes(fallback))throw new Error("student-password-reset-wiring: action anchor missing");
    block=block.replace(fallback,'{canResetStudentPassword&&<StudentPasswordResetButton student={s}/>}'+fallback);
  }
}

s=s.slice(0,start)+block+s.slice(end);
writeFileSync(path,s);
