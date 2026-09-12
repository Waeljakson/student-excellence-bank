import { readFileSync, writeFileSync } from "node:fs";

const appPath="src/App.tsx";
let src=readFileSync(appPath,"utf8");
if(!src.includes('import BehavioralExcellence from "./BehavioralExcellence";')) src=src.replace('import ReferralCenter from "./ReferralCenter";','import ReferralCenter from "./ReferralCenter";\nimport BehavioralExcellence from "./BehavioralExcellence";');
if(!src.includes('import StaffBudgetPanel from "./StaffBudgetPanel";')) src=src.replace('import BehavioralExcellence from "./BehavioralExcellence";','import BehavioralExcellence from "./BehavioralExcellence";\nimport StaffBudgetPanel from "./StaffBudgetPanel";');
if(!src.includes('import GuidanceRedemptionCenter from "./GuidanceRedemptionCenter";')) src=src.replace('import StaffBudgetPanel from "./StaffBudgetPanel";','import StaffBudgetPanel from "./StaffBudgetPanel";\nimport GuidanceRedemptionCenter from "./GuidanceRedemptionCenter";\nimport TeacherCheckManager from "./TeacherCheckManager";\nimport "./redemption.css";');
src=src.replace('type Student = { id: string; student_no: string; name: string; grade_name: string; class_name: string; points: number; value_sar: number; level: string };','type Student = { id: string; student_no: string; name: string; grade_name: string; class_name: string; class_id?: string; points: number; value_sar: number; level: string };');
src=src.replace(/type Tab = ([^;]+);/,m=>m.includes('"behavioral"')?m:m.slice(0,-1)+' | "behavioral";');
src=src.replace(/type Tab = ([^;]+);/,m=>m.includes('"redemption"')?m:m.slice(0,-1)+' | "redemption";');
src=src.replace('}}>دخول المعلم</button>','}}>دخول الهيئة</button>');

