import { readFileSync, writeFileSync } from "node:fs";

const appPath="src/App.tsx";
let src=readFileSync(appPath,"utf8");
if(!src.includes('import BehavioralExcellence from "./BehavioralExcellence";')) src=src.replace('import ReferralCenter from "./ReferralCenter";','import ReferralCenter from "./ReferralCenter";\nimport BehavioralExcellence from "./BehavioralExcellence";');
src=src.replace('type Student = { id: string; student_no: string; name: string; grade_name: string; class_name: string; points: number; value_sar: number; level: string };','type Student = { id: string; student_no: string; name: string; grade_name: string; class_name: string; class_id?: string; points: number; value_sar: number; level: string };');
src=src.replace(/type Tab = ([^;]+);/,m=>m.includes('"behavioral"')?m:m.slice(0,-1)+' | "behavioral";');

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
  const showBehavior=profile.roles?.some(r=>["GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r))||(profile.roles?.includes("TEACHER")&&behaviorStatus?.visible_to_teacher===true);
  if(showBehavior) nav.splice(Math.min(4,nav.length),0,["behavioral","التميز السلوكي","✦"]);
  nav.push(["account","حسابي","◉"]);
  if(isAdmin) nav.push(["admin","الهيئة والصلاحيات","⚙"]);
  if(profile.roles?.includes("SUPER_ADMIN")) nav.push(["system","إعدادات النظام","◆"]);
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><b>بنك التميز</b><span>مدارس المشكاة الأهلية</span></div></div><nav>{nav.map(([id,label,icon])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><span>{icon}</span>{label}{id==="referrals"&&referralCount>0&&<i className="nav-notification">{referralCount>99?"99+":referralCount}</i>}</button>)}</nav><div className="issuer-card"><div className="issuer-profile-line"><div className="issuer-avatar">{profile.avatar?<img src={profile.avatar} alt="الصورة الشخصية"/>:<span>{profile.name?.trim()?.charAt(0)||"م"}</span>}</div><div><small>المستخدم</small><b>{profile.name}</b></div></div><span>{profile.roles?.includes("TEACHER")?"معلم معتمد":"إدارة"}</span>{profile.can_issue && <><small>المتاح هذا الشهر</small><strong>{profile.is_unlimited?"غير محدود":profile.remaining ?? "—"} نقطة</strong></>}</div><button className="signout" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></aside><div className="main-area">{children}<footer><span>برمجة وتنفيذ: محمد صلاح الدين محمد الجمل</span><span>جميع الحقوق محفوظة © مدارس المشكاة الأهلية</span></footer></div></div>;
}
`;
src=src.replace(/function AppShell\([\s\S]*?(?=\nfunction DashboardView)/,shell.trimEnd());
if(!src.includes('tab==="behavioral"&&<BehavioralExcellence')) src=src.replace('{tab==="referrals"&&<ReferralCenter roles={profile.roles} students={students} profileName={profile.name||""}/>} {tab==="khameesna"&&<KhameesnaCompetition/>}','{tab==="referrals"&&<ReferralCenter roles={profile.roles} students={students} profileName={profile.name||""}/>} {tab==="behavioral"&&<BehavioralExcellence students={students}/>} {tab==="khameesna"&&<KhameesnaCompetition/>}');
writeFileSync(appPath,src);

const systemPath="src/SystemControlPanel.tsx";
let sys=readFileSync(systemPath,"utf8");
if(!sys.includes('import PointConversionPanel from "./PointConversionPanel";')) sys=sys.replace('import { niceError, rpc } from "./client";','import { niceError, rpc } from "./client";\nimport PointConversionPanel from "./PointConversionPanel";\nimport BehavioralCycleAdmin from "./BehavioralCycleAdmin";');
if(!sys.includes('<PointConversionPanel/>')) sys=sys.replace('<main className="content system-control">','<main className="content system-control">\n    <PointConversionPanel/>\n    <BehavioralCycleAdmin/>');
writeFileSync(systemPath,sys);
