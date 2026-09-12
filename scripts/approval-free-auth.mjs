import { readFileSync, writeFileSync } from "node:fs";

const appPath="src/App.tsx";
let src=readFileSync(appPath,"utf8");

src=src.replace('useState<"otp" | "register" | "password" | "teacher" | "student">("otp")','useState<"otp" | "register" | "password" | "teacher" | "student">("password")');
src=src.replace('        <button className={mode==="otp"?"active":""} onClick={()=>{setMode("otp");setMessage("")}}>دخول برمز البريد</button>\n','');
src=src.replace('        <button className={mode==="register"?"active":""} onClick={()=>{setMode("register");setMessage("")}}>إنشاء حساب بالبريد</button>\n','');
src=src.replace('>دخول بكلمة مرور</button>','>دخول الإدارة</button>');
src=src.replace('<h2>الدخول بكلمة المرور</h2>','<h2>دخول الإدارة</h2><p>دخول مدير النظام والإدارة بالبريد الإلكتروني وكلمة المرور.</p>');

const otpStart=src.indexOf('      {mode==="otp" &&');
const passwordStart=src.indexOf('      {mode==="password" &&',otpStart);
if(otpStart>=0&&passwordStart>otpStart) src=src.slice(0,otpStart)+src.slice(passwordStart);

const registerStart=src.indexOf('      {mode==="register" &&');
const teacherStart=src.indexOf('      {mode==="teacher"&&',registerStart);
if(registerStart>=0&&teacherStart>registerStart) src=src.slice(0,registerStart)+src.slice(teacherStart);

const pendingOld='function PendingAccount({ profile, onRefresh }: { profile: Profile; onRefresh: ()=>void }) {\n  return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">⏳</span><h1>الحساب بانتظار الصلاحية</h1><p>أهلًا {profile.name || profile.email}. تم تسجيل حسابك بنجاح، لكن إصدار شيكات التميز لن يعمل حتى تعتمد الإدارة حسابك كمعلم.</p><button className="btn primary" onClick={onRefresh}>تحديث حالة الحساب</button><button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;\n}';
const pendingNew='function PendingAccount({ profile }: { profile: Profile; onRefresh: ()=>void }) {\n  return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">!</span><h1>الحساب غير مرتبط بالنظام</h1><p>{profile.name || profile.email} — استخدم طريقة الدخول المخصصة لك. المعلم يدخل برقم الجوال، والطالب برقم الطالب.</p><button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;\n}';
src=src.replace(pendingOld,pendingNew);

const pendingPanelStart=src.indexOf('    <section className="panel"><div className="panel-title"><div><h3>طلبات اعتماد حسابات جديدة</h3>');
const usersPanelStart=src.indexOf('    <section className="panel"><div className="panel-title"><div><h3>المستخدمون المعتمدون</h3>',pendingPanelStart);
if(pendingPanelStart>=0&&usersPanelStart>pendingPanelStart) src=src.slice(0,pendingPanelStart)+src.slice(usersPanelStart);
src=src.replace('<h3>المستخدمون المعتمدون</h3><p>يمكن تعديل ربط الموظف والفصول في أي وقت.</p>','<h3>المستخدمون</h3><p>الحسابات المرتبطة بدليل الهيئة وصلاحيات الفصول.</p>');

src=src.replace('if(isAdmin){const[p,u,st,cl]=await Promise.all([rpc<PendingUser[]>("api_pending_users"),rpc<ManagedUser[]>("api_managed_users"),rpc<StaffMember[]>("api_staff_directory"),rpc<AdminClass[]>("api_admin_classes")]);setPending(p);setUsers(u);setStaff(st);setAdminClasses(cl)}','if(isAdmin){const[u,st,cl]=await Promise.all([rpc<ManagedUser[]>("api_managed_users"),rpc<StaffMember[]>("api_staff_directory"),rpc<AdminClass[]>("api_admin_classes")]);setPending([]);setUsers(u);setStaff(st);setAdminClasses(cl)}');

writeFileSync(appPath,src);

const clientPath="src/client.ts";
let client=readFileSync(clientPath,"utf8");
client=client.replace('  if (message.includes("APPROVAL_REQUIRED")) return "الحساب مسجل، لكنه ما زال بانتظار اعتماد الإدارة.";\n','');
client=client.replace('يجب تحديد فصل واحد على الأقل لهذا الموظف قبل اعتماد الصلاحية.','يجب تحديد فصل واحد على الأقل لهذا الموظف.');
writeFileSync(clientPath,client);
