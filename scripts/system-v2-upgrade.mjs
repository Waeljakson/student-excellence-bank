import { readFileSync, writeFileSync } from "node:fs";

const appPath="src/App.tsx";
let src=readFileSync(appPath,"utf8");

if(!src.includes('import StudentLogin from "./StudentLogin";')){
  src=src.replace('import StudentExcelImporter from "./StudentExcelImporter";','import StudentExcelImporter from "./StudentExcelImporter";\nimport StudentLogin from "./StudentLogin";\nimport StudentPortal from "./StudentPortal";\nimport SystemControlPanel from "./SystemControlPanel";\nimport KhameesnaCompetition from "./KhameesnaCompetition";');
}

src=src.replace('const [mode, setMode] = useState<"otp" | "register" | "password">("otp");','const [mode, setMode] = useState<"otp" | "register" | "password" | "student">("otp");');

if(!src.includes('>دخول الطالب</button>')){
  src=src.replace('إنشاء حساب معلم</button>','إنشاء حساب معلم</button>\n        <button className={mode==="student"?"active":""} onClick={()=>{setMode("student");setMessage("")}}>دخول الطالب</button>');
}
if(!src.includes('{mode==="student"&&<StudentLogin/>}')){
  src=src.replace('      {message && <div className="notice">{message}</div>}','      {mode==="student"&&<StudentLogin/>}\n      {message && <div className="notice">{message}</div>}');
}

src=src.replace(/type Tab = ([^;]+);/,m=>m.includes('"system"')?m:m.slice(0,-1)+' | "system";');

if(!src.includes('nav.push(["system","إعدادات النظام"')){
  src=src.replace('if(isAdmin) nav.push(["admin","الهيئة والصلاحيات","⚙"]);','if(isAdmin) nav.push(["admin","الهيئة والصلاحيات","⚙"]);\n  if(profile.roles?.includes("SUPER_ADMIN")) nav.push(["system","إعدادات النظام","◆"]);');
}

src=src.replace('<label>النقاط<input type="number" required value={points} onChange={e=>setPoints(Number(e.target.value))}/></label>','<div className="fixed-point-value"><span>نقاط البطاقة</span><strong>{points}</strong><small>يحددها مدير النظام فقط</small></div>');
src=src.replace('subtitle="المعلم لا يستطيع الإصدار إلا بعد اعتماد الإدارة لصلاحيته"','subtitle="اختر الطالب والبطاقة فقط — قيمة النقاط محددة مركزيًا من مدير النظام"');

src=src.replace('{tab==="khameesna"&&<KhameesnaView data={khameesna} reload={loadAll}/>}','{tab==="khameesna"&&<KhameesnaCompetition/>}');
if(!src.includes('{tab==="system"&&profile.roles?.includes("SUPER_ADMIN")&&<SystemControlPanel/>}')){
  src=src.replace('{tab==="admin"&&isAdmin&&<AdminView pending={pending} users={users} staff={staff} classes={adminClasses} reload={loadAll}/>}','{tab==="system"&&profile.roles?.includes("SUPER_ADMIN")&&<SystemControlPanel/>} {tab==="admin"&&isAdmin&&<AdminView pending={pending} users={users} staff={staff} classes={adminClasses} reload={loadAll}/>}');
}

if(!src.includes('profile.roles?.includes("STUDENT")')){
  src=src.replace('if(profile.status!=="APPROVED")return <PendingAccount profile={profile} onRefresh={refreshProfile}/>;','if(profile.status!=="APPROVED")return <PendingAccount profile={profile} onRefresh={refreshProfile}/>;\n  if(profile.roles?.includes("STUDENT"))return <StudentPortal/>;');
}

src='// SYSTEM_FEATURES_V2\n'+src;
writeFileSync(appPath,src);

const clientPath="src/client.ts";
let client=readFileSync(clientPath,"utf8");
if(!client.includes('SUPER_ADMIN_REQUIRED')){
  client=client.replace('  if (message.includes("schema cache")', '  if (message.includes("SUPER_ADMIN_REQUIRED")) return "هذه الإعدادات متاحة لمدير النظام فقط.";\n  if (message.includes("POINT_VALUE_RANGE")) return "قيمة نقاط البطاقة يجب أن تكون من 1 إلى 100.";\n  if (message.includes("KHAMEESNA_WEEK_NOT_ACTIVE")) return "التقييم متاح فقط أثناء أسابيع خميسنا غير من الأحد إلى الخميس.";\n  if (message.includes("KHAMEESNA_SCORE_RANGE")) return "كل معيار في خميسنا غير يجب أن يكون من 0 إلى 10.";\n  if (message.includes("STUDENT_ALREADY_CLAIMED")) return "حساب هذا الطالب مفعّل بالفعل.";\n  if (message.includes("STUDENT_ACCOUNT_REQUIRED")) return "هذا الحساب غير مربوط بطالب.";\n  if (message.includes("ACCOUNT_TYPE_CONFLICT")) return "لا يمكن استخدام حساب موظف كحساب طالب.";\n  if (message.includes("schema cache")');
  writeFileSync(clientPath,client);
}

const khPath="src/KhameesnaCompetition.tsx";
let kh=readFileSync(khPath,"utf8");
kh=kh.replace('criteria?:Array<{key:string;label:string;weight:number;max_score:number}>','criteria?:Array<{key:string;label:string;weight:number;max_score:number;sort_order?:number}>');
writeFileSync(khPath,kh);
