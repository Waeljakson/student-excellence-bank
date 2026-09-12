import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let src = readFileSync(path, "utf8");
if (src.includes("type StaffMember =")) process.exit(0);

function mustReplace(search, replacement, label) {
  if (!src.includes(search)) throw new Error(`scope-upgrade: marker not found: ${label}`);
  src = src.replace(search, replacement);
}

mustReplace(
  'type ManagedUser = { id: string; auth_user_id: string; name: string; email: string; is_active: boolean; roles: string[]; monthly_limit: number | null; is_unlimited: boolean };',
  `type ManagedUser = { id: string; auth_user_id: string; name: string; email: string; is_active: boolean; roles: string[]; monthly_limit: number | null; is_unlimited: boolean; staff_id?: string | null; job_title_ar?: string | null; assigned_class_ids: string[]; assigned_classes: string[] };
type StaffMember = { id: string; employee_no?: string | null; full_name_ar: string; nationality_ar?: string | null; job_title_ar: string; specialty_ar?: string | null; teaching_subject_ar?: string | null; mobile?: string | null; linked_app_user_id?: string | null; linked: boolean };
type AdminClass = { id: string; grade_name: string; class_name: string };`,
  "admin types"
);

mustReplace(
  'type KhameesnaBoard = { week_start: string; week_end: string; status: "IN_PROGRESS" | "THURSDAY" | "CLOSED"; reward: string; max_points: number; leader_count: number; standings: KhameesnaStanding[]; recent: KhameesnaRecent[]; history: KhameesnaHistory[] };',
  'type KhameesnaBoard = { week_start: string; week_end: string; status: "IN_PROGRESS" | "THURSDAY" | "CLOSED"; reward: string; max_points: number; leader_count: number; allowed_classes: Array<{class_id:string;grade_name:string;class_name:string}>; standings: KhameesnaStanding[]; recent: KhameesnaRecent[]; history: KhameesnaHistory[] };',
  "khameesna allowed classes"
);

mustReplace(
  'data.standings.map(c=><option key={c.class_id} value={c.class_id}>{c.grade_name} — فصل {c.class_name}</option>)',
  'data.allowed_classes.map(c=><option key={c.class_id} value={c.class_id}>{c.grade_name} — فصل {c.class_name}</option>)',
  "khameesna class selector"
);

const adminStart = src.indexOf("function AdminView(");
const bankStart = src.indexOf("function BankApp(", adminStart);
if (adminStart < 0 || bankStart < 0) throw new Error("scope-upgrade: AdminView block not found");

