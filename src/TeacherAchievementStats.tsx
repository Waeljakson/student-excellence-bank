import { useEffect, useMemo, useState } from "react";
import { niceError, rpc } from "./client";
import "./teacher-achievement-stats.css";

const SCHOOL_LOGO = import.meta.env.BASE_URL + "school-logo.png";
const GUIDANCE_LOGO = import.meta.env.BASE_URL + "guidance-logo.png";

type AchievementRow = {
  staff_id:string;
  user_id?:string|null;
  teacher_name:string;
  subject_name:string;
  account_ready:boolean;
  checks_count:number;
  followup_count:number;
  evaluation_report_count:number;
  periodic_evaluation_count:number;
  evaluations_count:number;
  behavioral_count:number;
  khameesna_count:number;
  referrals_count:number;
  active_days:number;
  total_activities:number;
  score_reinforcement:number;
  score_followup:number;
  score_evaluations:number;
  score_initiatives:number;
  score_referrals:number;
  score_consistency:number;
  score:number;
  rank:number;
  gap_to_next:number;
};

type AchievementData = {
  denied?:boolean;
  period:"MONTH";
  period_start:string;
  period_end:string;
  can_view_all:boolean;
  total_teachers:number;
  active_teachers:number;
  average_score:number;
  total_activities:number;
  mine?:AchievementRow|null;
  leaderboard:AchievementRow[];
};

const dimensions=[
  {key:"score_reinforcement" as const,label:"تعزيز الطلاب",max:20,detail:(x:AchievementRow)=>x.checks_count+" شيك تميز"},
  {key:"score_followup" as const,label:"المتابعة",max:20,detail:(x:AchievementRow)=>x.followup_count+" إجراء متابعة"},
  {key:"score_evaluations" as const,label:"التقييمات",max:25,detail:(x:AchievementRow)=>x.evaluations_count+" تقييمًا مسجلًا"},
  {key:"score_initiatives" as const,label:"المبادرات",max:20,detail:(x:AchievementRow)=>x.behavioral_count+" ترشيح سلوكي · "+x.khameesna_count+" خميسنا"},
  {key:"score_referrals" as const,label:"التحويلات",max:5,detail:(x:AchievementRow)=>x.referrals_count+" تحويل"},
  {key:"score_consistency" as const,label:"الاستمرارية",max:10,detail:(x:AchievementRow)=>x.active_days+" يوم نشاط"},
];

function fmt(n:number|string|undefined|null){
  return Number(n||0).toLocaleString("ar-SA");
}

function dateLabel(v?:string){
  if(!v)return "—";
  return new Date(v+"T12:00:00").toLocaleDateString("ar-SA",{day:"numeric",month:"long",year:"numeric"});
}

function RankMedal({rank}:{rank:number}){
  const label=rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":"#"+fmt(rank);
  return <span className={"achievement-rank-badge rank-"+Math.min(rank,4)}>{label}</span>;
}

function ScoreRing({score}:{score:number}){
  const safe=Math.min(100,Math.max(0,Number(score||0)));
  return <div className="achievement-score-ring" style={{"--achievement-score":(safe*3.6)+"deg"} as React.CSSProperties}>
    <div><strong>{fmt(safe)}</strong><span>من 100</span></div>
  </div>;
}

function MyAchievement({row,total}:{row:AchievementRow;total:number}){
  const nextText=row.rank===1
    ?"أنت في المركز الأول حاليًا."
    : row.gap_to_next>0
      ?"يفصلك "+fmt(row.gap_to_next)+" نقطة في مؤشر الإنجاز عن المركز السابق."
      :"ترتيبك قريب جدًا من المركز السابق.";

  return <>
    <section className="achievement-my-hero">
      <div className="achievement-my-copy">
        <span className="achievement-kicker">ترتيبي هذا الشهر</span>
        <div className="achievement-rank-line"><RankMedal rank={row.rank}/><div><h2>المركز {fmt(row.rank)} من {fmt(total)}</h2><p>{nextText}</p></div></div>
        <div className="achievement-my-facts">
          <span><b>{fmt(row.total_activities)}</b><small>سجل نشاط</small></span>
          <span><b>{fmt(row.active_days)}</b><small>أيام نشاط</small></span>
          <span><b>{row.subject_name||"—"}</b><small>التخصص</small></span>
        </div>
      </div>
      <ScoreRing score={row.score}/>
    </section>

    <section className="panel achievement-breakdown-panel">
      <div className="panel-title"><div><h3>تفصيل مؤشر الإنجاز</h3><p>الدرجة موزعة على أكثر من نوع نشاط حتى يكون الترتيب متوازنًا ولا يعتمد على كثرة نشاط واحد فقط.</p></div><span className="achievement-score-pill">{fmt(row.score)} / 100</span></div>
      <div className="achievement-dimensions">
        {dimensions.map(d=>{
          const value=Number(row[d.key]||0);
          return <article key={d.key}>
            <div className="achievement-dimension-head"><div><b>{d.label}</b><small>{d.detail(row)}</small></div><strong>{fmt(value)}<em>/{d.max}</em></strong></div>
            <div className="achievement-track"><span style={{width:Math.min(100,(value/d.max)*100)+"%"}}/></div>
          </article>
        })}
      </div>
    </section>
  </>;
}

