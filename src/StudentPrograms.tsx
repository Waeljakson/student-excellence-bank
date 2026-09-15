import { useEffect, useMemo, useState } from "react";
import { niceError, rpc } from "./client";
import "./engagement.css";
import "./student-programs-enhanced.css";

const SCHOOL_LOGO=`${import.meta.env.BASE_URL}school-logo.png`;
const GUIDANCE_LOGO=`${import.meta.env.BASE_URL}guidance-logo.png`;

type Competition={
  id:string;
  title_ar:string;
  body_ar:string;
  starts_at:string;
  ends_at?:string|null;
  announcement_type?:string;
  criteria?:string[];
  reward_ar?:string|null;
};
type Student={name:string;grade_name:string;class_name:string};
type Membership={competition_id:string;joined_at:string};
type Special={
  id?:string;
  type:string;
  title:string;
  body:string;
  starts_at?:string;
  ends_at?:string;
  status?:"UPCOMING"|"ACTIVE"|"PAUSED"|"ENDED"|string;
  join_required:false;
  advice?:string[];
  reward?:string|null;
  week_no?:number|null;
  start_week?:number|null;
};
type Programs={khameesna?:Special|null;behavioral?:Special|null};

const date=(v?:string|null)=>v?new Date(v).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"}):"—";
const isUpcoming=(v?:string|null)=>Boolean(v&&new Date(v).getTime()>Date.now());
const statusText=(status?:string)=>status==="UPCOMING"?"قريبًا":status==="PAUSED"?"متوقفة مؤقتًا":status==="ACTIVE"?"فعالة الآن":"معلنة";

const joinTips=[
  "اختر مجال المشاركة الأقرب لموهبتك حتى تقدم أفضل ما لديك.",
  "اقرأ معايير المسابقة جيدًا قبل أن تبدأ، واجعل مشاركتك تحقق أكبر عدد منها.",
  "ابدأ مبكرًا ولا تنتظر آخر يوم؛ المراجعة والتحسين يرفعان جودة مشاركتك.",
  "قدّم فكرة أصلية ومنظمة وواضحة تعكس شخصيتك وإبداعك.",
  "انضم من التطبيق حتى تعرف المدرسة أنك ترغب في المشاركة وتستعد من الآن."
];