const adminComponent = `function AdminView({pending,users,staff,classes,reload}:{pending:PendingUser[];users:ManagedUser[];staff:StaffMember[];classes:AdminClass[];reload:()=>Promise<void>}){
  const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");
  const[draftStaff,setDraftStaff]=useState<Record<string,string>>({});
  const[draftClasses,setDraftClasses]=useState<Record<string,string[]>>({});
  const[draftLimit,setDraftLimit]=useState<Record<string,string>>({});
  const[editing,setEditing]=useState<string>("");const[editStaff,setEditStaff]=useState("");const[editClasses,setEditClasses]=useState<string[]>([]);
  const roleLabel=(r:string)=>({SUPER_ADMIN:"مدير النظام",SCHOOL_ADMIN:"إدارة المدرسة",PRINCIPAL:"مدير المدرسة",VICE_PRINCIPAL:"وكيل المدرسة",GUIDANCE_COUNSELOR:"موجه طلابي",TEACHER:"معلم"} as Record<string,string>)[r]||r;
  const selectedStaff=(id:string)=>staff.find(s=>s.id===id);
  function togglePending(uid:string,cid:string){setDraftClasses(v=>{const a=v[uid]||[];return {...v,[uid]:a.includes(cid)?a.filter(x=>x!==cid):[...a,cid]}})}
  function toggleEdit(cid:string){setEditClasses(a=>a.includes(cid)?a.filter(x=>x!==cid):[...a,cid])}
  async function approve(u:PendingUser){const sid=draftStaff[u.auth_user_id];const member=selectedStaff(sid);const cids=draftClasses[u.auth_user_id]||[];if(!member){setMsg("اختر اسم الموظف من قائمة الهيئة أولًا.");return}if(member.job_title_ar==="معلم"&&!cids.length){setMsg("يجب تسكين المعلم في فصل واحد على الأقل قبل الاعتماد.");return}setBusy(u.auth_user_id);setMsg("");try{await rpc("api_approve_teacher_scoped",{p_auth_user_id:u.auth_user_id,p_staff_id:sid,p_monthly_limit:Number(draftLimit[u.auth_user_id]||100),p_class_ids:cids});setMsg("تم اعتماد وربط "+member.full_name_ar+" وتطبيق نطاق الفصول.");setDraftStaff(v=>({...v,[u.auth_user_id]:""}));setDraftClasses(v=>({...v,[u.auth_user_id]:[]}));await reload()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  async function budget(u:ManagedUser){const raw=window.prompt("الحد الشهري الجديد لـ "+u.name,String(u.monthly_limit||100));if(!raw)return;try{await rpc("api_set_teacher_budget",{p_app_user_id:u.id,p_monthly_limit:Number(raw),p_unlimited:false});setMsg("تم تحديث حد الإصدار.");await reload()}catch(e){setMsg(niceError(e))}}
  function startEdit(u:ManagedUser){setEditing(u.id);setEditStaff(u.staff_id||"");setEditClasses(u.assigned_class_ids||[]);setMsg("")}
  async function saveScope(){const u=users.find(x=>x.id===editing);const member=selectedStaff(editStaff);if(!u||!member)return;if(member.job_title_ar==="معلم"&&!editClasses.length){setMsg("يجب تسكين المعلم في فصل واحد على الأقل.");return}setBusy(editing);try{await rpc("api_set_user_scope",{p_app_user_id:editing,p_staff_id:editStaff,p_class_ids:editClasses});setMsg("تم حفظ وظيفة وفصول "+member.full_name_ar+".");setEditing("");await reload()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  const freeStaff=staff.filter(s=>!s.linked);
  return <><Header title="الهيئة والصلاحيات" subtitle="ربط حساب الموظف بوظيفته وتحديد الفصول التي يستطيع التعامل معها"/><main className="content">
    <section className="permission-policy"><div><b>صلاحية المعلم مقيدة بالفصول</b><span>يرى طلاب فصوله فقط، ويصدر لهم فقط، ويضيف خميسنا غير لفصوله فقط.</span></div><div><b>خميسنا غير: مرة واحدة يوميًا</b><span>لا يستطيع نفس المعلم إضافة نقاط لنفس الفصل أكثر من مرة في اليوم.</span></div><div><b>الشيك العملاق</b><span>متاح فقط لمن تم ربطه وظيفيًا كمدير مدرسة أو وكيل مدرسة أو موجه طلابي.</span></div></section>
    <section className="panel"><div className="panel-title"><div><h3>طلبات اعتماد حسابات جديدة</h3><p>اربط الحساب بالاسم الرسمي من ملف الهيئة ثم حدد الفصول.</p></div><span className="counter">{pending.length}</span></div>{pending.length?<div className="approval-list">{pending.map(u=>{const sid=draftStaff[u.auth_user_id]||"";const member=selectedStaff(sid);const cids=draftClasses[u.auth_user_id]||[];return <article className="approval-card" key={u.auth_user_id}><div className="approval-head"><div><b>{u.name||"مستخدم جديد"}</b><small>{u.email}</small></div><span>بانتظار الاعتماد</span></div><div className="approval-fields"><label>الاسم من قائمة الهيئة<select value={sid} onChange={e=>setDraftStaff(v=>({...v,[u.auth_user_id]:e.target.value}))}><option value="">اختر الموظف</option>{freeStaff.map(s=><option key={s.id} value={s.id}>{s.full_name_ar} — {s.job_title_ar}{s.specialty_ar?" — "+s.specialty_ar:""}</option>)}</select></label><label>الحد الشهري<input type="number" min="1" value={draftLimit[u.auth_user_id]||"100"} onChange={e=>setDraftLimit(v=>({...v,[u.auth_user_id]:e.target.value}))}/></label></div>{member?.job_title_ar==="معلم"&&<div className="class-picker"><b>تسكين المعلم في الفصول</b><div>{classes.map(c=><label key={c.id} className={cids.includes(c.id)?"class-check active":"class-check"}><input type="checkbox" checked={cids.includes(c.id)} onChange={()=>togglePending(u.auth_user_id,c.id)}/><span>{c.grade_name}<small>فصل {c.class_name}</small></span></label>)}</div></div>}<button className="btn primary" disabled={busy===u.auth_user_id||!sid} onClick={()=>approve(u)}>{busy===u.auth_user_id?"جارٍ الاعتماد...":"اعتماد وربط الصلاحية"}</button></article>})}</div>:<Empty text="لا توجد طلبات حسابات جديدة."/>}</section>
    <section className="panel"><div className="panel-title"><div><h3>المستخدمون المعتمدون</h3><p>يمكن تعديل ربط الموظف والفصول في أي وقت.</p></div><span className="counter">{users.length}</span></div><div className="table-wrap"><table><thead><tr><th>المستخدم</th><th>الوظيفة الرسمية</th><th>الصلاحيات</th><th>الفصول المسندة</th><th>حد الإصدار</th><th></th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><b>{u.name}</b><small className="table-sub">{u.email}</small></td><td>{u.job_title_ar||<span className="muted">غير مربوط بالهيئة</span>}</td><td>{u.roles.map(roleLabel).join("، ")}</td><td>{u.assigned_classes?.length?u.assigned_classes.join("، "):"—"}</td><td>{u.is_unlimited?"غير محدود":u.monthly_limit??"—"}</td><td><div className="row-actions"><button className="mini-btn" onClick={()=>startEdit(u)}>إدارة الوظيفة والفصول</button>{u.roles.includes("TEACHER")&&<button className="mini-btn" onClick={()=>budget(u)}>تعديل الحد</button>}</div></td></tr>)}</tbody></table></div></section>
    {editing&&<section className="panel scope-editor"><div className="panel-title"><div><h3>تعديل نطاق المستخدم</h3><p>{users.find(u=>u.id===editing)?.email}</p></div><button className="mini-btn" onClick={()=>setEditing("")}>إغلاق</button></div><label className="scope-label">الاسم والوظيفة<select value={editStaff} onChange={e=>{setEditStaff(e.target.value);const m=selectedStaff(e.target.value);if(m?.job_title_ar!=="معلم")setEditClasses([])}}><option value="">اختر من الهيئة</option>{staff.filter(s=>!s.linked||s.linked_app_user_id===editing).map(s=><option key={s.id} value={s.id}>{s.full_name_ar} — {s.job_title_ar}{s.specialty_ar?" — "+s.specialty_ar:""}</option>)}</select></label>{selectedStaff(editStaff)?.job_title_ar==="معلم"&&<div className="class-picker"><b>الفصول المسموح بها</b><p>المعلم لن يرى أو يمنح نقاطًا لطلاب أي فصل غير محدد هنا.</p><div>{classes.map(c=><label key={c.id} className={editClasses.includes(c.id)?"class-check active":"class-check"}><input type="checkbox" checked={editClasses.includes(c.id)} onChange={()=>toggleEdit(c.id)}/><span>{c.grade_name}<small>فصل {c.class_name}</small></span></label>)}</div></div>}<button className="btn primary" disabled={busy===editing||!editStaff} onClick={saveScope}>{busy===editing?"جارٍ الحفظ...":"حفظ الوظيفة والفصول"}</button></section>}
    <section className="panel"><div className="panel-title"><div><h3>دليل الهيئة التعليمية والإدارية</h3><p>تم استيراده من ملف الهيئة 1448 هـ.</p></div><span className="counter">{staff.length}</span></div><div className="staff-grid">{staff.map(s=><article className={s.linked?"staff-card linked":"staff-card"} key={s.id}><div><b>{s.full_name_ar}</b><span>{s.job_title_ar}</span></div><small>{s.specialty_ar||s.teaching_subject_ar||"—"}</small><em>{s.linked?"مرتبط بحساب":"غير مرتبط"}</em></article>)}</div></section>
    {msg&&<div className="notice sticky-note">{msg}</div>}
  </main></>}

`;
src = src.slice(0, adminStart) + adminComponent + src.slice(bankStart);

