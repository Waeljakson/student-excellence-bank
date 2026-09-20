import {useEffect,useState} from "react";
import {neon,niceError,rpc} from "./client";
import "./guardian-portal.css";

type Note={id:string;subject_ar?:string;note_kind?:string;category_ar?:string;note_text:string;note_date:string;teacher_name?:string};
type Child={id:string;student_no:string;name:string;grade_name:string;class_name:string;points:number;notes:Note[];periodic_evaluations:any[];individual_evaluations:any[];competitions:any[]};

function riyadhDay(){
  const now=new Date();
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const get=(t:string)=>parts.find(x=>x.type===t)?.value||"";
  const key=`${get("year")}-${get("month")}-${get("day")}`;
  const weekday=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",weekday:"short"}).format(now);
  return {key,weekday};
}

function DailyFollowup({child}:{child:Child}){
  const {key,weekday}=riyardDayFix();
  if(weekday==="Fri"||weekday==="Sat")return null;
  const notes=(child.notes||[]).filter(n=>String(n.note_date||"").slice(0,10)===key);
  const positive=notes.filter(n=>String(n.note_kind).toUpperCase()==="POSITIVE");
  const negative=notes.filter(n=>String(n.note_kind).toUpperCase()==="NEGATIVE");
  const general=notes.filter(n=>!["POSITIVE","NEGATIVE"].includes(String(n.note_kind).toUpperCase()));
  const thursday=weekday==="Thu";

  let title="متابعة اليوم";
  let body="";
  let advice:string[]=[];
  let tone="calm";
  if(!notes.length){
    title="اليوم الدراسي سار بصورة طيبة";
    body="الحمد لله، لم تُسجَّل اليوم أي ملاحظات تستدعي المتابعة على ابنكم. نأمل استمرار هذا الالتزام، وكلمة تشجيع بسيطة منكم تساعده على الحفاظ على هذا المستوى.";
    advice=["اسأله عن أفضل شيء أنجزه اليوم.","أثنِ على التزامه واستمراره حتى لو لم توجد مكافأة مادية.","شجعه على تكرار السلوك الجيد غدًا."];
  }else if(positive.length&&negative.length){
    tone="mixed";
    title="يوم فيه نقاط إيجابية وفرص للتحسن";
    body=`سُجلت اليوم ${positive.length} ملاحظة إيجابية و${negative.length} ملاحظة تحتاج متابعة. الأفضل تعزيز ما أحسن فيه ابنكم، ثم مناقشة الملاحظة الأخرى بهدوء والتركيز على السلوك المطلوب بدل اللوم.`;
    advice=["ابدأ بالإيجابي واذكره بوضوح حتى يعرف ما الذي نجح فيه.","استمع لوجهة نظره في الملاحظة السلبية بدون مقاطعة.","اتفقوا على خطوة محددة يتصرف بها بشكل أفضل في المرة القادمة.","تابع معه غدًا وشجّع أي تحسن ولو كان بسيطًا."];
  }else if(positive.length){
    tone="positive";
    title="خبر جميل عن ابنكم اليوم";
    body=`سُجلت لابنكم اليوم ${positive.length} ملاحظة إيجابية من معلميه. هذا وقت مناسب لتعزيز السلوك الجميل وربطه بالاستمرار، وليس فقط بالمكافأة.`;
    advice=["امدحه على السلوك المحدد الذي تميز فيه، وليس بعبارة عامة فقط.","اسأله كيف استطاع أن ينجح اليوم حتى يكرر نفس الخطوات.","قدّم مكافأة بسيطة مناسبة: وقت مفضل، نشاط يحبه، أو كلمة تقدير أمام الأسرة.","ذكّره أن التميز الحقيقي هو الاستمرار."];
  }else if(negative.length){
    tone="negative";
    title="ملاحظة اليوم تحتاج متابعة هادئة";
    body=`وردت اليوم ${negative.length} ملاحظة تحتاج إلى متابعة. الهدف هو مساعدة ابنكم على فهم ما حدث وتصحيح السلوك، وليس تحويل الموقف إلى مواجهة أو عقوبة مبالغ فيها.`;
    advice=["ابدأ بالسؤال والاستماع قبل إصدار الحكم.","ناقش السلوك نفسه بدون وصف الطالب بصفة سلبية.","اسأله: ما التصرف الأفضل الذي كان يمكن عمله؟","اتفقوا على خطوة عملية لليوم التالي، ثم تابعوا التحسن بهدوء.","إذا تكررت الملاحظة، تواصل مع المدرسة لمعرفة الصورة كاملة."];
  }else{
    tone="general";
    title="تنبيه أو معلومة عامة";
    body=general.length===1
      ?"وردت اليوم ملاحظة عامة من أحد المعلمين. يمكنكم الاطلاع على تفاصيلها في دفتر المتابعة."
      :`وردت اليوم ${general.length} ملاحظات عامة من المعلمين. يمكنكم الاطلاع على تفاصيلها في دفتر المتابعة.`;
    advice=[];
  }

  return <section className={`parent-daily-card ${tone}`}>
    <div className="parent-daily-head"><div><span>متابعة اليوم</span><h3>{title}</h3></div><b>{new Date().toLocaleDateString("ar-SA",{timeZone:"Asia/Riyadh"})}</b></div>
    <p>{body}</p>
    {advice.length>0&&<div className="parent-advice"><b>كيف تتعامل اليوم؟</b><ul>{advice.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
    {thursday&&<div className="weekend-wish">نتمنى لكم ولأسرتكم ويكند سعيدًا ووقتًا جميلًا مع أبنائكم.</div>}
  </section>;
}

function riyardDayFix(){return riyadhDay()}

function guardianRatingLabel(value?:string|null){
  const key=String(value||"").trim().toUpperCase();
  return ({
    EXCELLENT:"ممتاز",
    VERY_GOOD:"جيد جدًا",
    GOOD:"جيد",
    WEAK:"ضعيف"
  } as Record<string,string>)[key]||(!value?"لم يقيّم":String(value));
}

function guardianSubjectLabel(value?:string|null){
  const v=String(value||"").trim();
  if(v==="E")return "لغة إنجليزية";
  if(v==="بدنية")return "التربية البدنية";
  if(v==="فنية")return "التربية الفنية";
  return v||"—";
}

function FollowupTimeline({notes}:{notes:Note[]}){
  const today=riyardDayFix().key;
  const days=Array.from(new Set((notes||[]).map(n=>String(n.note_date||"").slice(0,10)).filter(Boolean))).sort((a,b)=>b.localeCompare(a));
  const initial=days.includes(today)?today:(days[0]||"");
  const[selectedDay,setSelectedDay]=useState(initial);

  useEffect(()=>{
    const next=days.includes(today)?today:(days[0]||"");
    setSelectedDay(current=>current&&days.includes(current)?current:next);
  },[today,days.join("|")]);

  if(!days.length)return <div className="empty">لا توجد ملاحظات مسجلة حتى الآن.</div>;

  const notesForDay=notes.filter(n=>String(n.note_date||"").slice(0,10)===selectedDay);
  const yesterdayDate=new Date();
  yesterdayDate.setDate(yesterdayDate.getDate()-1);
  const yesterday=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(yesterdayDate);

  function dayLabel(day:string){
    if(day===today)return "اليوم";
    if(day===yesterday)return "أمس";
    const d=new Date(`${day}T12:00:00+03:00`);
    return new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",weekday:"short",day:"numeric",month:"short"}).format(d);
  }

  return <div className="guardian-followup-timeline">
    <div className="guardian-followup-days" role="tablist" aria-label="أيام ملاحظات المتابعة">
      {days.map(day=>{
        const count=notes.filter(n=>String(n.note_date||"").slice(0,10)===day).length;
        return <button key={day} type="button" role="tab" aria-selected={selectedDay===day} className={selectedDay===day?"active":""} onClick={()=>setSelectedDay(day)}>
          <span>{dayLabel(day)}</span><b>{count}</b>
        </button>;
      })}
    </div>
    <div className="guardian-followup-day-head"><div><span>ملاحظات هذا اليوم</span><strong>{dayLabel(selectedDay)}</strong></div><small>{notesForDay.length} {notesForDay.length===1?"ملاحظة":"ملاحظات"}</small></div>
    <div className="guardian-followup-day-notes">
      {notesForDay.map(n=><article className={`guardian-note ${String(n.note_kind||"general").toLowerCase()}`} key={n.id}>
        <div><b>{n.subject_ar||"متابعة"}</b><span>{n.category_ar||"ملاحظة"}</span></div>
        <p>{n.note_text}</p>
        <small>{n.teacher_name||"المعلم"}</small>
      </article>)}
    </div>
  </div>;
}

export default function GuardianPortal({token,studentNo,initialData}:{token?:string;studentNo?:string;initialData?:any}){
  const[data,setData]=useState<any>(null);
  const[error,setError]=useState("");
  const[childId,setChildId]=useState("");
  const[tab,setTab]=useState<"overview"|"followup"|"periodic"|"individual"|"competitions">("overview");
  const tokenMode=!!token;
  const identityMode=!!studentNo;

  useEffect(()=>{
    if(initialData){setData(initialData);setChildId(initialData.children?.[0]?.id||"");return}
    const request=identityMode
      ?rpc<any>("api_guardian_lookup",{p_mobile:studentNo}).then(x=>{
          if(!x?.exists||x?.source!=="student_no"||!x?.portal)throw new Error("STUDENT_NOT_FOUND");
          return x.portal;
        })
      :tokenMode
        ?rpc<any>("api_guardian_portal_by_token",{p_token:token})
        :rpc<any>("api_guardian_portal");
    request.then(d=>{setData(d);setChildId(d.children?.[0]?.id||"")}).catch(e=>setError(niceError(e)));
  },[token,studentNo,tokenMode,identityMode,initialData]);

  function leave(){
    if(tokenMode||identityMode){window.location.href=import.meta.env.BASE_URL+"?parent=1";return}
    void neon.auth.signOut();
  }

  if(error)return <div className="full-center"><div className="pending-card"><h1>تعذر تحميل حساب ولي الأمر</h1><p>{error.includes("GUARDIAN_LINK_INVALID")?"رابط ولي الأمر غير صالح أو تم إيقافه.":error.includes("STUDENT_NOT_FOUND")?"لم يتم العثور على طالب بهذا الرقم.":"تعذر تحميل بيانات الطالب."}</p><button className="btn ghost" onClick={leave}>العودة لبوابة ولي الأمر</button></div></div>;
  if(!data)return <div className="full-center"><div className="loader"/><p>جارٍ تحميل بيانات الطالب...</p></div>;

  const children:Child[]=data.children||[];
  const c=children.find(x=>x.id===childId)||children[0];

  return <div className="guardian-portal">
    <header className="guardian-head">
      <div className="guardian-school-brand">
        <div className="guardian-school-logos"><img src={`${import.meta.env.BASE_URL}school-logo.png`} alt="شعار المدرسة"/><img src={`${import.meta.env.BASE_URL}guidance-logo.png`} alt="شعار التوجيه الطلابي"/></div>
        <div><span>متوسطة وثانوية مشكاة الشعلة</span><h1>بوابة ولي الأمر</h1><p>{c?.name||data.guardian?.name}</p>{identityMode&&<small>دخول برقم هوية / رقم الطالب بدون كلمة مرور</small>}</div>
      </div>
      <button className="btn ghost" onClick={leave}>{identityMode||tokenMode?"تغيير الطالب":"تسجيل الخروج"}</button>
    </header>
    <main className="guardian-content">
      {children.length>1&&<select value={c?.id||""} onChange={e=>setChildId(e.target.value)}>{children.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>}
      {!children.length&&<section className="portal-panel"><div className="empty">لا يوجد طالب مرتبط بهذه البيانات حاليًا.</div></section>}
      {c&&<>
        <section className="guardian-student-card"><div><h2>{c.name}</h2><p>{c.grade_name} — فصل {c.class_name} · رقم الطالب {c.student_no}</p></div><div><small>نقاط التميز</small><strong>{Number(c.points||0).toLocaleString("ar-SA")}</strong></div></section>
        <DailyFollowup child={c}/>
        <nav className="guardian-tabs">
          <button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}>الرئيسية</button>
          <button className={tab==="followup"?"active":""} onClick={()=>setTab("followup")}>دفتر المتابعة</button>
          <button className={tab==="periodic"?"active":""} onClick={()=>setTab("periodic")}>التقييمات الدورية</button>
          <button className={tab==="individual"?"active":""} onClick={()=>setTab("individual")}>تقارير التقييم</button>
          <button className={tab==="competitions"?"active":""} onClick={()=>setTab("competitions")}>المسابقات</button>
        </nav>
        {tab==="overview"&&<section className="portal-panel"><h3>ملخص الطالب</h3><div className="guardian-summary"><article><span>نقاط التميز</span><b>{c.points}</b></article><article><span>ملاحظات المتابعة</span><b>{c.notes.length}</b></article><article><span>التقييمات الدورية</span><b>{c.periodic_evaluations.length}</b></article><article><span>المسابقات</span><b>{c.competitions.length}</b></article></div></section>}
        {tab==="followup"&&<section className="portal-panel"><div className="guardian-followup-title"><div><h3>دفتر متابعة الطالب</h3><p>الملاحظات مرتبة يوميًا لسهولة المتابعة المستمرة.</p></div></div><FollowupTimeline notes={c.notes||[]}/></section>}
        {tab==="periodic"&&<section className="portal-panel"><div className="guardian-eval-title"><h3>التقييمات الدورية المنشورة</h3><p>عرض عربي منظم للتقييم التحصيلي والسلوكي.</p></div>{c.periodic_evaluations.length?<div className="guardian-eval-table-wrap"><table className="guardian-eval-table"><thead><tr><th>الفترة</th><th>المادة</th><th>التقييم التحصيلي</th><th>التقييم السلوكي</th><th>ملاحظات المعلم</th><th>المعلم</th></tr></thead><tbody>{c.periodic_evaluations.map((e:any,i:number)=><tr key={i}><td>{e.cycle_title||"—"}</td><td>{guardianSubjectLabel(e.subject_ar)}</td><td><span className="guardian-rating-badge">{guardianRatingLabel(e.academic_rating)}</span></td><td><span className="guardian-rating-badge">{guardianRatingLabel(e.behavior_rating)}</span></td><td className="guardian-eval-notes">{e.notes||"—"}</td><td>{e.teacher_name||"—"}</td></tr>)}</tbody></table></div>:<div className="empty">لا توجد تقييمات دورية منشورة.</div>}</section>}
        {tab==="individual"&&<section className="portal-panel"><div className="guardian-eval-title"><h3>تقارير التقييم المرسلة لولي الأمر</h3><p>تفاصيل كل تقرير معروضة بالعربية في جدول موحد.</p></div>{c.individual_evaluations.length?c.individual_evaluations.map((r:any)=><article className="guardian-report-card" key={r.report_id}><div className="guardian-report-head"><div><span>رقم التقرير</span><strong>{r.report_no||"—"}</strong></div></div><div className="guardian-eval-table-wrap"><table className="guardian-eval-table"><thead><tr><th>المادة</th><th>المعلم</th><th>التقييم التحصيلي</th><th>التقييم السلوكي</th><th>ملاحظات المعلم</th></tr></thead><tbody>{(r.responses||[]).map((x:any,i:number)=><tr key={i}><td>{guardianSubjectLabel(x.subject_ar)}</td><td>{x.teacher_name||"—"}</td><td><span className="guardian-rating-badge">{guardianRatingLabel(x.academic_rating)}</span></td><td><span className="guardian-rating-badge">{guardianRatingLabel(x.behavior_rating)}</span></td><td className="guardian-eval-notes">{x.notes||"—"}</td></tr>)}</tbody></table></div>{(r.vice_principal_opinion||r.guidance_opinion)&&<div className="guardian-report-opinions">{r.vice_principal_opinion&&<div><b>رأي وكيل المدرسة</b><p>{r.vice_principal_opinion}</p></div>}{r.guidance_opinion&&<div><b>رأي الموجه الطلابي</b><p>{r.guidance_opinion}</p></div>}</div>}</article>):<div className="empty">لا توجد تقارير مرسلة.</div>}</section>}
        {tab==="competitions"&&<section className="portal-panel"><h3>المسابقات المشترك فيها</h3>{c.competitions.length?c.competitions.map((x:any)=><article className="guardian-eval" key={x.id}><h4>{x.name_ar}</h4><p>{x.description_ar}</p>{x.reward_text_ar&&<small>المكافأة: {x.reward_text_ar}</small>}</article>):<div className="empty">الطالب غير مشترك في مسابقات حاليًا.</div>}</section>}
      </>}
    </main>
  </div>;
}
