import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let src = readFileSync(path, "utf8");
if (src.includes("type KhameesnaBoard")) process.exit(0);

function mustReplace(search, replacement, label) {
  if (!src.includes(search)) throw new Error(`upgrade-app: marker not found: ${label}`);
  src = src.replace(search, replacement);
}

mustReplace(
  'type Reward = { id: string; name_ar: string; description_ar?: string; cost_points: number; cash_value_sar?: number; stock?: number };\n\ntype Tab = "dashboard" | "checks" | "students" | "rankings" | "rewards" | "admin";',
  `type Reward = { id: string; name_ar: string; description_ar?: string; cost_points: number; cash_value_sar?: number; stock?: number };
type KhameesnaStanding = { class_id: string; grade_name: string; class_name: string; total_points: number; awards_count: number; last_award?: string };
type KhameesnaRecent = { id: string; points: number; lesson_no: number; subject_ar?: string; reason_ar?: string; lesson_date: string; awarded_at: string; class_name: string; grade_name: string; teacher_name: string };
type KhameesnaHistory = { week_start: string; class_id: string; grade_name: string; class_name: string; total_points: number };
type KhameesnaBoard = { week_start: string; week_end: string; status: "IN_PROGRESS" | "THURSDAY" | "CLOSED"; reward: string; max_points: number; leader_count: number; standings: KhameesnaStanding[]; recent: KhameesnaRecent[]; history: KhameesnaHistory[] };

type Tab = "dashboard" | "checks" | "khameesna" | "students" | "rankings" | "rewards" | "admin";`,
  "types"
);

mustReplace(
  'const nav:Array<[Tab,string,string]>=[["dashboard","الرئيسية","⌂"],["checks","شيكات التميز","▣"],["students","الطلاب والمحافظ","◎"],["rankings","لوحة الترتيب","★"],["rewards","المكافآت","◇"]];',
  'const nav:Array<[Tab,string,string]>=[["dashboard","الرئيسية","⌂"],["checks","شيكات التميز","▣"],["khameesna","خميسنا غير","🏆"],["students","الطلاب والمحافظ","◎"],["rankings","لوحة الترتيب","★"],["rewards","المكافآت","◇"]];',
  "navigation"
);