export default function StudentPrograms({competitions,student}:{competitions:Competition[];student:Student}){
  const[members,setMembers]=useState<Membership[]>([]);
  const[programs,setPrograms]=useState<Programs>({});
  const[busy,setBusy]=useState("");
  const[msg,setMsg]=useState("");

  async function load(){
    try{
      const[m,p]=await Promise.all([
        rpc<Membership[]>("api_student_competition_memberships"),
        rpc<Programs>("api_student_program_banners")
      ]);
      setMembers(m||[]);
      setPrograms(p||{});
    }catch(e){setMsg(niceError(e))}
  }
  useEffect(()=>{load()},[]);

  const joined=useMemo(()=>new Set(members.map(x=>x.competition_id)),[members]);
  const specials=[programs.khameesna,programs.behavioral].filter(Boolean) as Special[];

  async function join(id:string){
    setBusy(id);setMsg("");
    try{
      await rpc("api_student_join_competition",{p_competition_id:id});
      setMsg("تم انضمامك للمسابقة بنجاح. جهّز مشاركتك من الآن ونافس على الجوائز.");
      await load();
    }catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }

  if(!competitions.length&&!specials.length)return null;

  return <section className="student-programs-stack">
    <div className="student-opportunities-head">
      <div>
        <span>فرصتك تبدأ من هنا</span>
        <h2>المسابقات القادمة والفرص المتاحة</h2>
        <p>تابع ما تم تفعيله لك، اعرف طريقة الفوز، واستعد مبكرًا. جوائز وتكريمات قيّمة بانتظار الطلاب والفصول الأكثر تميزًا.</p>
      </div>
      <strong>{competitions.length+specials.length}</strong>
    </div>

    {specials.map((p)=><article className={`competition-check-banner auto-program ${p.type==="KHAMEESNA"?"kh-banner":"behavior-banner"}`} key={p.type}>
      <div className="check-perforation top"/>
      <div className="competition-check-side">
        <div className="competition-check-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div>
        <span>{p.type==="KHAMEESNA"?"مسابقة الفصول":"برنامج التميز"}</span>
        <b>{p.type==="KHAMEESNA"?(p.start_week?`أسبوع ${p.start_week}`:"فصل"):"✦"}</b>
      </div>
      <div className="competition-check-main">
        <div className="competition-check-kicker">
          <span>{p.type==="KHAMEESNA"?"أنت مشارك تلقائيًا مع فصلك":"لا تحتاج تسجيلًا — ترشيحات المعلمين"}</span>
          <em className={`program-status ${String(p.status||"").toLowerCase()}`}>{statusText(p.status)}</em>
        </div>
        <h2>{p.title}</h2>
        {p.type==="KHAMEESNA"&&p.start_week?<div className="competition-start-callout"><small>بداية المنافسة المعتمدة</small><strong>من الأسبوع {p.start_week}</strong><span>{date(p.starts_at)}</span></div>:null}
        <p>{p.body}</p>
        <div className="student-prize-callout"><span>الجائزة والتكريم</span><strong>{p.reward||"جوائز قيّمة وتكريم للمتميزين"}</strong></div>
        {p.advice?.length?<div className="student-advice-wrap"><h4>كيف تزيد فرصك في الفوز؟</h4><div className="student-advice-grid">{p.advice.map((a,n)=><span key={n}><b>{n+1}</b>{a}</span>)}</div></div>:null}
        <div className="competition-check-footer">
          <div><small>البداية</small><b>{date(p.starts_at)}</b></div>
          <div><small>النهاية</small><b>{date(p.ends_at)}</b></div>
          <div><small>طريقة المشاركة</small><b>{p.type==="KHAMEESNA"?"فصلك مشارك تلقائيًا":"تميّزك اليومي وترشيحات المعلمين"}</b></div>
        </div>
      </div>
      <div className="check-perforation bottom"/>
    </article>)}

    {competitions.length>0&&<div className="optional-competitions-title"><div><span>مسابقات اختيارية</span><h3>انضم واظهر موهبتك</h3><p>هذه المسابقات تحتاج انضمامك. لا تؤجل الفرصة؛ اختر ما يناسبك وابدأ الاستعداد للمنافسة.</p></div></div>}

    {competitions.map((c,index)=>{
      const alreadyJoined=joined.has(c.id);
      const upcoming=isUpcoming(c.starts_at);
      return <article className="competition-check-banner joinable" key={c.id}>
        <div className="check-perforation top"/>
        <div className="competition-check-side">
          <div className="competition-check-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div>
          <span>مسابقة اختيارية</span>
          <b>{String(index+1).padStart(2,"0")}</b>
        </div>
        <div className="competition-check-main">
          <div className="competition-check-kicker">
            <span>مخصصة لفصلك</span>
            <em>{alreadyJoined?"أنت منضم":upcoming?"تبدأ قريبًا":"متاحة للانضمام"}</em>
          </div>
          <h2>{c.title_ar}</h2>
          <p>{c.body_ar}</p>
          <div className="student-prize-callout optional"><span>لماذا تنضم؟</span><strong>{c.reward_ar||"فرصة لإظهار موهبتك والفوز بتكريم وجوائز قيّمة"}</strong></div>
          {c.criteria?.length?<><h4 className="criteria-title">مجالات ومعايير المشاركة</h4><div className="competition-check-criteria">{c.criteria.map((x,i)=><span key={i}><b>{i+1}</b>{x}</span>)}</div></>:null}
          <div className="student-advice-wrap optional-advice"><h4>نصائح قبل الانضمام</h4><div className="student-advice-grid">{joinTips.map((tip,i)=><span key={i}><b>{i+1}</b>{tip}</span>)}</div></div>
          <div className="competition-check-footer">
            <div><small>تبدأ</small><b>{date(c.starts_at)}</b></div>
            <div><small>تنتهي</small><b>{date(c.ends_at)}</b></div>
            <div><small>الفصل المستهدف</small><b>{student.grade_name} — فصل {student.class_name}</b></div>
          </div>
          <button className={alreadyJoined?"competition-join-btn joined":"competition-join-btn"} disabled={alreadyJoined||busy===c.id||upcoming} onClick={()=>join(c.id)}>
            {busy===c.id?"جارٍ الانضمام...":alreadyJoined?"✓ أنت منضم للمسابقة":upcoming?`يفتح الانضمام ${date(c.starts_at)}`:"انضم الآن وابدأ المنافسة"}
          </button>
          {!alreadyJoined&&!upcoming&&<p className="join-encouragement">انضم الآن؛ المشاركة هي أول خطوة للفوز، والجوائز بانتظار أصحاب المبادرة والإبداع.</p>}
        </div>
        <div className="check-perforation bottom"/>
      </article>
    })}
    {msg&&<div className="notice compact-notice">{msg}</div>}
  </section>;
}
