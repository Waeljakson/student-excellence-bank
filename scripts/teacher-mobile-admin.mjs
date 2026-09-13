import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let src = readFileSync(appPath, "utf8");

const oldSig = 'function AdminView({pending,users,staff,classes,reload}:{pending:PendingUser[];users:ManagedUser[];staff:StaffMember[];classes:AdminClass[];reload:()=>Promise<void>}){';
const newSig = 'function AdminView({pending,users,staff,classes,reload,isSuperAdmin}:{pending:PendingUser[];users:ManagedUser[];staff:StaffMember[];classes:AdminClass[];reload:()=>Promise<void>;isSuperAdmin:boolean}){';
if (src.includes(oldSig)) src = src.replace(oldSig, newSig);

if (!src.includes('async function changeTeacherMobile(s:StaffMember)')) {
  const marker = '  async function approve(u:PendingUser)';
  const helper = `  async function changeTeacherMobile(s:StaffMember){
    if(!isSuperAdmin||s.job_title_ar!=="معلم")return;
    const current=String(s.mobile||"").trim();
    const raw=window.prompt("رقم الجوال الجديد للمعلم "+s.full_name_ar,current);
    if(raw===null)return;
    const mobile=raw.replace(/\\D/g,"");
    if(!/^05\\d{8}$/.test(mobile)){setMsg("رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05.");return}
    if(mobile===current){setMsg("رقم الجوال الجديد مطابق للرقم الحالي.");return}
    const warning=s.linked?"سيتم تغيير اسم دخول المعلم إلى "+mobile+" مع الإبقاء على كلمة المرور الحالية كما هي.":"سيصبح اسم المستخدم "+mobile+" وكلمة المرور الافتراضية "+mobile+"Aa عند أول دخول.";
    if(!window.confirm(warning+" هل تريد المتابعة؟"))return;
    const key="mobile:"+s.id;setBusy(key);setMsg("");
    try{
      const result=await rpc<any>("api_set_staff_classes",{p_staff_id:s.id,p_class_ids:{action:"UPDATE_TEACHER_MOBILE",mobile}});
      setMsg(result?.linked?"تم تغيير اسم دخول "+s.full_name_ar+" إلى "+mobile+". كلمة المرور الحالية لم تتغير.":"تم تغيير جوال "+s.full_name_ar+". اسم المستخدم: "+mobile+" — كلمة المرور الافتراضية: "+mobile+"Aa");
      await reload();
    }catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }
`;
  if (!src.includes(marker)) throw new Error("teacher-mobile-admin: approve marker not found");
  src = src.replace(marker, helper + marker);
}

const assignButton = '{isClassScopedJob(s.job_title_ar)&&<button className="mini-btn" onClick={()=>openStaffAssignment(s)}>تسكين الفصول</button>}';
const mobileButton = '{isSuperAdmin&&s.job_title_ar==="معلم"&&<button className="mini-btn" disabled={busy==="mobile:"+s.id} onClick={()=>changeTeacherMobile(s)}>{busy==="mobile:"+s.id?"جارٍ التغيير...":"تغيير رقم الجوال"}</button>}';
if (!src.includes('onClick={()=>changeTeacherMobile(s)}')) {
  if (!src.includes(assignButton)) throw new Error("teacher-mobile-admin: staff card marker not found");
  src = src.replace(assignButton, mobileButton + assignButton);
}

const oldCall = '<AdminView pending={pending} users={users} staff={staff} classes={adminClasses} reload={loadAll}/>';
const newCall = '<AdminView pending={pending} users={users} staff={staff} classes={adminClasses} reload={loadAll} isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true}/>';
if (src.includes(oldCall)) src = src.replace(oldCall, newCall);

writeFileSync(appPath, src);

const clientPath = "src/client.ts";
let client = readFileSync(clientPath, "utf8");
if (!client.includes('TEACHER_LOGIN_EXISTS')) {
  const marker = '  if (message.includes("TEACHER_MOBILE_EXISTS")) return "رقم الجوال مسجل لموظف آخر بالفعل.";';
  const extra = marker + '\n  if (message.includes("TEACHER_LOGIN_EXISTS")) return "رقم الجوال مرتبط بحساب دخول آخر بالفعل.";\n  if (message.includes("STAFF_LINK_BROKEN")) return "يوجد خلل في ربط حساب المعلم. راجع بيانات الحساب قبل تغيير الجوال.";';
  if (client.includes(marker)) client = client.replace(marker, extra);
}
writeFileSync(clientPath, client);
