import {useEffect,useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import "./phase3-support.css";

type Student={student_id:string;student_name:string;student_no:string;class_id:string;class_name:string;
 grade_id:string;grade_name:string;negative_notes:number;homework_notes:number;positive_notes:number;
 open_referrals:number;active_plans:number;overdue_plans:number;needs_review:boolean};
type Queue={school_name:string;days:number;generated_at:string;summary:{
 students:number;review_candidates:number;active_plans:number;overdue_plans:number};students:Student[]};
type Plan={id:string;concern_kind:string;goal_ar:string;action_ar:string;private_note:string;
 status:string;review_on:string|null;created_at:string;updated_at:string;created_by_name:string};
type History={student:{id:string;name:string;student_no:string};plans:Plan[]};
type Form={id:string|null;concern_kind:string;goal_ar:string;action_ar:string;private_note:string;
 status:string;review_on:string};
const fresh=():Form=>({id:null,concern_kind:"ACADEMIC",goal_ar:"",action_ar:"",private_note:"",
 status:"OPEN",review_on:""});
const concern:{[key:string]:string}={ACADEMIC:"دعم دراسي",BEHAVIOR:"متابعة سلوكية",
 ATTENDANCE:"انتظام وحضور",HOMEWORK:"متابعة الواجبات",OTHER:"دعم عام"};
const statuses:{[key:string]:string}={OPEN:"خطة جديدة",IN_PROGRESS:"قيد المتابعة",
 COMPLETED:"مكتملة",CLOSED:"مغلقة"};
const fmt=(n:number)=>Number(n||0).toLocaleString("ar-SA");
const prettyDate=(s:string|null)=>s?new Date(s).toLocaleDateString("ar-SA",{dateStyle:"medium"}):"لم يحدد";
export default function Phase3SupportCenter(){
 const[days,setDays]=useState(30),[refresh,setRefresh]=useState(0),[data,setData]=useState<Queue|null>(null);
 const[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const[filter,setFilter]=useState("REVIEW"),[query,setQuery]=useState(""),[grade,setGrade]=useState(""),[cls,setCls]=useState("");
 const[student,setStudent]=useState<Student|null>(null),[history,setHistory]=useState<History|null>(null);
 const[loadingHistory,setLoadingHistory]=useState(false),[historyError,setHistoryError]=useState("");
 const[form,setForm]=useState<Form>(fresh),[saving,setSaving]=useState(false);
 useEffect(()=>{let alive=true;setBusy(true);setError("");
 rpc<Queue>("api_phase3_review_queue",{p_days:days,p_grade_id:null,p_class_id:null})
 .then(r=>{if(alive)setData(r)}).catch(e=>{if(alive)setError(niceError(e))})
 .finally(()=>{if(alive)setBusy(false)});return()=>{alive=false}},[days,refresh]);
 const students=data?.students||[];
 const grades=useMemo(()=>Array.from(new Map(students.map(x=>[x.grade_id,{id:x.grade_id,name:x.grade_name}])).values()),[students]);
 const classes=useMemo(()=>Array.from(new Map(students.filter(x=>!grade||x.grade_id===grade)
   .map(x=>[x.class_id,{id:x.class_id,name:x.grade_name+" — "+x.class_name}])).values()),[students,grade]);
 const results=useMemo(()=>students.filter(s=>
 (!grade||s.grade_id===grade)&&(!cls||s.class_id===cls)&&
 (!query.trim()||s.student_name.includes(query.trim())||s.student_no.includes(query.trim()))&&
 (filter==="ALL"||(filter==="REVIEW"&&s.needs_review)||(filter==="ACTIVE"&&s.active_plans>0)
 ||(filter==="OVERDUE"&&s.overdue_plans>0))),[students,grade,cls,query,filter]);
 useEffect(()=>{if(!student)return;let alive=true;setHistory(null);setHistoryError("");
 setLoadingHistory(true);
 rpc<History>("api_phase3_plan_history",{p_student_id:student.student_id})
 .then(h=>{if(alive)setHistory(h)}).catch(e=>{if(alive)setHistoryError(niceError(e))})
 .finally(()=>{if(alive)setLoadingHistory(false)});
 return()=>{alive=false}},[student,refresh]);
 function select(s:Student){setStudent(s);setForm(fresh());setNotice("");setHistoryError("")}
 function edit(p:Plan){setForm({id:p.id,concern_kind:p.concern_kind,goal_ar:p.goal_ar,
 action_ar:p.action_ar,private_note:p.private_note||"",status:p.status,
 review_on:p.review_on?p.review_on.slice(0,10):""})}
 function update<K extends keyof Form>(key:K,value:Form[K]){setForm(f=>({...f,[key]:value}))}
 async function save(){
 if(!student||saving)return;
 setSaving(true);setError("");setNotice("");
 try{
  await rpc("api_phase3_save_plan",{p_id:form.id,p_student_id:student.student_id,
   p_concern_kind:form.concern_kind,p_goal:form.goal_ar.trim(),p_action:form.action_ar.trim(),
   p_review_on:form.review_on||null,p_private_note:form.private_note,p_status:form.status});
  setNotice("تم حفظ خطة الدعم بنجاح. لم يُرسل أي إشعار إلى ولي الأمر أو الطالب.");
  setForm(fresh());setRefresh(x=>x+1);
 }catch(e){setError(niceError(e))}finally{setSaving(false)}
 }
 return <main className="p3-root content" dir="rtl">
 <header className="p3-head"><div><span>نظام التوجيه الطلابي — صلاحيات محمية</span>
 <h1>الدعم المبكر والمتابعة</h1><p>مؤشرات موضوعية للمراجعة البشرية، وخطط دعم قابلة للمتابعة دون تصنيف الطلاب أو اتخاذ إجراءات آلية.</p></div>
 <button type="button" onClick={()=>setRefresh(x=>x+1)} disabled={busy} className="p3-btn light">تحديث المؤشرات ↻</button></header>
 {error&&<p className="p3-error" role="alert">{error}</p>}{notice&&<p className="p3-success" role="status">{notice}</p>}
 <div className="p3-filters">
 <label>الفترة<select value={days} onChange={e=>setDays(Number(e.target.value))}>{[14,30,60,90].map(n=><option key={n} value={n}>آخر {n} يومًا</option>)}</select></label>
 <label>الصف<select value={grade} onChange={e=>{setGrade(e.target.value);setCls("")}}><option value="">كل الصفوف</option>{grades.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 <label>الفصل<select value={cls} onChange={e=>setCls(e.target.value)}><option value="">كل الفصول</option>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 <label>بحث الطالب<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="الاسم أو الرقم"/></label>
 <label>العرض<select value={filter} onChange={e=>setFilter(e.target.value)}>
 <option value="REVIEW">تحتاج مراجعة</option><option value="ACTIVE">لديهم خطط نشطة</option>
 <option value="OVERDUE">متابعة متأخرة</option><option value="ALL">جميع الطلاب</option></select></label>
 </div>
 {busy&&!data&&<p className="p3-empty">جارٍ جلب بيانات المدرسة…</p>}
 {data&&<><p className="p3-school">{data.school_name} — المؤشرات لا تظهر في بوابتي الطالب وولي الأمر</p>
 <section className="p3-stats">
 <article><span>طلاب المدرسة</span><strong>{fmt(data.summary.students)}</strong></article>
 <article><span>مؤشرات تستدعي مراجعة</span><strong>{fmt(data.summary.review_candidates)}</strong></article>
 <article><span>خطط متابعة نشطة</span><strong>{fmt(data.summary.active_plans)}</strong></article>
 <article><span>مواعيد مراجعة متأخرة</span><strong>{fmt(data.summary.overdue_plans)}</strong></article>
 </section>
 <div className="p3-notice">وجود ملاحظتين سلبيتين، أو ثلاث ملاحظات واجب، أو إحالة مفتوحة يُظهر الطالب للمراجعة فقط.
 لا يمثل ذلك تشخيصًا أو حكمًا على الطالب، ولا تترتب عليه خصومات أو إشعارات آلية.</div>
 <section className="p3-card"><h2>قائمة المتابعة ({fmt(results.length)})</h2>
 <div className="p3-table"><table><thead><tr><th>الطالب</th><th>الصف والفصل</th><th>ملاحظات تحتاج متابعة</th>
 <th>الواجب</th><th>ملاحظات إيجابية</th><th>إحالات مفتوحة</th><th>خطط نشطة</th><th>الإجراء</th></tr></thead>
 <tbody>{results.map(s=><tr key={s.student_id}>
 <td><b>{s.student_name}</b><small>{s.student_no}</small></td><td>{s.grade_name} — {s.class_name}</td>
 <td>{fmt(s.negative_notes)}</td><td>{fmt(s.homework_notes)}</td><td>{fmt(s.positive_notes)}</td>
 <td>{fmt(s.open_referrals)}</td><td>{fmt(s.active_plans)}{s.overdue_plans>0&&<small className="p3-overdue">مراجعة متأخرة</small>}</td>
 <td><button type="button" className="p3-btn" onClick={()=>select(s)}>فتح المتابعة</button></td>
 </tr>)}</tbody></table></div>
 {!results.length&&<p className="p3-empty">لا توجد نتائج توافق عوامل التصفية الحالية.</p>}
 </section></>}
 {student&&<div className="p3-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setStudent(null)}}>
 <section className="p3-dialog" role="dialog" aria-modal="true" aria-labelledby="p3-title">
 <div className="p3-dialog-head"><div><h2 id="p3-title">متابعة {student.student_name}</h2>
 <p>{student.grade_name} — الفصل {student.class_name}</p></div><button className="p3-btn light" onClick={()=>setStudent(null)}>إغلاق ×</button></div>
 <div className="p3-case-summary">
 <span>ملاحظات تحتاج متابعة: {student.negative_notes}</span>
 <span>واجبات: {student.homework_notes}</span><span>إحالات مفتوحة: {student.open_referrals}</span>
 <span>ملاحظات إيجابية: {student.positive_notes}</span></div>
 {historyError&&<p className="p3-error">{historyError}</p>}
 {loadingHistory&&<p>جارٍ عرض سجل خطط الدعم…</p>}
 <section className="p3-form"><h3>{form.id?"تعديل خطة المتابعة":"خطة دعم جديدة"}</h3>
 <div className="p3-grid">
 <label>مجال المتابعة<select value={form.concern_kind} onChange={e=>update("concern_kind",e.target.value)}>
 {Object.entries(concern).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label>الحالة<select value={form.status} onChange={e=>update("status",e.target.value)}>
 {Object.entries(statuses).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label>موعد مراجعة الخطة<input type="date" value={form.review_on} onChange={e=>update("review_on",e.target.value)}/></label></div>
 <label>الهدف التربوي<input maxLength={600} value={form.goal_ar} onChange={e=>update("goal_ar",e.target.value)} placeholder="هدف محدد قابل للمتابعة"/></label>
 <label>خطوات الدعم<textarea rows={3} maxLength={1200} value={form.action_ar} onChange={e=>update("action_ar",e.target.value)} placeholder="الإجراء المتفق عليه والمسؤول عن تنفيذه"/></label>
 <label>ملاحظات داخلية سرية<textarea rows={2} maxLength={2000} value={form.private_note} onChange={e=>update("private_note",e.target.value)} placeholder="للاستخدام التربوي الداخلي فقط"/></label>
 <div className="p3-actions"><button className="p3-btn light" onClick={()=>setForm(fresh())}>خطة جديدة</button>
 <button className="p3-btn" disabled={saving||form.goal_ar.trim().length<5||form.action_ar.trim().length<5}
 onClick={()=>void save()}>{saving?"جارٍ الحفظ...":"حفظ خطة المتابعة"}</button></div></section>
 <section className="p3-history"><h3>سجل خطط الدعم السابقة</h3>
 {(history?.plans||[]).map(p=><article key={p.id}>
 <div><b>{concern[p.concern_kind]||p.concern_kind}</b><span>{statuses[p.status]||p.status}</span></div>
 <p><strong>الهدف:</strong> {p.goal_ar}</p><p><strong>الإجراء:</strong> {p.action_ar}</p>
 <p><strong>المراجعة:</strong> {prettyDate(p.review_on)} — <strong>أعدّها:</strong> {p.created_by_name}</p>
 <button className="p3-btn light" onClick={()=>edit(p)}>تعديل الخطة</button></article>)}
 {history&&!history.plans.length&&<p className="p3-empty">لا توجد خطط سابقة لهذا الطالب.</p>}</section>
 </section></div>}
 </main>;
}
