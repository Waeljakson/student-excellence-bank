import {useEffect,useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import "./assessments.css";

const riskClass=(x?:string|null)=>x==="VERY_HIGH"?"danger":x==="HIGH"?"warn":x==="WATCH"?"watch":"good";
const labels:Record<string,string>={VERY_HIGH:"مرتفعة جدًا",HIGH:"مرتفعة",WATCH:"تستحق الانتباه",LOW:"منخفضة"};
const n=(v:any)=>v==null?"—":Number(v).toLocaleString("ar-SA",{maximumFractionDigits:1});
const toInput=(v?:string|null)=>{if(!v)return "";const d=new Date(v);const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16)};
const fmt=(v?:string|null)=>v?new Date(v).toLocaleString("ar-SA",{dateStyle:"medium",timeStyle:"short"}):"—";

export default function AssessmentAdmin({schoolName}:{schoolName:string}){
 const[data,setData]=useState<any>(null),[scaleId,setScaleId]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[risk,setRisk]=useState("ALL"),[grade,setGrade]=useState("ALL"),[query,setQuery]=useState("");
 const[opensAt,setOpensAt]=useState(""),[closesAt,setClosesAt]=useState("");
 async function load(id=scaleId){setBusy(true);try{const d=await rpc<any>("api_assessment_admin_data",id?{p_scale_id:id}:{});setData(d);if(!id&&d.selected_scale?.id)setScaleId(d.selected_scale.id);setError("")}catch(e){setError(niceError(e))}finally{setBusy(false)}}
 useEffect(()=>{void load("")},[]);
 const sc=data?.selected_scale,s=data?.summary;
 useEffect(()=>{setOpensAt(toInput(sc?.opens_at));setClosesAt(toInput(sc?.closes_at))},[sc?.id,sc?.opens_at,sc?.closes_at]);

 async function action(a:string){
  if(!sc)return;setBusy(true);setMessage("");setError("");
  try{
   await rpc("api_assessment_set_state",{p_scale_id:sc.id,p_action:a});
   await load(sc.id);
   setMessage(a==="DRAFT"?"تم إلغاء الجدولة وإعادة المقياس إلى مسودة غير منشورة.":a==="CLOSE"?"تم إغلاق المقياس.":a==="PUBLISH_RESULTS"?"تم اعتماد ونشر النتائج لولي الأمر والطالب.":a==="UNPUBLISH_RESULTS"?"تم إخفاء النتائج.":"تم تحديث حالة المقياس.");
  }catch(e){setError(niceError(e))}finally{setBusy(false)}
 }
 async function saveSchedule(){
  if(!sc)return;
  setError("");setMessage("");
  if(!opensAt||!closesAt){setError("حدد تاريخ ووقت النشر وتاريخ ووقت الإغلاق.");return}
  const openDate=new Date(opensAt),closeDate=new Date(closesAt);
  if(Number.isNaN(openDate.getTime())||Number.isNaN(closeDate.getTime())){setError("صيغة الموعد غير صحيحة.");return}
  if(closeDate<=openDate){setError("وقت الإغلاق يجب أن يكون بعد وقت النشر.");return}
  setBusy(true);
  try{
   await rpc("api_assessment_set_state",{p_scale_id:sc.id,p_action:`SCHEDULE|${openDate.toISOString()}|${closeDate.toISOString()}`});
   await load(sc.id);
   setMessage("تم حفظ الجدولة. سيظهر المقياس للطلاب تلقائيًا عند وقت النشر ويوقف استقبال الإجابات تلقائيًا عند وقت الإغلاق.");
  }catch(e){const m=niceError(e);setError(m.includes("ASSESSMENT_SCHEDULE")?"تعذر حفظ الجدولة. راجع وقت النشر والإغلاق.":m)}finally{setBusy(false)}
 }

 const grades=useMemo(()=>[...new Set<string>((data?.students||[]).map((x:any)=>x.grade_name))],[data]);
 const rows=useMemo(()=>(data?.students||[]).filter((x:any)=>x.status==="SUBMITTED"&&(risk==="ALL"||x.risk_code===risk)&&(grade==="ALL"||x.grade_name===grade)&&(!query||String(x.student_name+" "+x.student_no).includes(query))),[data,risk,grade,query]);
 const now=Date.now(),openMs=sc?.opens_at?new Date(sc.opens_at).getTime():0,closeMs=sc?.closes_at?new Date(sc.closes_at).getTime():0;
 const scheduled=sc?.status==="OPEN"&&openMs>now;
 const active=sc?.status==="OPEN"&&(!openMs||openMs<=now)&&(!closeMs||closeMs>=now);
 const elapsed=sc?.status==="OPEN"&&!!closeMs&&closeMs<now;
 const stateLabel=sc?.status==="DRAFT"?"مسودة غير منشورة":scheduled?"مجدول للنشر":active?"منشور للطلاب":elapsed?"انتهت فترة الإجابة":sc?.status==="CLOSED"?"مغلق":"—";
 const canSchedule=sc?.status==="DRAFT"||scheduled;

 function csv(){const a=[["رقم الطالب","اسم الطالب","الصف","الفصل","النسبة","المستوى"],...rows.map((x:any)=>[x.student_no,x.student_name,x.grade_name,x.class_name,x.score_pct,x.risk_label_ar])];const blob=new Blob(["\ufeff"+a.map(r=>r.map((v:any)=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n")],{type:"text/csv;charset=utf-8"});const u=URL.createObjectURL(blob),el=document.createElement("a");el.href=u;el.download="نتائج-المقاييس.csv";el.click();URL.revokeObjectURL(u)}

 return <div className="assessment-shell assessment-admin" dir="rtl">
  <header className="assessment-title admin"><div><span>بنك التميز</span><h1>المقاييس والنتائج</h1><p>{schoolName} — إعداد المقاييس وجدولتها ومتابعة النتائج.</p></div><label>المقياس<select value={scaleId} onChange={e=>{setScaleId(e.target.value);void load(e.target.value)}}>{(data?.scales||[]).map((x:any)=><option key={x.id} value={x.id}>{x.short_title_ar}</option>)}</select></label></header>
  {error&&<div className="notice error">{error}</div>}{message&&<div className="notice">{message}</div>}
  {sc&&<>
   <section className="panel admin-head"><div><h2>🎮 {sc.short_title_ar}</h2><p>الحالة: <b>{stateLabel}</b> · النتائج: <b>{sc.results_published_at?"منشورة":"غير منشورة"}</b></p>{sc.opens_at&&<small>النشر: {fmt(sc.opens_at)} · الإغلاق: {fmt(sc.closes_at)}</small>}</div><div>{scheduled&&<button className="btn ghost" disabled={busy} onClick={()=>void action("DRAFT")}>إلغاء الجدولة</button>}{active&&<button className="btn secondary" disabled={busy} onClick={()=>void action("CLOSE")}>إغلاق الآن</button>}{elapsed&&<button className="btn secondary" disabled={busy} onClick={()=>void action("CLOSE")}>اعتماد انتهاء المدة</button>}{sc.status==="CLOSED"&&!sc.results_published_at&&<button className="btn primary" disabled={busy||!s?.submitted_count} onClick={()=>void action("PUBLISH_RESULTS")}>اعتماد ونشر النتائج</button>}{sc.results_published_at&&<button className="btn ghost" disabled={busy} onClick={()=>void action("UNPUBLISH_RESULTS")}>إخفاء النتائج</button>}</div></section>

   {canSchedule&&<section className="panel assessment-schedule">
    <div className="schedule-copy"><span>التحكم في النشر</span><h3>{sc.status==="DRAFT"?"المقياس جاهز كمسودة — أنت تحدد موعد ظهوره":"تعديل موعد النشر والإغلاق"}</h3><p>لن يظهر المقياس لأي طالب قبل وقت النشر المحدد. ويتوقف استقبال الإجابات تلقائيًا عند وقت الإغلاق.</p></div>
    <div className="schedule-fields">
     <label><span>تاريخ ووقت النشر</span><input type="datetime-local" value={opensAt} onChange={e=>setOpensAt(e.target.value)}/></label>
     <label><span>تاريخ ووقت الإغلاق</span><input type="datetime-local" value={closesAt} onChange={e=>setClosesAt(e.target.value)}/></label>
     <button className="btn primary" disabled={busy} onClick={()=>void saveSchedule()}>{scheduled?"حفظ تعديل الجدولة":"حفظ الجدولة"}</button>
    </div>
   </section>}

   <section className="assessment-kpis"><K icon="👥" v={s?.eligible_students} t="الطلاب المستهدفون"/><K icon="✅" v={s?.submitted_count} t="أتموا المقياس"/><K icon="⏳" v={s?.pending_count} t="لم يرسلوا بعد"/><K icon="📊" v={n(s?.completion_pct)+"%"} t="نسبة المشاركة"/><K icon="🎯" v={n(s?.average_score_pct)+"%"} t="متوسط المؤشر"/><K icon="⚠️" v={s?.high_attention_count} t="بحاجة لاهتمام أعلى"/><K icon="🙋" v={s?.help_requested_count} t="طلبوا مساعدة"/></section>

   <div className="admin-grid"><section className="panel"><h3>توزيع مستويات المؤشر</h3>{["VERY_HIGH","HIGH","WATCH","LOW"].map(c=>{const count=Number(s?.risk_counts?.[c]||0),p=s?.submitted_count?count*100/s.submitted_count:0;return <div className="risk-row" key={c}><p><span className={"risk-pill "+riskClass(c)}>{labels[c]}</span><b>{count}</b></p><i><b style={{width:String(p)+"%"}}/></i></div>})}</section><section className="panel"><h3>أكثر المحاور تأثرًا</h3><div className="axis-list">{(data?.axis_averages||[]).map((a:any)=><div key={a.axis_key}><p><b>{a.title}</b><span>{n(a.avg_pct)}%</span></p><i><b style={{width:String(a.avg_pct)+"%"}}/></i></div>)}</div></section></div>

   <section className="panel"><h3>المشاركة حسب الصف</h3><div className="table-wrap"><table className="assessment-table"><thead><tr><th>الصف</th><th>المستهدف</th><th>أتموا</th><th>المشاركة</th><th>متوسط المؤشر</th></tr></thead><tbody>{(data?.grade_stats||[]).map((g:any)=><tr key={g.grade_name}><td><b>{g.grade_name}</b></td><td>{g.eligible}</td><td>{g.submitted}</td><td>{n(g.completion_pct)}%</td><td>{n(g.avg_score_pct)}%</td></tr>)}</tbody></table></div></section>

   <section className="panel"><div className="panel-row"><div><h3>نتائج الطلاب</h3><p>للاستخدام الإداري وتحديد من يحتاج دعمًا.</p></div><button className="btn ghost" onClick={csv}>تصدير CSV</button></div><div className="assessment-filters"><input placeholder="بحث بالاسم أو الرقم..." value={query} onChange={e=>setQuery(e.target.value)}/><select value={risk} onChange={e=>setRisk(e.target.value)}><option value="ALL">كل المستويات</option>{Object.keys(labels).map(x=><option value={x} key={x}>{labels[x]}</option>)}</select><select value={grade} onChange={e=>setGrade(e.target.value)}><option value="ALL">كل الصفوف</option>{grades.map(x=><option key={x}>{x}</option>)}</select></div><div className="table-wrap"><table className="assessment-table"><thead><tr><th>الطالب</th><th>الصف / الفصل</th><th>النسبة</th><th>المستوى</th><th>طلب دعم</th></tr></thead><tbody>{rows.map((x:any)=><tr key={x.student_id}><td><b>{x.student_name}</b><small>{x.student_no}</small></td><td>{x.grade_name}<small>{x.class_name}</small></td><td>{n(x.score_pct)}%</td><td><span className={"risk-pill "+riskClass(x.risk_code)}>{x.risk_label_ar}</span></td><td>{["YES","MAYBE"].includes(String(x.answers?.["43"]||""))?"نعم":"—"}</td></tr>)}</tbody></table></div></section>
  </>}
 </div>
}

function K({icon,v,t}:{icon:string;v:any;t:string}){return <div className="kpi"><span>{icon}</span><div><b>{v??"—"}</b><small>{t}</small></div></div>}