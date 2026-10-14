import {useEffect,useMemo,useRef,useState} from "react";
import {niceError,rpc} from "./client";
import "./teacher-student-report.css";

type Teacher={id:string;name:string;subject?:string};
type ReportClass={id:string;label:string};
type Student={id:string;name:string;student_no:string;class_id:string;class_name:string;grade_name:string};
type Activity={
  source_id:string;student_id:string;student_no:string;student_name:string;
  class_id:string;class_name:string;grade_name:string;event_at:string;
  category:string;title:string;detail?:string|null;subject?:string|null;
  status?:string|null;points?:number|null;effective_points?:number|null;
};
type StudentStats={student_id:string;student_name:string;student_no:string;class_id:string;class_name:string;
  grade_name:string;events:number;referrals:number;followup:number;checks:number;evaluations:number;valid_points:number};
type Summary={events:number;students:number;valid_points:number;referrals:number;followup:number;checks:number;evaluations:number;other:number};
type ReportData={can_select_teacher:boolean;teacher:Teacher|null;teachers:Teacher[];
  classes:ReportClass[];students:Student[];activities:Activity[];summary:Summary;student_stats:StudentStats[]};

const categories:[string,string][]=[
  ["ALL","جميع التعاملات"],["REFERRAL","التحويلات"],["FOLLOWUP","دفتر المتابعة"],
  ["CHECK","شيكات التميز"],["EVALUATION_REPORT","تقارير التقييم"],
  ["PERIODIC_EVALUATION","التقييم الدوري"],["BEHAVIORAL","التميز السلوكي"],
  ["ABSENCE","غياب الحصص"],["CLASS_EXIT","الاستئذان"]
];
const stateNames:Record<string,string>={
  OPEN:"مفتوح",COMPLETED:"مكتمل",PENDING:"بانتظار الاستكمال",
  APPROVED:"معتمد",REJECTED:"مرفوض",ISSUED:"صادر",REDEEMED:"مصروف",
  CANCELLED:"ملغي",REVERSED:"مسترجع",EXPIRED:"منتهي",
  POSITIVE:"إيجابي",NEGATIVE:"سلبي",HOMEWORK:"واجبات",GENERAL:"عام",
  NOMINATED:"مرشح",ABSENT:"غائب",RETURNED:"عاد",OUT:"خرج",
  NOT_EXITED:"لم يخرج"
};
const stamp=(raw:string)=>raw?new Date(raw).toLocaleString("ar-SA",{timeZone:"Asia/Riyadh",dateStyle:"medium",timeStyle:"short"}):"—";
const statusText=(s?:string|null)=>s?s.split(" / ").map(x=>stateNames[x]||x).join(" / "):"—";
const formatNumber=(n:number|undefined)=>Number(n||0).toLocaleString("ar-SA");
const blank:Summary={events:0,students:0,valid_points:0,referrals:0,followup:0,checks:0,evaluations:0,other:0};
const errorText=(e:unknown)=>{
  const s=String((e as Error)?.message||e||"");
  if(s.includes("TEACHER_REPORT_ACCESS_DENIED"))return "ليس لديك صلاحية الاطلاع على تقرير هذا المعلم.";
  if(s.includes("TEACHER_REPORT_CLASS_FORBIDDEN"))return "الفصل خارج نطاق المعلم المحدد.";
  if(s.includes("TEACHER_REPORT_STUDENT_FORBIDDEN"))return "الطالب خارج الفصول المسندة لهذا المعلم.";
  if(s.includes("TEACHER_REPORT_TEACHER_NOT_FOUND"))return "المعلم غير متاح أو غير مرتبط بهذه المدرسة.";
  if(s.includes("REPORT_DATE_RANGE_INVALID"))return "تاريخ البداية يجب أن يسبق تاريخ النهاية.";
  return niceError(e);
};
const quoteCsv=(v:unknown)=>'"'+String(v??"").replace(/"/g,'""')+'"';

export default function TeacherStudentReport({schoolName}:{schoolName:string}){
  const[data,setData]=useState<ReportData|null>(null);
  const[teacherId,setTeacherId]=useState("");
  const[classId,setClassId]=useState("");
  const[studentId,setStudentId]=useState("");
  const[from,setFrom]=useState("");
  const[to,setTo]=useState("");
  const[category,setCategory]=useState("ALL");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const[refresh,setRefresh]=useState(0);
  const[query,setQuery]=useState("");
  const requestRef=useRef(0);

  useEffect(()=>{
    let active=true;
    const request=++requestRef.current;
    async function load(){
      if(from&&to&&from>to){setError("تاريخ البداية يجب أن يسبق تاريخ النهاية.");return;}
      setBusy(true);setError("");
      try{
        const args:Record<string,string>={};
        if(teacherId)args.p_teacher_user_id=teacherId;
        if(classId)args.p_class_id=classId;
        if(studentId)args.p_student_id=studentId;
        if(from)args.p_from_date=from;
        if(to)args.p_to_date=to;
        const result=await rpc<ReportData>("api_teacher_student_report",args);
        if(!active||request!==requestRef.current)return;
        setData(result);
        if(result.can_select_teacher&&!teacherId&&result.teachers?.length)setTeacherId(result.teachers[0].id);
      }catch(e){if(active&&request===requestRef.current){setData(null);setError(errorText(e));}}
      finally{if(active&&request===requestRef.current)setBusy(false);}
    }
    void load();
    return()=>{active=false};
  },[teacherId,classId,studentId,from,to,refresh]);

  const activities=useMemo(()=>{
    const all=data?.activities||[];
    const text=query.trim().toLocaleLowerCase("ar");
    return all.filter(a=>(category==="ALL"||a.category===category) &&
      (!text||[a.student_name,a.student_no,a.title,a.detail,a.subject,a.grade_name,a.class_name]
        .some(v=>String(v||"").toLocaleLowerCase("ar").includes(text))));
  },[data?.activities,category,query]);
  const students=useMemo(()=>data?.students||[],[data?.students]);
  const selectedStudent=students.find(s=>s.id===studentId);
  const selectedClass=data?.classes?.find(c=>c.id===classId);
  const total=data?.summary||blank;
  const countByCategory=(key:string)=>data?.activities?.filter(a=>a.category===key).length||0;
  const stats=useMemo(()=>{
    const counts=new Map((data?.student_stats||[]).map(s=>[s.student_id,s]));
    return students.map(s=>counts.get(s.id)||{
      student_id:s.id,student_name:s.name,student_no:s.student_no,class_id:s.class_id,
      class_name:s.class_name,grade_name:s.grade_name,events:0,referrals:0,
      followup:0,checks:0,evaluations:0,valid_points:0
    });
  },[data?.student_stats,students]);
  const csv=()=>{
    const cols=["التاريخ","المعلم","الطالب","الرقم","الصف","الفصل","التصنيف","الإجراء",
      "التفاصيل","المادة","الحالة","النقاط الصادرة","النقاط الفعلية"];
    const rows=activities.map(a=>[
      stamp(a.event_at),data?.teacher?.name||"",a.student_name,a.student_no,
      a.grade_name,a.class_name,categories.find(c=>c[0]===a.category)?.[1]||a.category,
      a.title,a.detail||"",a.subject||"",statusText(a.status),a.points??"",a.effective_points??""
    ]);
    const file="\uFEFF"+[cols,...rows].map(r=>r.map(quoteCsv).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([file],{type:"text/csv;charset=utf-8;"}));
    const link=document.createElement("a");
    link.href=url;
    link.download="تقرير-المعلم-"+(data?.teacher?.name||"")+"-"+(selectedStudent?.name||selectedClass?.label||"كل-الفصول")+".csv";
    document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const changeClass=(id:string)=>{setClassId(id);setStudentId("");};
  const changeTeacher=(id:string)=>{setTeacherId(id);setClassId("");setStudentId("");};
  return <div className="tsr-root">
    <header className="topbar tsr-no-print"><div><h1>تقرير المعلم عن الطلاب</h1>
      <p>سجل موحد لكل ما سجله المعلم على الطالب أو طلاب الفصل في بنك التميز.</p></div></header>
    <main className="content tsr-content">
      <section className="panel tsr-filter tsr-no-print">
        <div className="panel-title"><div><h3>تحديد نطاق التقرير</h3>
          <p>اختر الفصل والطالب أو اترك الطالب على «جميع الطلاب» لاستخراج تقرير الفصل بالكامل.</p></div>
          <button className="mini-btn" type="button" onClick={()=>setRefresh(v=>v+1)} disabled={busy}>تحديث البيانات</button></div>
        <div className="tsr-fields">
          {data?.can_select_teacher&&<label>المعلم
            <select value={teacherId} onChange={e=>changeTeacher(e.target.value)}>
              <option value="">اختر المعلم</option>
              {(data.teachers||[]).map(t=><option key={t.id} value={t.id}>{t.name} — {t.subject||"—"}</option>)}
            </select>
          </label>}
          <label>الفصل
            <select value={classId} onChange={e=>changeClass(e.target.value)} disabled={!data?.teacher}>
              <option value="">كل الفصول المسندة</option>
              {(data?.classes||[]).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>الطالب
            <select value={studentId} onChange={e=>setStudentId(e.target.value)} disabled={!data?.teacher}>
              <option value="">جميع الطلاب (تقرير فصل)</option>
              {students.map(s=><option value={s.id} key={s.id}>{s.name} — {s.grade_name} / {s.class_name}</option>)}
            </select>
          </label>
          <label>من تاريخ<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
          <label>إلى تاريخ<input type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></label>
        </div>
        <div className="tsr-actions">
          <button className="btn primary" type="button" onClick={()=>window.print()} disabled={busy||!data?.teacher}>طباعة / حفظ PDF</button>
          <button className="btn ghost" type="button" onClick={csv} disabled={busy||!data?.teacher}>تصدير Excel (CSV)</button>
          {(classId||studentId||from||to||query||category!=="ALL")&&<button className="mini-btn" type="button" onClick={()=>{
            setClassId("");setStudentId("");setFrom("");setTo("");setQuery("");setCategory("ALL");
          }}>مسح عوامل التصفية</button>}
          {busy&&<span className="tsr-loading">جارٍ تحميل التقرير...</span>}
        </div>
        {error&&<div className="notice error" role="alert">{error}</div>}
      </section>

      {data?.teacher&&<>
        <section className="panel tsr-printable">
          <div className="tsr-print-heading">
            <div className="tsr-logos">
              <img src={import.meta.env.BASE_URL+"school-logo.png"} alt="شعار المدرسة"/>
              <img src={import.meta.env.BASE_URL+"guidance-logo.png"} alt="شعار التوجيه الطلابي"/>
            </div>
            <div><small>{schoolName}</small><h2>تقرير المعلم عن الطالب / الفصل</h2>
              <p>سجل تعاملات المعلم مع الطلاب داخل بنك التميز</p></div>
            <span className="tsr-report-date">تاريخ الاستخراج: {new Date().toLocaleDateString("ar-SA",{timeZone:"Asia/Riyadh"})}</span>
          </div>
          <div className="tsr-report-meta">
            <div><small>اسم المعلم</small><strong>{data.teacher.name}</strong></div>
            <div><small>المادة</small><strong>{data.teacher.subject||"—"}</strong></div>
            <div><small>الفصل</small><strong>{selectedClass?.label||"كل الفصول المسندة"}</strong></div>
            <div><small>الطالب</small><strong>{selectedStudent?.name||"جميع الطلاب"}</strong></div>
            <div><small>المدة</small><strong>{from||"من البداية"} — {to||"حتى اليوم"}</strong></div>
          </div>
          <div className="tsr-stat-grid">
            <div><small>إجمالي التعاملات</small><strong>{formatNumber(total.events)}</strong></div>
            <div><small>التحويلات</small><strong>{formatNumber(total.referrals)}</strong></div>
            <div><small>دفتر المتابعة</small><strong>{formatNumber(total.followup)}</strong></div>
            <div><small>الشيكات</small><strong>{formatNumber(total.checks)}</strong></div>
            <div><small>التقييمات</small><strong>{formatNumber(total.evaluations)}</strong></div>
            <div><small>النقاط السارية الممنوحة</small><strong>{formatNumber(total.valid_points)}</strong></div>
          </div>

          {!studentId&&<div className="tsr-section">
            <div className="tsr-section-title"><h3>ملخص الطلاب {selectedClass?"في الفصل":"في الفصول المسندة"}</h3><small>{formatNumber(stats.length)} طالب</small></div>
            <div className="table-wrap"><table className="tsr-table">
              <thead><tr><th>الطالب</th><th>الصف / الفصل</th><th>تحويلات</th><th>متابعة</th><th>شيكات</th><th>تقييمات</th><th>النقاط السارية</th><th>الإجمالي</th><th className="tsr-no-print">إجراء</th></tr></thead>
              <tbody>{stats.map(s=><tr key={s.student_id}>
                <td><b>{s.student_name}</b><small>{s.student_no}</small></td>
                <td>{s.grade_name} / {s.class_name}</td>
                <td>{formatNumber(s.referrals)}</td><td>{formatNumber(s.followup)}</td>
                <td>{formatNumber(s.checks)}</td><td>{formatNumber(s.evaluations)}</td>
                <td><b>{formatNumber(s.valid_points)}</b></td><td>{formatNumber(s.events)}</td>
                <td className="tsr-no-print"><button type="button" className="mini-btn" onClick={()=>setStudentId(s.student_id)}>تقرير الطالب</button></td>
              </tr>)}
              {!stats.length&&<tr><td colSpan={9}>لا يوجد طلاب في النطاق المختار.</td></tr>}</tbody>
            </table></div>
          </div>}

          <div className="tsr-section">
            <div className="tsr-section-title"><h3>السجل التفصيلي للتعاملات</h3>
              <small>{formatNumber(activities.length)} سجل</small></div>
            <div className="tsr-categories tsr-no-print">
              {categories.map(([id,label])=><button type="button" key={id}
                className={category===id?"active":""} onClick={()=>setCategory(id)}>
                {label}<span>{id==="ALL"?data.activities.length:countByCategory(id)}</span>
              </button>)}
            </div>
            <div className="tsr-search tsr-no-print"><input value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="ابحث باسم الطالب أو نص الملاحظة أو المادة أو نوع التعامل"/></div>
            <div className="table-wrap"><table className="tsr-table tsr-events">
              <thead><tr><th>التاريخ</th>{!studentId&&<th>الطالب</th>}<th>النوع</th>
                <th>الإجراء المسجل</th><th>التفاصيل</th><th>المادة</th><th>الحالة</th><th>النقاط</th></tr></thead>
              <tbody>
                {activities.map(a=><tr key={a.category+":"+a.source_id}>
                  <td className="tsr-date">{stamp(a.event_at)}</td>
                  {!studentId&&<td><b>{a.student_name}</b><small>{a.grade_name} / {a.class_name}</small></td>}
                  <td><span className={"tsr-type tsr-"+a.category.toLowerCase()}>{categories.find(c=>c[0]===a.category)?.[1]||a.category}</span></td>
                  <td><b>{a.title}</b></td><td className="tsr-detail">{a.detail||"—"}</td>
                  <td>{a.subject||"—"}</td><td>{statusText(a.status)}</td>
                  <td>{a.points==null?"—":<><b>{formatNumber(a.points)}</b>
                    {a.effective_points===0&&<small>غير محتسبة</small>}</>}</td>
                </tr>)}
                {!activities.length&&<tr><td colSpan={studentId?7:8} className="tsr-empty">لا توجد تعاملات مطابقة للفلاتر المختارة.</td></tr>}
              </tbody>
            </table></div>
          </div>
          <p className="tsr-legal">يتضمن التقرير التعاملات المسجلة بواسطة المعلم المحدد فقط. إجمالي النقاط السارية لا يشمل الشيكات الملغاة أو المعكوسة أو المرفوضة، ولا يمثل الرصيد الكلي للطالب.</p>
        </section>
      </>}
      {!data?.teacher&&!busy&&!error&&<section className="panel tsr-no-print">
        <div className="empty">اختر المعلم لعرض تقرير الطلاب والفصول المسندة إليه.</div>
      </section>}
      {!data&&busy&&<section className="panel tsr-no-print"><div className="empty">جارٍ إعداد سجل المعلم...</div></section>}
    </main>
  </div>;
}
