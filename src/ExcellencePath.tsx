import {FormEvent,useEffect,useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import "./excellence-path.css";

type Student={id:string;name:string;student_no:string;class_id:string;class_name:string;grade_name:string};
type PathRecord={
  id:string;student_id:string;student_name:string;student_no:string;class_id:string;
  class_name:string;grade_name:string;teacher_id:string;teacher_name:string;
  subject:string;test_type:string;semester:number;period:number;max_score:number;
  before_score:number;after_score:number;difference:number;change_percent:number|null;
  percentage_points:number;status:"POSITIVE"|"NEGATIVE"|"STABLE";note:string;
  created_at:string;updated_at:string;
};
type PathData={academic_year:string;can_manage:boolean;can_monitor:boolean;teacher_id:string;
  default_subject:string;students:Student[];records:PathRecord[]};
type SaveResult={id:string;status:string;difference:number;change_percent:number|null};
const examKinds:{id:string;label:string}[]=[
  {id:"PERIOD_TEST",label:"اختبار الفترة"},{id:"SHORT_TEST",label:"اختبار قصير"},
  {id:"DIAGNOSTIC",label:"اختبار تشخيصي"},{id:"FINAL",label:"اختبار نهائي"},
  {id:"OTHER",label:"اختبار آخر"}
];
const examLabel=(value:string)=>examKinds.find(k=>k.id===value)?.label||value;
const stateLabel:Record<string,string>={POSITIVE:"تحسّن إيجابي",NEGATIVE:"تغير سلبي",STABLE:"ثابت"};
const fmt=(value:number|null|undefined)=>value==null?"—":Number(value).toLocaleString("ar-SA",{maximumFractionDigits:2});
const diffNumber=(n:number)=>(n>0?"+":"")+fmt(n);
const dateLabel=(value:string)=>new Date(value).toLocaleDateString("ar-SA",{day:"numeric",month:"short",year:"numeric"});

export default function ExcellencePath({schoolName}:{schoolName:string}){
  const[data,setData]=useState<PathData|null>(null);
  const[loading,setLoading]=useState(false);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState("");
  const[notice,setNotice]=useState("");
  const[studentId,setStudentId]=useState("");
  const[subject,setSubject]=useState("");
  const[testType,setTestType]=useState("PERIOD_TEST");
  const[semester,setSemester]=useState("1");
  const[period,setPeriod]=useState("1");
  const[maxScore,setMaxScore]=useState("100");
  const[before,setBefore]=useState("");
  const[after,setAfter]=useState("");
  const[note,setNote]=useState("");
  const[editingId,setEditingId]=useState("");
  const[classFilter,setClassFilter]=useState("ALL");
  const[statusFilter,setStatusFilter]=useState("ALL");
  const[search,setSearch]=useState("");

  async function load(silent=false){
    if(!silent)setLoading(true);
    try{
      const result=await rpc<PathData>("api_excellence_path_data");
      if(!result||!Array.isArray(result.students)||!Array.isArray(result.records))
        throw new Error("تعذر تحميل بيانات طريق التفوق.");
      setData(result);
      setSubject(s=>s||result.default_subject||"");
      setError("");
    }catch(e){setError(niceError(e))}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);

  const students=data?.students||[];
  const records=data?.records||[];
  const classes=useMemo(()=>{
    const map=new Map<string,string>();
    students.forEach(s=>map.set(s.class_id,s.grade_name+" / فصل "+s.class_name));
    return [...map].sort((a,b)=>a[1].localeCompare(b[1],"ar"));
  },[students]);
  const visibleStudents=useMemo(()=>students.filter(s=>classFilter==="ALL"||s.class_id===classFilter),[students,classFilter]);
  const filtered=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase("ar");
    return records.filter(r=>(classFilter==="ALL"||r.class_id===classFilter)
      &&(statusFilter==="ALL"||r.status===statusFilter)
      &&(!q||[r.student_name,r.student_no,r.teacher_name,r.subject,r.note,r.grade_name,
        r.class_name,examLabel(r.test_type)].some(t=>String(t||"").toLocaleLowerCase("ar").includes(q))));
  },[records,classFilter,statusFilter,search]);
  const stats=useMemo(()=>({
    positive:filtered.filter(r=>r.status==="POSITIVE").length,
    negative:filtered.filter(r=>r.status==="NEGATIVE").length,
    stable:filtered.filter(r=>r.status==="STABLE").length,
    average:filtered.length?filtered.reduce((a,r)=>a+Number(r.percentage_points||0),0)/filtered.length:0
  }),[filtered]);

  const selected=students.find(s=>s.id===studentId);
  const score1=before.trim()===""?null:Number(before);
  const score2=after.trim()===""?null:Number(after);
  const maximum=Number(maxScore);
  const validScores=score1!==null&&score2!==null&&Number.isFinite(score1)&&Number.isFinite(score2)
    &&Number.isFinite(maximum)&&maximum>0&&maximum<=10000&&score1>=0&&score2>=0
    &&score1<=maximum&&score2<=maximum;
  const delta=validScores?Number((score2!-score1!).toFixed(2)):0;
  const relative=validScores&&score1!>0?(delta/score1!)*100:null;
  const points=validScores?(delta/maximum)*100:0;
  const trend=delta>0?"POSITIVE":delta<0?"NEGATIVE":"STABLE";

  function resetForm(){
    setEditingId("");setStudentId("");setBefore("");setAfter("");setNote("");
    setMaxScore("100");setTestType("PERIOD_TEST");setSemester("1");setPeriod("1");
    setSubject(data?.default_subject||"");
  }
  function editRecord(r:PathRecord){
    if(!data?.can_manage||r.teacher_id!==data.teacher_id)return;
    setEditingId(r.id);setStudentId(r.student_id);setSubject(r.subject);
    setTestType(r.test_type);setSemester(String(r.semester));setPeriod(String(r.period));
    setMaxScore(String(r.max_score));setBefore(String(r.before_score));setAfter(String(r.after_score));
    setNote(r.note||"");setNotice("");setError("");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  async function save(e:FormEvent){
    e.preventDefault();
    if(saving||!data?.can_manage)return;
    setError("");setNotice("");
    if(!selected){setError("اختر الطالب أولًا.");return}
    if(!subject.trim()){setError("حدد المادة الدراسية.");return}
    if(!validScores){setError("أدخل الدرجتين بشكل صحيح، وألا تتجاوز أي درجة الدرجة النهائية للاختبار.");return}
    setSaving(true);
    try{
      const args={
        p_record_id:editingId||null,p_student_id:studentId,
        p_subject_ar:subject.trim(),p_test_type:testType,p_semester:Number(semester),
        p_period:Number(period),p_max_score:maximum,p_before_score:score1,
        p_after_score:score2,p_note:note.trim()||null
      };
      const result=await rpc<SaveResult>("api_excellence_path_save",args);
      setNotice((editingId?"تم تحديث":"تم تسجيل")+" درجات الطالب بنجاح. النتيجة: "+
        (stateLabel[result.status]||result.status)+" ("+diffNumber(Number(result.difference))+" درجة).");
      const keep=studentId;
      resetForm();
      setStudentId(keep);
      await load(true);
    }catch(e){setError(niceError(e))}
    finally{setSaving(false)}
  }

  return <div className="excellence-path" dir="rtl">
    <header className="topbar"><div><h1>طريق التفوق</h1>
      <p>قياس أثر تحسين التحصيل الدراسي قبل الاختبار وبعده، ومتابعة اتجاه أداء كل طالب.</p>
    </div></header>
    <main className="content excellence-content">
      <section className="path-hero">
        <div><span className="path-kicker">برنامج تحسين نواتج التعلم</span>
          <h2>كل درجة خطوة في طريق التفوق</h2>
          <p>{schoolName} · العام الدراسي {data?.academic_year||"الحالي"}</p>
        </div>
        <div className="path-hero-score">↑ <span>قِس التحسن<br/>وتابع الأثر</span></div>
      </section>
      {error&&<div className="notice error" role="alert">{error}</div>}
      {notice&&<div className="notice" role="status">{notice}</div>}
      {loading&&!data&&<section className="panel"><p>جارٍ تحميل سجلات طريق التفوق...</p></section>}
      {data?.can_manage&&<section className="panel path-entry">
        <div className="panel-title"><div>
          <h3>{editingId?"تعديل قياس سابق":"تسجيل قياس جديد"}</h3>
          <p>حدد الطالب والاختبار والفصل والفترة، ثم أدخل درجته قبل التحسين وبعده.</p>
        </div>{editingId&&<button type="button" className="mini-btn" onClick={resetForm}>إلغاء التعديل</button>}</div>
        <form onSubmit={e=>void save(e)}>
          <div className="path-form-grid">
            <label className="path-wide">الطالب
              <select value={studentId} required onChange={e=>setStudentId(e.target.value)} disabled={!!editingId}>
                <option value="">اختر الطالب</option>
                {students.map(s=><option key={s.id} value={s.id}>{s.name} — {s.grade_name} / فصل {s.class_name}</option>)}
              </select>
            </label>
            <label>المادة الدراسية
              <input value={subject} required maxLength={120} onChange={e=>setSubject(e.target.value)}
                placeholder="مثل: الرياضيات"/>
            </label>
            <label>نوع الاختبار
              <select value={testType} onChange={e=>setTestType(e.target.value)}>
                {examKinds.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </label>
            <label>الفصل الدراسي
              <select value={semester} onChange={e=>setSemester(e.target.value)}>
                <option value="1">الفصل الدراسي الأول</option>
                <option value="2">الفصل الدراسي الثاني</option>
              </select>
            </label>
            <label>الفترة الدراسية
              <select value={period} onChange={e=>setPeriod(e.target.value)}>
                <option value="1">الفترة الأولى</option>
                <option value="2">الفترة الثانية</option>
              </select>
            </label>
            <label>الدرجة الكلية للاختبار
              <input type="number" min="0.01" max="10000" step="0.01" inputMode="decimal"
                value={maxScore} onChange={e=>setMaxScore(e.target.value)} required/>
            </label>
          </div>
          <div className="path-score-entry">
            <label>درجة الطالب قبل التحسين
              <input type="number" min="0" max={maximum||undefined} step="0.01" inputMode="decimal"
                value={before} onChange={e=>setBefore(e.target.value)} required placeholder="قبل"/>
            </label>
            <div className="path-score-arrow" aria-hidden="true">←</div>
            <label>درجة الطالب بعد التحسين
              <input type="number" min="0" max={maximum||undefined} step="0.01" inputMode="decimal"
                value={after} onChange={e=>setAfter(e.target.value)} required placeholder="بعد"/>
            </label>
          </div>
          {validScores&&<div className={"path-live path-"+trend.toLowerCase()}>
            <b>{stateLabel[trend]}</b>
            <strong>{diffNumber(delta)} درجة</strong>
            <span>{diffNumber(Number(points.toFixed(2)))} نقطة مئوية من الدرجة الكلية</span>
            <span>{relative==null?"التغير النسبي غير محدد لأن درجة البداية صفر":
              "التغير النسبي عن درجة البداية: "+diffNumber(Number(relative.toFixed(2)))+"%"}</span>
          </div>}
          <label className="path-note">ملاحظات التحسين (اختياري)
            <textarea rows={2} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}
              placeholder="ما الإجراءات التي ساعدت على تحسين أداء الطالب؟"/>
          </label>
          <div className="path-form-footer">
            <button className="btn primary" type="submit" disabled={!selected||!validScores||!subject.trim()||saving}>
              {saving?"جارٍ الحفظ...":editingId?"حفظ تعديل القياس":"حفظ درجات الطالب"}
            </button>
            <small>يُحتسب التغير تلقائيًا، دون إضافة نقاط إلى محفظة التميز.</small>
          </div>
        </form>
      </section>}
      {data&&!data.can_manage&&<section className="panel"><p>هذه الصفحة متاحة لك لمتابعة قياسات المعلمين. تسجيل الدرجات وتعديلها متاحان للمعلم صاحب القياس فقط.</p></section>}
      {data&&<section className="panel path-history">
        <div className="panel-title"><div><h3>متابعة نتائج طريق التفوق</h3>
          <p>القياسات المسجلة للعام الحالي، مع اتجاه التغير في درجات الطلاب.</p></div>
          <button className="mini-btn" type="button" onClick={()=>void load()} disabled={loading}>
            {loading?"جارٍ التحديث...":"تحديث السجل"}</button></div>
        <div className="path-filters">
          <label>الفصل<select value={classFilter} onChange={e=>setClassFilter(e.target.value)}>
            <option value="ALL">كل الفصول</option>
            {classes.map(([id,name])=><option key={id} value={id}>{name}</option>)}
          </select></label>
          <label>النتيجة<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="ALL">جميع النتائج</option>
            <option value="POSITIVE">تحسن إيجابي</option>
            <option value="NEGATIVE">تغير سلبي</option>
            <option value="STABLE">ثابت</option>
          </select></label>
          <label>بحث<input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="اسم الطالب أو المادة أو المعلم"/></label>
        </div>
        <div className="path-stats">
          <div><small>القياسات المعروضة</small><strong>{fmt(filtered.length)}</strong></div>
          <div className="path-positive"><small>تحسن إيجابي</small><strong>{fmt(stats.positive)}</strong></div>
          <div className="path-negative"><small>تغير سلبي</small><strong>{fmt(stats.negative)}</strong></div>
          <div className="path-stable"><small>ثابت</small><strong>{fmt(stats.stable)}</strong></div>
          <div><small>متوسط التغير من الدرجة الكلية</small><strong>{diffNumber(Number(stats.average.toFixed(2)))}%</strong></div>
        </div>
        <div className="table-wrap">
          <table className="path-table">
            <thead><tr><th>الطالب</th><th>المادة / الاختبار</th><th>الفصل / الفترة</th>
              <th>قبل</th><th>بعد</th><th>فرق الدرجات</th><th>التغير النسبي</th>
              <th>اتجاه الأداء</th><th>المعلم / التاريخ</th>{data.can_manage&&<th>إجراء</th>}</tr></thead>
            <tbody>
              {filtered.map(r=><tr key={r.id}>
                <td><b>{r.student_name}</b><small>{r.grade_name} / فصل {r.class_name}</small></td>
                <td><b>{r.subject}</b><small>{examLabel(r.test_type)}</small>{r.note&&<small title={r.note}>{r.note}</small>}</td>
                <td>الفصل {r.semester===1?"الأول":"الثاني"}<small>الفترة {r.period===1?"الأولى":"الثانية"}</small></td>
                <td>{fmt(r.before_score)}<small>من {fmt(r.max_score)}</small></td>
                <td><b>{fmt(r.after_score)}</b><small>من {fmt(r.max_score)}</small></td>
                <td><b>{diffNumber(Number(r.difference))}</b><small>{diffNumber(Number(r.percentage_points))} نقطة مئوية</small></td>
                <td>{r.change_percent==null?"غير محدد (قبل = صفر)":diffNumber(Number(r.change_percent))+"%"}</td>
                <td><span className={"path-badge path-"+r.status.toLowerCase()}>{stateLabel[r.status]}</span></td>
                <td><b>{r.teacher_name}</b><small>{dateLabel(r.updated_at)}</small></td>
                {data.can_manage&&<td>{r.teacher_id===data.teacher_id
                  ?<button type="button" className="mini-btn" onClick={()=>editRecord(r)}>تعديل</button>:"—"}</td>}
              </tr>)}
              {!filtered.length&&<tr><td colSpan={data.can_manage?10:9} className="path-empty">
                لا توجد قياسات مطابقة حتى الآن. {data.can_manage?"سجل قياسًا للطالب لتظهر النتيجة هنا.":""}
              </td></tr>}
            </tbody>
          </table>
        </div>
        <p className="path-method">معدل التغير النسبي = (درجة بعد التحسين − درجة قبل التحسين) ÷ درجة قبل التحسين × 100.
          إذا كانت درجة البداية صفرًا، يظهر فرق الدرجات ونسبة الفرق من الدرجة الكلية دون قسمة على صفر.
          المتوسط المعروض محسوب من فروق الدرجات كنسبة من الدرجة الكلية.</p>
      </section>}
    </main>
  </div>;
}