mustReplace(
  'const [tab,setTab]=useState<Tab>("dashboard"); const[khameesna,setKhameesna]=useState<KhameesnaBoard|null>(null); const [dashboard,setDashboard]=useState<Dashboard|null>(null); const[students,setStudents]=useState<Student[]>([]);const[rules,setRules]=useState<Rule[]>([]);const[checks,setChecks]=useState<Check[]>([]);const[rankings,setRankings]=useState<Rankings|null>(null);const[rewards,setRewards]=useState<Reward[]>([]);const[pending,setPending]=useState<PendingUser[]>([]);const[users,setUsers]=useState<ManagedUser[]>([]);const[error,setError]=useState("");const[loading,setLoading]=useState(true);',
  'const [tab,setTab]=useState<Tab>("dashboard"); const[khameesna,setKhameesna]=useState<KhameesnaBoard|null>(null); const [dashboard,setDashboard]=useState<Dashboard|null>(null); const[students,setStudents]=useState<Student[]>([]);const[rules,setRules]=useState<Rule[]>([]);const[checks,setChecks]=useState<Check[]>([]);const[rankings,setRankings]=useState<Rankings|null>(null);const[rewards,setRewards]=useState<Reward[]>([]);const[pending,setPending]=useState<PendingUser[]>([]);const[users,setUsers]=useState<ManagedUser[]>([]);const[staff,setStaff]=useState<StaffMember[]>([]);const[adminClasses,setAdminClasses]=useState<AdminClass[]>([]);const[error,setError]=useState("");const[loading,setLoading]=useState(true);',
  "admin state"
);

mustReplace(
  'if(isAdmin){const[p,u]=await Promise.all([rpc<PendingUser[]>("api_pending_users"),rpc<ManagedUser[]>("api_managed_users")]);setPending(p);setUsers(u)}',
  'if(isAdmin){const[p,u,st,cl]=await Promise.all([rpc<PendingUser[]>("api_pending_users"),rpc<ManagedUser[]>("api_managed_users"),rpc<StaffMember[]>("api_staff_directory"),rpc<AdminClass[]>("api_admin_classes")]);setPending(p);setUsers(u);setStaff(st);setAdminClasses(cl)}',
  "admin data load"
);

mustReplace(
  '<AdminView pending={pending} users={users} reload={loadAll}/>',
  '<AdminView pending={pending} users={users} staff={staff} classes={adminClasses} reload={loadAll}/>',
  "admin props"
);

writeFileSync(path, src);
console.log("Staff directory and class-scope admin UI integrated");