const khameesnaComponent = `
function KhameesnaView({data,reload}:{data:KhameesnaBoard|null;reload:()=>Promise<void>}){
  const[classId,setClassId]=useState("");const[points,setPoints]=useState(5);const[lessonNo,setLessonNo]=useState(1);const[subject,setSubject]=useState("");const[reason,setReason]=useState("");const[busy,setBusy]=useState(false);const[msg,setMsg]=useState("");
  if(!data)return <Loading text="جارٍ تحميل مسابقة خميسنا غير..."/>;
  const closed=data.status==="CLOSED";const max=Math.max(Number(data.max_points)||0,1);const leader=data.standings[0];const hasLeader=leader&&Number(leader.total_points)>0;const tied=hasLeader&&data.leader_count>1;
  const date=(v:string)=>new Date(v+"T12:00:00").toLocaleDateString("ar-SA",{day:"numeric",month:"long"});
  async function submit(e:FormEvent){e.preventDefault();if(!classId||closed)return;setBusy(true);setMsg("");try{await rpc("api_khameesna_add_points",{p_class_id:classId,p_points:points,p_lesson_no:lessonNo,p_subject_ar:subject||null,p_reason_ar:reason||null});setMsg("تمت إضافة نقاط الفصل وتحديث ترتيب الأسبوع مباشرة.");setReason("");await reload()}catch(e){setMsg(niceError(e))}finally{setBusy(false)}}
  return <><Header title="خميسنا غير" subtitle="مسابقة أسبوعية تنافسية بين الفصول — الأعلى نقاطًا يستحق رحلة الخميس"/><main className="content">
    <section className="khameesna-hero"><div className="khameesna-title"><span className="eyebrow">🏆 تنافس الفصول</span><h2>خميسنا غير</h2><p>كل حصة فرصة للفصل أن يتقدم. المعلم يضيف نقاط الفصل في نهاية الحصة، والترتيب يتحدث لحظيًا حتى الخميس.</p></div><div className="week-chip"><small>أسبوع المسابقة</small><strong>{date(data.week_start)} — {date(data.week_end)}</strong><span>{data.status==="THURSDAY"?"اليوم يوم الحسم والرحلة":closed?"انتهى أسبوع المسابقة — يبدأ أسبوع جديد الأحد":"المسابقة جارية الآن"}</span></div></section>
    <section className="khameesna-grid"><form className="panel form-stack khameesna-form" onSubmit={submit}><div className="panel-title"><div><h3>إضافة نقاط بعد الحصة</h3><p>تُسجل باسم المعلم والحصة والتاريخ لمنع التكرار.</p></div><span className="counter">+ نقاط</span></div>{closed&&<div className="competition-closed">المسابقة الأسبوعية مغلقة يومي الجمعة والسبت. يبدأ احتساب الأسبوع الجديد صباح الأحد.</div>}<label>الفصل<select required value={classId} onChange={e=>setClassId(e.target.value)}><option value="">اختر الفصل</option>{data.standings.map(c=><option key={c.class_id} value={c.class_id}>{c.grade_name} — فصل {c.class_name}</option>)}</select></label><div className="form-row"><label>رقم الحصة<select value={lessonNo} onChange={e=>setLessonNo(Number(e.target.value))}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>الحصة {n}</option>)}</select></label><label>المادة<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="مثال: رياضيات"/></label></div><label>نقاط الفصل<div className="score-picks">{[1,2,3,5,10].map(n=><button type="button" key={n} className={points===n?"score-pick active":"score-pick"} onClick={()=>setPoints(n)}>+{n}</button>)}</div></label><label>سبب النقاط<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="مثال: مشاركة ممتازة وانضباط الحصة"/></label><button className="btn primary" disabled={busy||closed||!classId}>{busy?"جارٍ الإضافة...":"إضافة نقاط الفصل"}</button>{msg&&<div className="notice">{msg}</div>}</form>
    <section className="panel"><div className="panel-title"><div><h3>ترتيب فصول الأسبوع</h3><p>الأعلى مجموعًا يتصدر مباشرة.</p></div><span className="counter">{data.standings.length}</span></div>{hasLeader?<div className="leader-card"><div className="leader-medal">🏆</div><div><small>{tied?"تعادل على صدارة الأسبوع":"متصدر الأسبوع"}</small><b>{tied?"أكثر من فصل متعادل":leader.grade_name+" — فصل "+leader.class_name}</b><span>{tied?"الحسم بأعلى نقاط قبل نهاية الخميس":leader.total_points+" نقطة — "+data.reward}</span></div></div>:<div className="leader-card"><div className="leader-medal">🏁</div><div><small>البداية من الصفر</small><b>في انتظار أول نقاط هذا الأسبوع</b><span>أول معلم يسجل نقاط الحصة سيبدأ لوحة المنافسة.</span></div></div>}<div className="class-standings">{data.standings.map((c,i)=><div className={i===0&&Number(c.total_points)>0?"class-standing top":"class-standing"} key={c.class_id}><span className="position">{i+1}</span><div className="class-meta"><b>{c.grade_name} — فصل {c.class_name}</b><small>{c.awards_count} إضافة نقاط هذا الأسبوع</small><div className="standing-bar"><i style={{width:(Number(c.total_points)>0?Math.max(5,Number(c.total_points)/max*100):0)+"%"}}/></div></div><div className="class-score"><strong>{c.total_points}</strong><small>نقطة</small></div></div>)}</div></section></section>
    <section className="grid-2 khameesna-recent"><section className="panel"><h3>آخر نقاط أضافها المعلمون</h3>{data.recent.length?<div>{data.recent.map(r=><div className="khameesna-entry" key={r.id}><span className="entry-points">+{r.points}</span><div><b>{r.grade_name} — فصل {r.class_name}</b><small>{r.teacher_name} · الحصة {r.lesson_no}{r.subject_ar?" · "+r.subject_ar:""}{r.reason_ar?" · "+r.reason_ar:""}</small></div><time>{new Date(r.awarded_at).toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"})}</time></div>)}</div>:<Empty text="لا توجد إضافات نقاط هذا الأسبوع بعد."/>}</section><section className="panel"><h3>أبطال الأسابيع السابقة</h3><p>سجل الفصول التي أنهت الأسبوع في المركز الأول.</p>{data.history.length?<div className="winner-history">{data.history.map((h,i)=><div className="winner-chip" key={h.week_start+h.class_id+i}><b>🏆 {h.grade_name} — فصل {h.class_name}</b><small>أسبوع {date(h.week_start)} · {h.total_points} نقطة</small></div>)}</div>:<Empty text="سيظهر هنا سجل الفائزين بعد نهاية أول أسبوع."/>}</section></section>
  </main></>;
}

`;

mustReplace("function AdminView", khameesnaComponent + "function AdminView", "competition component");

mustReplace(
  'const [tab,setTab]=useState<Tab>("dashboard"); const [dashboard,setDashboard]=useState<Dashboard|null>(null);',
  'const [tab,setTab]=useState<Tab>("dashboard"); const[khameesna,setKhameesna]=useState<KhameesnaBoard|null>(null); const [dashboard,setDashboard]=useState<Dashboard|null>(null);',
  "competition state"
);

mustReplace(
  'const [d,s,ru,c,ra,rw]=await Promise.all([rpc<Dashboard>("api_dashboard"),rpc<Student[]>("api_students"),rpc<Rule[]>("api_point_rules"),rpc<Check[]>("api_recent_checks"),rpc<Rankings>("api_rankings"),rpc<Reward[]>("api_rewards")]);setDashboard(d);setStudents(s);setRules(ru);setChecks(c);setRankings(ra);setRewards(rw);',
  'const [d,s,ru,c,ra,rw,kh]=await Promise.all([rpc<Dashboard>("api_dashboard"),rpc<Student[]>("api_students"),rpc<Rule[]>("api_point_rules"),rpc<Check[]>("api_recent_checks"),rpc<Rankings>("api_rankings"),rpc<Reward[]>("api_rewards"),rpc<KhameesnaBoard>("api_khameesna_board")]);setDashboard(d);setStudents(s);setRules(ru);setChecks(c);setRankings(ra);setRewards(rw);setKhameesna(kh);',
  "competition load"
);

mustReplace(
  '{tab==="rewards"&&<RewardsView rewards={rewards}/>} {tab==="admin"&&isAdmin&&<AdminView pending={pending} users={users} reload={loadAll}/>}',
  '{tab==="rewards"&&<RewardsView rewards={rewards}/>} {tab==="khameesna"&&<KhameesnaView data={khameesna} reload={loadAll}/>} {tab==="admin"&&isAdmin&&<AdminView pending={pending} users={users} reload={loadAll}/>}',
  "competition render"
);

writeFileSync(path, src);
console.log("Khameesna competition integrated into App.tsx");
