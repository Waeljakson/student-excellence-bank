import {readFileSync,writeFileSync} from "node:fs";
const path="src/App.tsx";
let s=readFileSync(path,"utf8");
const start=s.indexOf("function StudentsView(");
const end=s.indexOf("function RankingsView(",start);
if(start<0||end<0)throw new Error("student-archive-control: StudentsView missing");
let block=s.slice(start,end);
if(!block.includes('const canDeleteStudent=roles.includes("SUPER_ADMIN");')){
  block=block.replace(
    '  const[activeClass,setActiveClass]=useState("ALL");\n  const canEditStudentClass=roles.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r));',
    "  const[activeClass,setActiveClass]=useState(\"ALL\");\n  const[deleteBusy,setDeleteBusy]=useState(\"\");\n  const[studentMsg,setStudentMsg]=useState(\"\");\n  const canEditStudentClass=roles.some(r=>[\"SUPER_ADMIN\",\"SCHOOL_ADMIN\",\"PRINCIPAL\",\"VICE_PRINCIPAL\",\"GUIDANCE_COUNSELOR\"].includes(r));\n  const canDeleteStudent=roles.includes(\"SUPER_ADMIN\");\n\n  async function archiveStudent(student:Student){\n    if(!canDeleteStudent||deleteBusy)return;\n    const ok=window.confirm(`هل تريد حذف الطالب «${student.name}» من قوائم النظام؟\\n\\nسيتم إيقاف حساب الطالب وإخفاؤه من بوابة الطالب وولي الأمر، مع الاحتفاظ بالشيكات والملاحظات والتقارير القديمة في السجل الإداري.`);\n    if(!ok)return;\n    setDeleteBusy(student.id);setStudentMsg(\"\");\n    try{\n      const result=await rpc<any>(\"api_archive_student\",{p_student_id:student.id});\n      if(!result?.deleted)throw new Error(result?.error||\"تعذر حذف الطالب.\");\n      setStudentMsg(`تم حذف الطالب ${student.name} من القوائم بنجاح مع الاحتفاظ بسجلاته السابقة.`);\n      await reload();\n    }catch(e){setStudentMsg(niceError(e))}finally{setDeleteBusy(\"\")}\n  }"
  );
}
if(!block.includes('{studentMsg&&<div className="notice">{studentMsg}</div>}')){
  block=block.replace(
    '    <section className="panel student-wallet-panel">\n      <div className="panel-title">',
    '    <section className="panel student-wallet-panel">\n      {studentMsg&&<div className="notice">{studentMsg}</div>}\n      <div className="panel-title">'
  );
}
block=block.replace('{canEditStudentClass&&<th>الإجراء</th>}','{(canEditStudentClass||canDeleteStudent)&&<th>الإجراء</th>}');
block=block.replace(
  '{canEditStudentClass&&<td><div className="student-row-actions"><StudentClassEditor student={s} onChanged={reload}/><StudentMobileEditor student={s}/><GuardianAccessLinkButton student={s}/></div></td>}',
  '{(canEditStudentClass||canDeleteStudent)&&<td><div className="student-row-actions">{canEditStudentClass&&<><StudentClassEditor student={s} onChanged={reload}/><StudentMobileEditor student={s}/><GuardianAccessLinkButton student={s}/></>}{canDeleteStudent&&<button type="button" className="student-delete-btn" disabled={deleteBusy===s.id} onClick={()=>archiveStudent(s)}>{deleteBusy===s.id?"جارٍ الحذف...":"حذف الطالب"}</button>}</div></td>}'
);
if(!block.includes("api_archive_student")||!block.includes("student-delete-btn"))throw new Error("student-archive-control: delete control missing");
s=s.slice(0,start)+block+s.slice(end);
writeFileSync(path,s);
console.log("student-archive-control: SUPER_ADMIN student archive control verified");