function AdminLeaderboard({data}:{data:AchievementData}){
  const[q,setQ]=useState("");
  const rows=useMemo(()=>{
    const needle=q.trim().toLowerCase();
    return (data.leaderboard||[]).filter(x=>!needle||x.teacher_name.toLowerCase().includes(needle)||String(x.subject_name||"").toLowerCase().includes(needle));
  },[data.leaderboard,q]);
  const top=(data.leaderboard||[]).slice(0,3);

  return <>
    <section className="achievement-admin-summary">
      <article><small>المعلمون</small><strong>{fmt(data.total_teachers)}</strong><span>ضمن دليل الهيئة</span></article>
      <article><small>نشط هذا الشهر</small><strong>{fmt(data.active_teachers)}</strong><span>{data.total_teachers?Math.round((data.active_teachers/data.total_teachers)*100):0}% من المعلمين</span></article>
      <article><small>متوسط المؤشر</small><strong>{fmt(data.average_score)}</strong><span>من 100</span></article>
      <article><small>السجلات المنجزة</small><strong>{fmt(data.total_activities)}</strong><span>عبر الوحدات المحتسبة</span></article>
    </section>

    {top.length>0&&<section className="achievement-podium">
      {top.map(x=><article key={x.staff_id} className={"achievement-podium-card place-"+x.rank}>
        <RankMedal rank={x.rank}/>
        <div><h3>{x.teacher_name}</h3><p>{x.subject_name}</p></div>
        <strong>{fmt(x.score)}<small>/100</small></strong>
        <span>{fmt(x.active_days)} أيام نشاط · {fmt(x.total_activities)} سجل</span>
      </article>)}
    </section>}

    <section className="panel achievement-table-panel">
      <div className="panel-title achievement-table-title">
        <div><h3>ترتيب إنجاز المعلمين</h3><p>يُحدّث تلقائيًا من السجلات الفعلية داخل بنك التميز.</p></div>
        <input className="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث باسم المعلم أو التخصص"/>
      </div>
      <div className="table-wrap"><table className="achievement-table"><thead><tr>
        <th>الترتيب</th><th>المعلم</th><th>المؤشر</th><th>أيام النشاط</th><th>شيكات</th><th>متابعة</th><th>تقييمات</th><th>مبادرات</th><th>تحويلات</th><th>الحساب</th>
      </tr></thead><tbody>
        {rows.map(x=><tr key={x.staff_id}>
          <td><RankMedal rank={x.rank}/></td>
          <td><b>{x.teacher_name}</b><small className="achievement-subject">{x.subject_name}</small></td>
          <td><div className="achievement-table-score"><strong>{fmt(x.score)}</strong><div className="achievement-track"><span style={{width:Math.min(100,x.score)+"%"}}/></div></div></td>
          <td>{fmt(x.active_days)}</td>
          <td>{fmt(x.checks_count)}</td>
          <td>{fmt(x.followup_count)}</td>
          <td>{fmt(x.evaluations_count)}</td>
          <td>{fmt(x.behavioral_count+x.khameesna_count)}</td>
          <td>{fmt(x.referrals_count)}</td>
          <td><span className={x.account_ready?"achievement-account ready":"achievement-account pending"}>{x.account_ready?"مفعّل":"غير مرتبط"}</span></td>
        </tr>)}
        {!rows.length&&<tr><td colSpan={10} className="achievement-empty">لا توجد نتائج مطابقة.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}

export default function TeacherAchievementStats({roles}:{roles:string[]}){
  const[data,setData]=useState<AchievementData|null>(null);
  const[error,setError]=useState("");
  const[busy,setBusy]=useState(false);
  const isTeacher=roles.includes("TEACHER");

  async function load(){
    setBusy(true);setError("");
    try{
      const next=await rpc<AchievementData>("api_teacher_achievement_stats");
      if(next?.denied)throw new Error("لا توجد صلاحية لعرض إحصائيات المعلمين.");
      setData(next);
    }catch(e){setError(niceError(e))}
    finally{setBusy(false)}
  }

  useEffect(()=>{void load()},[]);

  return <><header className="topbar"><div><h1>{isTeacher?"إنجازي وترتيبي":"إحصائيات إنجاز المعلمين"}</h1><p>مؤشر شهري متوازن مبني على الأنشطة المسجلة فعليًا داخل النظام</p></div><div className="header-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div></header>
    <main className="content achievement-page">
      <section className="achievement-period-bar"><div><b>الفترة الحالية</b><span>{data?dateLabel(data.period_start)+" — "+dateLabel(data.period_end):"الشهر الحالي"}</span></div><button className="mini-btn" type="button" onClick={load} disabled={busy}>{busy?"جارٍ التحديث...":"تحديث الإحصائيات"}</button></section>
      {error&&<div className="notice error">{error}</div>}
      {!data&&!error&&<section className="panel achievement-loading">جارٍ حساب مؤشر الإنجاز...</section>}
      {data&&isTeacher&&data.mine&&<MyAchievement row={data.mine} total={data.total_teachers}/>}
      {data&&isTeacher&&!data.mine&&<section className="panel"><p>لم يتم العثور على ربط حسابك بسجل معلم في دليل الهيئة. راجع إدارة النظام.</p></section>}
      {data&&data.can_view_all&&<AdminLeaderboard data={data}/>}
      {data&&<section className="panel achievement-method">
        <div><h3>كيف يُحسب مؤشر الإنجاز؟</h3><p>المؤشر لا يعتمد على مجموع النقاط الممنوحة للطلاب. لكل مجال سقف محدد لمنع نشاط واحد كثيف من السيطرة على الترتيب، وتُحتسب الاستمرارية بعدد أيام النشاط المختلفة.</p></div>
        <div className="achievement-method-grid">{dimensions.map(d=><span key={d.key}><b>{d.max} نقطة</b><small>{d.label}</small></span>)}</div>
      </section>}
    </main>
  </>;
}
