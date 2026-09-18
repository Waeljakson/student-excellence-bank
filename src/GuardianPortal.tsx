import {useEffect,useState} from "react";
import {neon,niceError,rpc} from "./client";
import "./guardian-portal.css";

type Child={id:string;student_no:string;name:string;grade_name:string;class_name:string;points:number;notes:any[];periodic_evaluations:any[];individual_evaluations:any[];competitions:any[]};

export default function GuardianPortal({token}:{token?:string}){
  const[data,setData]=useState<any>(null);
  const[error,setError]=useState("");
  const[childId,setChildId]=useState("");
  const[tab,setTab]=useState<"overview"|"followup"|"periodic"|"individual"|"competitions">("overview");
  const linkMode=!!token;

  useEffect(()=>{
    const request=linkMode
      ?rpc<any>("api_guardian_portal_by_token",{p_token:token})
      :rpc<any>("api_guardian_portal");
    request.then(d=>{setData(d);setChildId(d.children?.[0]?.id||"")}).catch(e=>setError(niceError(e)));
  },[token,linkMode]);

  function leave(){
    if(linkMode){window.location.href=import.meta.env.BASE_URL;return}
    void neon.auth.signOut();
  }

  if(error)return <div className="full-center"><div className="pending-card"><h1>تعذر تحميل حساب ولي الأمر</h1><p>{error.includes("GUARDIAN_LINK_INVALID")?"رابط ولي الأمر غير صالح أو تم إيقافه. اطلب رابطًا جديدًا من المدرسة.":error}</p><button className="btn ghost" onClick={leave}>{linkMode?"العودة للرئيسية":"تسجيل الخروج"}</button></div></div>;
  if(!data)return <div className="full-center"><div className="loader"/><p>جارٍ تحميل بيانات الأبناء...</p></div>;

  const children:Child[]=data.children||[];
  const c=children.find(x=>x.id===childId)||children[0];

  return <div className="guardian-portal">
    <header className="guardian-head">
      <div><span>مدارس المشكاة الأهلية</span><h1>بوابة ولي الأمر</h1><p>{data.guardian?.name}</p>{linkMode&&<small>دخول مباشر بالرابط الخاص</small>}</div>
      <button className="btn ghost" onClick={leave}>{linkMode?"إغلاق البوابة":"تسجيل الخروج"}</button>
    </header>
    <main className="guardian-content">
      {children.length>1&&<select value={c?.id||""} onChange={e=>setChildId(e.target.value)}>{children.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>}
      {!children.length&&<section className="portal-panel"><div className="empty">لا يوجد أبناء مرتبطون بهذا الحساب حاليًا.</div></section>}
      {c&&<>
        <section className="guardian-student-card"><div><h2>{c.name}</h2><p>{c.grade_name} — فصل {c.class_name} · رقم الطالب {c.student_no}</p></div><div><small>نقاط التميز</small><strong>{Number(c.points||0).toLocaleString("ar-SA")}</strong></div></section>
        <nav className="guardian-tabs">
          <button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}>الرئيسية</button>
          <button className={tab==="followup"?"active":""} onClick={()=>setTab("followup")}>دفتر المتابعة</button>
          <button className={tab==="periodic"?"active":""} onClick={()=>setTab("periodic")}>التقييمات الدورية</button>
          <button className={tab==="individual"?"active":""} onClick={()=>setTab("individual")}>تقارير التقييم</button>
          <button className={tab==="competitions"?"active":""} onClick={()=>setTab("competitions")}>المسابقات</button>
        </nav>
        {tab==="overview"&&<section className="portal-panel"><h3>ملخص الطالب</h3><div className="guardian-summary"><article><span>نقاط التميز</span><b>{c.points}</b></article><article><span>ملاحظات المتابعة</span><b>{c.notes.length}</b></article><article><span>التقييمات الدورية</span><b>{c.periodic_evaluations.length}</b></article><article><span>المسابقات</span><b>{c.competitions.length}</b></article></div></section>}
        {tab==="followup"&&<section className="portal-panel"><h3>دفتر متابعة الطالب</h3>{c.notes.length?c.notes.map(n=><article className={`guardian-note ${n.note_kind?.toLowerCase()}`} key={n.id}><div><b>{n.subject_ar}</b><span>{n.category_ar||"ملاحظة"}</span></div><p>{n.note_text}</p><small>{new Date(n.note_date).toLocaleDateString("ar-SA")} · {n.teacher_name}</small></article>):<div className="empty">لا توجد ملاحظات حتى الآن.</div>}</section>}
        {tab==="periodic"&&<section className="portal-panel"><h3>التقييمات الدورية المنشورة</h3>{c.periodic_evaluations.length?c.periodic_evaluations.map((e:any,i:number)=><article className="guardian-eval" key={i}><h4>{e.cycle_title} — {e.subject_ar}</h4><p><b>تحصيلي:</b> {e.academic_rating}</p><p><b>سلوكي:</b> {e.behavior_rating}</p>{e.notes&&<p>{e.notes}</p>}<small>{e.teacher_name}</small></article>):<div className="empty">لا توجد تقييمات دورية منشورة.</div>}</section>}
        {tab==="individual"&&<section className="portal-panel"><h3>تقارير التقييم المرسلة لولي الأمر</h3>{c.individual_evaluations.length?c.individual_evaluations.map((r:any)=><article className="guardian-eval" key={r.report_id}><h4>{r.report_no}</h4>{r.responses?.map((x:any,i:number)=><div key={i}><b>{x.subject_ar} — {x.teacher_name}</b><p>تحصيلي: {x.academic_rating} · سلوكي: {x.behavior_rating}</p>{x.notes&&<p>{x.notes}</p>}</div>)}{r.vice_principal_opinion&&<p><b>رأي الوكيل:</b> {r.vice_principal_opinion}</p>}{r.guidance_opinion&&<p><b>رأي الموجه:</b> {r.guidance_opinion}</p>}</article>):<div className="empty">لا توجد تقارير مرسلة.</div>}</section>}
        {tab==="competitions"&&<section className="portal-panel"><h3>المسابقات المشترك فيها</h3>{c.competitions.length?c.competitions.map((x:any)=><article className="guardian-eval" key={x.id}><h4>{x.name_ar}</h4><p>{x.description_ar}</p>{x.reward_text_ar&&<small>المكافأة: {x.reward_text_ar}</small>}</article>):<div className="empty">الطالب غير مشترك في مسابقات حاليًا.</div>}</section>}
      </>}
    </main>
  </div>;
}
