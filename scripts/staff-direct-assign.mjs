import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let src = readFileSync(path, "utf8");
if (src.includes("staffAssignmentOpen")) process.exit(0);

function mustReplace(search, replacement, label) {
  if (!src.includes(search)) throw new Error(`staff-direct-assign: marker not found: ${label}`);
  src = src.replace(search, replacement);
}

mustReplace(
  'type StaffMember = { id: string; employee_no?: string | null; full_name_ar: string; nationality_ar?: string | null; job_title_ar: string; specialty_ar?: string | null; teaching_subject_ar?: string | null; mobile?: string | null; linked_app_user_id?: string | null; linked: boolean };',
  'type StaffMember = { id: string; employee_no?: string | null; full_name_ar: string; nationality_ar?: string | null; job_title_ar: string; specialty_ar?: string | null; teaching_subject_ar?: string | null; mobile?: string | null; linked_app_user_id?: string | null; linked: boolean; assigned_class_ids: string[]; assigned_classes: string[] };',
  "staff type"
);

mustReplace(
  'const[editing,setEditing]=useState<string>("");const[editStaff,setEditStaff]=useState("");const[editClasses,setEditClasses]=useState<string[]>([]);',
  'const[editing,setEditing]=useState<string>("");const[editStaff,setEditStaff]=useState("");const[editClasses,setEditClasses]=useState<string[]>([]);const[staffAssignmentOpen,setStaffAssignmentOpen]=useState("");const[staffAssignmentClasses,setStaffAssignmentClasses]=useState<string[]>([]);',
  "staff assignment state"
);

mustReplace(
  'function toggleEdit(cid:string){setEditClasses(a=>a.includes(cid)?a.filter(x=>x!==cid):[...a,cid])}',
  'function toggleEdit(cid:string){setEditClasses(a=>a.includes(cid)?a.filter(x=>x!==cid):[...a,cid])}\n  function openStaffAssignment(s:StaffMember){setStaffAssignmentOpen(s.id);setStaffAssignmentClasses(s.assigned_class_ids||[]);setMsg("")}\n  function toggleStaffAssignment(cid:string){setStaffAssignmentClasses(a=>a.includes(cid)?a.filter(x=>x!==cid):[...a,cid])}\n  async function saveStaffAssignment(){const s=staff.find(x=>x.id===staffAssignmentOpen);if(!s)return;if(!staffAssignmentClasses.length){setMsg("اختر فصلًا واحدًا على الأقل للمعلم.");return}setBusy(staffAssignmentOpen);try{await rpc("api_set_staff_classes",{p_staff_id:staffAssignmentOpen,p_class_ids:staffAssignmentClasses});setMsg("تم تسكين "+s.full_name_ar+" على الفصول المحددة. طلاب هذه الفصول أصبحوا نطاقه عند ربط حسابه.");setStaffAssignmentOpen("");await reload()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}',
  "staff assignment actions"
);

mustReplace(
  '<section className="panel"><div className="panel-title"><div><h3>دليل الهيئة التعليمية والإدارية</h3><p>تم استيراده من ملف الهيئة 1448 هـ.</p></div><span className="counter">{staff.length}</span></div><div className="staff-grid">{staff.map(s=><article className={s.linked?"staff-card linked":"staff-card"} key={s.id}><div><b>{s.full_name_ar}</b><span>{s.job_title_ar}</span></div><small>{s.specialty_ar||s.teaching_subject_ar||"—"}</small><em>{s.linked?"مرتبط بحساب":"غير مرتبط"}</em></article>)}</div></section>',
  '<section className="panel"><div className="panel-title"><div><h3>دليل الهيئة التعليمية والإدارية</h3><p>من هنا يتم تسكين المعلمين على الفصول مباشرة حتى قبل إنشاء حساباتهم.</p></div><span className="counter">{staff.length}</span></div><div className="staff-grid">{staff.map(s=><article className={s.linked?"staff-card linked":"staff-card"} key={s.id}><div><b>{s.full_name_ar}</b><span>{s.job_title_ar}</span></div>{s.job_title_ar==="معلم"?<small>{s.specialty_ar||s.teaching_subject_ar||"معلم"}</small>:<small>{s.job_title_ar}</small>}{s.job_title_ar==="معلم"&&<div className="staff-assigned-classes"><b>الفصول:</b><span>{s.assigned_classes?.length?s.assigned_classes.join("، "):"لم يتم التسكين بعد"}</span></div>}<em>{s.linked?"مرتبط بحساب":"غير مرتبط"}</em>{s.job_title_ar==="معلم"&&<button className="mini-btn" onClick={()=>openStaffAssignment(s)}>تسكين الفصول</button>}</article>)}</div></section>{staffAssignmentOpen&&<section className="panel scope-editor"><div className="panel-title"><div><h3>تسكين المعلم على الفصول</h3><p>{staff.find(s=>s.id===staffAssignmentOpen)?.full_name_ar}</p></div><button className="mini-btn" onClick={()=>setStaffAssignmentOpen("")}>إغلاق</button></div><div className="class-picker"><b>اختر فصلًا أو أكثر</b><p>بعد الحفظ سيُربط المعلم بهذه الفصول وطلابها عند إنشاء حسابه أو ربطه لاحقًا.</p><div>{classes.map(c=><label key={c.id} className={staffAssignmentClasses.includes(c.id)?"class-check active":"class-check"}><input type="checkbox" checked={staffAssignmentClasses.includes(c.id)} onChange={()=>toggleStaffAssignment(c.id)}/><span>{c.grade_name}<small>فصل {c.class_name}</small></span></label>)}</div></div><button className="btn primary" disabled={busy===staffAssignmentOpen||!staffAssignmentClasses.length} onClick={saveStaffAssignment}>{busy===staffAssignmentOpen?"جارٍ الحفظ...":"حفظ تسكين المعلم"}</button></section>}',
  "staff directory panel"
);

writeFileSync(path, src);