const shell=`function AppShell({ profile, children, tab, setTab }: { profile: Profile; children: any; tab: Tab; setTab:(t:Tab)=>void }) {
  const isAdmin=profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL"].includes(r));
  const handlesReferrals=profile.roles?.some(r=>["VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r));
  const canWatchBehavior=profile.roles?.some(r=>["TEACHER","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r));
  const [referralCount,setReferralCount]=useState(0);
  const [behaviorStatus,setBehaviorStatus]=useState<any>(null);
  useEffect(()=>{
    let alive=true;
    async function loadIndicators(){
      if(handlesReferrals){try{const rows=await rpc<any[]>("api_student_referrals",{p_status:"OPEN"});if(alive)setReferralCount(Array.isArray(rows)?rows.length:0)}catch{}}
      if(canWatchBehavior){try{const data=await rpc<any>("api_behavioral_excellence");if(alive)setBehaviorStatus(data)}catch{}}
    }
    loadIndicators();const timer=window.setInterval(loadIndicators,15000);
    const onVisible=()=>{if(document.visibilityState==="visible")loadIndicators()};
    window.addEventListener("behavioral-status-changed",loadIndicators);document.addEventListener("visibilitychange",onVisible);
    return()=>{alive=false;window.clearInterval(timer);window.removeEventListener("behavioral-status-changed",loadIndicators);document.removeEventListener("visibilitychange",onVisible)};
  },[handlesReferrals,canWatchBehavior]);
  const nav:Array<[Tab,string,string]>=[["dashboard","الرئيسية","⌂"],["checks","شيكات التميز","▣"],["khameesna","خميسنا غير","🏆"],["students","الطلاب والمحافظ","◎"],["rankings","لوحة الترتيب","★"],["rewards","المكافآت","◇"]];
  if(profile.roles?.some(r=>["TEACHER","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))) nav.splice(Math.min(3,nav.length),0,["referrals","تحويلات الطلاب","↗"]);
  if(profile.roles?.includes("GUIDANCE_COUNSELOR")) nav.splice(Math.min(4,nav.length),0,["redemption","استبدال النقاط","⇄"]);
  const showBehavior=profile.roles?.some(r=>["GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r))||(profile.roles?.includes("TEACHER")&&behaviorStatus?.visible_to_teacher===true);
  if(showBehavior) nav.splice(Math.min(5,nav.length),0,["behavioral","التميز السلوكي","✦"]);
  nav.push(["account","حسابي","◉"]);
  if(isAdmin) nav.push(["admin","الهيئة والصلاحيات","⚙"]);
  if(profile.roles?.includes("SUPER_ADMIN")) nav.push(["system","إعدادات النظام","◆"]);
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><b>بنك التميز</b><span>مدارس المشكاة الأهلية</span></div></div><nav>{nav.map(([id,label,icon])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><span>{icon}</span>{label}{id==="referrals"&&referralCount>0&&<i className="nav-notification">{referralCount>99?"99+":referralCount}</i>}</button>)}</nav><div className="issuer-card"><div className="issuer-profile-line"><div className="issuer-avatar">{profile.avatar?<img src={profile.avatar} alt="الصورة الشخصية"/>:<span>{profile.name?.trim()?.charAt(0)||"م"}</span>}</div><div><small>المستخدم</small><b>{profile.name}</b></div></div><span>{profile.roles?.includes("TEACHER")?"معلم معتمد":"إدارة"}</span>{profile.can_issue && <><small>المتاح هذا الشهر</small><strong>{profile.is_unlimited?"غير محدود":profile.remaining ?? "—"} نقطة</strong></>}</div><button className="signout" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></aside><div className="main-area">{children}<footer><span>برمجة وتنفيذ: محمد صلاح الدين محمد الجمل</span><span>جميع الحقوق محفوظة © مدارس المشكاة الأهلية</span></footer></div></div>;
}
`;
src=src.replace(/function AppShell\([\s\S]*?(?=\nfunction DashboardView)/,shell.trimEnd());
if(!src.includes('tab==="behavioral"&&<BehavioralExcellence')) src=src.replace('{tab==="referrals"&&<ReferralCenter roles={profile.roles} students={students} profileName={profile.name||""}/>} {tab==="khameesna"&&<KhameesnaCompetition/>}','{tab==="referrals"&&<ReferralCenter roles={profile.roles} students={students} profileName={profile.name||""}/>} {tab==="behavioral"&&<BehavioralExcellence students={students}/>} {tab==="khameesna"&&<KhameesnaCompetition/>}');
if(!src.includes('tab==="redemption"&&<GuidanceRedemptionCenter')) src=src.replace('{tab==="referrals"&&<ReferralCenter roles={profile.roles} students={students} profileName={profile.name||""}/>}','{tab==="referrals"&&<ReferralCenter roles={profile.roles} students={students} profileName={profile.name||""}/>} {tab==="redemption"&&profile.roles?.includes("GUIDANCE_COUNSELOR")&&<GuidanceRedemptionCenter/>}');
if(!src.includes('<TeacherCheckManager onChanged={afterIssued}/>')) src=src.replace('{tab==="checks"&&<ChecksView students={students} rules={rules} onIssued={afterIssued}/>}','{tab==="checks"&&<><ChecksView students={students} rules={rules} onIssued={afterIssued}/>{profile.roles?.includes("TEACHER")&&<main className="content teacher-check-manager-wrap"><TeacherCheckManager onChanged={afterIssued}/></main>}</>}');
if(!src.includes('<StaffBudgetPanel/>')) src=src.replace('    <StudentExcelImporter onImported={reload}/>','    <StaffBudgetPanel/>\n    <StudentExcelImporter onImported={reload}/>');
src=src.replace('<td>{u.assigned_classes?.length?u.assigned_classes.join("، "):"—"}</td>','<td><div className="assigned-class-lines">{u.assigned_classes?.length?u.assigned_classes.map((x,i)=><span key={i}>{x}</span>):<span>—</span>}</div></td>');
src=src.replace('{u.roles.includes("TEACHER")&&<button className="mini-btn" onClick={()=>budget(u)}>تعديل الحد</button>}','<button className="mini-btn" onClick={()=>budget(u)}>تعديل الحد</button>');
writeFileSync(appPath,src);

const systemPath="src/SystemControlPanel.tsx";
let sys=readFileSync(systemPath,"utf8");
if(!sys.includes('import PointConversionPanel from "./PointConversionPanel";')) sys=sys.replace('import { niceError, rpc } from "./client";','import { niceError, rpc } from "./client";\nimport PointConversionPanel from "./PointConversionPanel";\nimport BehavioralCycleAdmin from "./BehavioralCycleAdmin";\nimport CompetitionManagementPanel from "./CompetitionManagementPanel";');
if(!sys.includes('import CompetitionManagementPanel from "./CompetitionManagementPanel";')) sys=sys.replace('import BehavioralCycleAdmin from "./BehavioralCycleAdmin";','import BehavioralCycleAdmin from "./BehavioralCycleAdmin";\nimport CompetitionManagementPanel from "./CompetitionManagementPanel";');
if(!sys.includes('<PointConversionPanel/>')) sys=sys.replace('<main className="content system-control">','<main className="content system-control">\n    <PointConversionPanel/>\n    <BehavioralCycleAdmin/>\n    <CompetitionManagementPanel/>');
else if(!sys.includes('<CompetitionManagementPanel/>')) sys=sys.replace('<BehavioralCycleAdmin/>','<BehavioralCycleAdmin/>\n    <CompetitionManagementPanel/>');
writeFileSync(systemPath,sys);

const portalPath="src/StudentPortal.tsx";
let portal=readFileSync(portalPath,"utf8");
if(!portal.includes('import StudentPrograms from "./StudentPrograms";')) portal=portal.replace('import "./student-account.css";','import "./student-account.css";\nimport StudentPrograms from "./StudentPrograms";');
if(!portal.includes('import StudentRedemptionPanel from "./StudentRedemptionPanel";')) portal=portal.replace('import StudentPrograms from "./StudentPrograms";','import StudentPrograms from "./StudentPrograms";\nimport StudentRedemptionPanel from "./StudentRedemptionPanel";\nimport "./redemption.css";');
portal=portal.replace('issuer_name:string }>;','issuer_name:string; reversed_at?:string|null; reversal_reason?:string|null }>;');
portal=portal.replace('function date(v:string){return new Date(v).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"})}','function date(v?:string|null){return v?new Date(v).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"}):"—"}');
portal=portal.replace(/\n\s*\{competitions\.length>0&&<section className="student-competition-banners">[\s\S]*?<\/section>\}\n\n\s*<section className="portal-panel student-account-panel">/,'\n      <StudentPrograms competitions={competitions} student={s}/>\n      <StudentRedemptionPanel/>\n\n      <section className="portal-panel student-account-panel">');
if(portal.includes('<StudentPrograms competitions={competitions} student={s}/>')&&!portal.includes('<StudentRedemptionPanel/>')) portal=portal.replace('<StudentPrograms competitions={competitions} student={s}/>','<StudentPrograms competitions={competitions} student={s}/>\n      <StudentRedemptionPanel/>');
const oldChecks='{data.checks.length?<div className="student-checks">{data.checks.map(c=><div className="student-check-card" key={c.id}><div><b>{c.rule_name}</b><small>{c.reason}</small><em>{date(c.issued_at)} · {c.issuer_name}</em></div><strong>+{c.points}</strong><span>{c.serial_no}</span></div>)}</div>:<div className="empty">لم يصدر لك أي شيك تميز حتى الآن.</div>}';
const newChecks='{data.checks.length?<div className="student-checks">{data.checks.map(c=><div className={c.status==="REVERSED"?"student-check-card reversed":"student-check-card"} key={c.id}><div><b>{c.rule_name}</b><small>{c.reason}</small><em>{date(c.issued_at)} · {c.issuer_name}</em>{c.status==="REVERSED"&&<div className="student-check-reversed-note"><b>تم إيقاف الشيك بواسطة المعلم: {c.issuer_name}</b><span>{c.reversal_reason||"تم إيقاف الشيك بواسطة المعلم المصدر"} · {date(c.reversed_at)}</span></div>}</div><strong>{c.status==="REVERSED"?"−":"+"}{c.points}</strong><span>{c.serial_no}</span></div>)}</div>:<div className="empty">لم يصدر لك أي شيك تميز حتى الآن.</div>}';
portal=portal.replace(oldChecks,newChecks);
writeFileSync(portalPath,portal);

const referralPath="src/ReferralCenter.tsx";
let ref=readFileSync(referralPath,"utf8");
if(!ref.includes('const canDeleteArchive=roles.includes("SUPER_ADMIN")')) ref=ref.replace('  const canHandle=roles.includes("VICE_PRINCIPAL")||roles.includes("GUIDANCE_COUNSELOR");','  const canHandle=roles.includes("VICE_PRINCIPAL")||roles.includes("GUIDANCE_COUNSELOR");\n  const canDeleteArchive=roles.includes("SUPER_ADMIN");');
if(!ref.includes('async function deleteArchived')) ref=ref.replace('\n\n  return <><header className="topbar">','\n  async function deleteArchived(r:Referral){if(!window.confirm(`حذف التحويل ${r.referral_no} من الأرشيف؟ سيختفي من التقرير مع الاحتفاظ بأثر التدقيق الداخلي.`))return;setActionBusy(r.id+"x");setGlobalMsg("");try{await rpc("api_delete_completed_referral",{p_referral_id:r.id});setGlobalMsg(`تم حذف التحويل ${r.referral_no} من الأرشيف.`);await load()}catch(e){setGlobalMsg(niceError(e))}finally{setActionBusy("")}}\n\n  return <><header className="topbar">');
ref=ref.replace('<th>تاريخ الإنهاء</th></tr>','<th>تاريخ الإنهاء</th>{canDeleteArchive&&<th className="no-print">إجراء</th>}</tr>');
ref=ref.replace('<td>{fmt(r.completed_at)}</td></tr>','<td>{fmt(r.completed_at)}</td>{canDeleteArchive&&<td className="no-print"><button className="mini-btn danger" disabled={actionBusy===r.id+"x"} onClick={()=>deleteArchived(r)}>{actionBusy===r.id+"x"?"جارٍ الحذف...":"حذف من الأرشيف"}</button></td>}</tr>');
writeFileSync(referralPath,ref);
