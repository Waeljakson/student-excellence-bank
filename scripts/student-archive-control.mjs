import {readFileSync,writeFileSync} from "node:fs";
const path="src/App.tsx";
let s=readFileSync(path,"utf8");
const start=s.indexOf("function StudentsView(");
const end=s.indexOf("function RankingsView(",start);
if(start<0||end<0)throw new Error("student-archive-control: StudentsView missing");
let block=s.slice(start,end);

if(!block.includes('const canDeleteStudent=roles.includes("SUPER_ADMIN");')){
  block=block.replace(
    '  const[activeClass,setActiveClass]=useState("ALL");',
    '  const[activeClass,setActiveClass]=useState("ALL");\n  const[deleteBusy,setDeleteBusy]=useState("");\n  const[studentMsg,setStudentMsg]=useState("");'
  );
  block=block.replace(
    '  const canEditStudentClass=roles.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r));',
    '  const canEditStudentClass=roles.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r));\n  const canDeleteStudent=roles.includes("SUPER_ADMIN");'
  );
}

const hardDeleteFn="  async function archiveStudent(student:Student){\n    if(!canDeleteStudent||deleteBusy)return;\n    const ok=window.confirm(`تحذير: سيتم حذف الطالب «${student.name}» نهائيًا من قاعدة البيانات.\\n\\nسيتم حذف حسابه وشيكاته وملاحظاته وتقييماته وإحالاته وحركات محفظته والبيانات المرتبطة به، ولا يمكن التراجع عن العملية.\\n\\nهل تريد الاستمرار؟`);\n    if(!ok)return;\n    const finalOk=window.confirm(`تأكيد أخير لحذف «${student.name}» نهائيًا. هذه العملية غير قابلة للاسترجاع.\\n\\nاضغط «موافق» لتنفيذ الحذف النهائي.`);\n    if(!finalOk)return;\n    setDeleteBusy(student.id);setStudentMsg(\"\");\n    try{\n      const result=await rpc<any>(\"api_archive_student\",{p_student_id:student.id});\n      if(!result?.deleted||result?.permanent!==true)throw new Error(result?.error||\"تعذر حذف الطالب نهائيًا.\");\n      setStudentMsg(`تم حذف الطالب ${student.name} نهائيًا من قاعدة البيانات.`);\n      await reload();\n    }catch(e){setStudentMsg(niceError(e))}finally{setDeleteBusy(\"\")}\n  }";
if(/  async function archiveStudent\(student:Student\)\{[\s\S]*?\n  \}/.test(block)){
  block=block.replace(/  async function archiveStudent\(student:Student\)\{[\s\S]*?\n  \}/,hardDeleteFn);
}else{
  const anchor='  const canDeleteStudent=roles.includes("SUPER_ADMIN");';
  if(!block.includes(anchor))throw new Error("student-archive-control: delete permission anchor missing");
  block=block.replace(anchor,anchor+"\n\n"+hardDeleteFn);
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
  '{(canEditStudentClass||canDeleteStudent)&&<td><div className="student-row-actions">{canEditStudentClass&&<><StudentClassEditor student={s} onChanged={reload}/><StudentMobileEditor student={s}/><GuardianAccessLinkButton student={s}/></>}{canDeleteStudent&&<button type="button" className="student-delete-btn" disabled={deleteBusy===s.id} onClick={()=>archiveStudent(s)}>{deleteBusy===s.id?"جارٍ الحذف...":"حذف الطالب نهائيًا"}</button>}</div></td>}'
);
block=block.replace(/"حذف الطالب"/g,'"حذف الطالب نهائيًا"');

if(!block.includes("api_archive_student")||!block.includes("result?.permanent!==true")||!block.includes("غير قابلة للاسترجاع")){
  throw new Error("student-archive-control: permanent deletion behavior missing");
}
s=s.slice(0,start)+block+s.slice(end);
writeFileSync(path,s);
console.log("student-archive-control: permanent SUPER_ADMIN student deletion verified");
