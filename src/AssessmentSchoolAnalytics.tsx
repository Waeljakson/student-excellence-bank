import {useMemo} from "react";
import "./assessments.css";

const riskHigh=(x?:string)=>x==="HIGH"||x==="VERY_HIGH";
const pct=(v:number)=>Number.isFinite(v)?Math.round(v*10)/10:0;

export default function AssessmentSchoolAnalytics({data}:{data:any}){
 const sc=data?.selected_scale;
 const students=(data?.students||[]).filter((x:any)=>x.status==="SUBMITTED");
 const questions=(sc?.questions||[]).filter((q:any)=>q.is_scored);

 const axes=useMemo(()=>{
  const map=new Map<string,{key:string;title:string;sum:number;count:number;attention:number}>();
  for(const st of students){
   for(const [key,val] of Object.entries(st.axis_scores||{}) as any){
    const x=map.get(key)||{key,title:val?.title||key,sum:0,count:0,attention:0};
    const p=Number(val?.pct||0);x.sum+=p;x.count++;if(p>=50)x.attention++;map.set(key,x);
   }
  }
  return [...map.values()].map(x=>({...x,avg:x.count?x.sum/x.count:0,attentionPct:x.count?x.attention*100/x.count:0})).sort((a,b)=>b.avg-a.avg);
 },[students]);

 const qstats=useMemo(()=>{
  return questions.map((q:any)=>{
   const vals=students.map((s:any)=>Number(s.answers?.[String(q.question_no)])).filter((v:number)=>Number.isFinite(v));
   const avg=vals.length?vals.reduce((a:number,b:number)=>a+b,0)/vals.length:0;
   const max=Number(q.max_score||0)||1;
   return {no:q.question_no,text:q.prompt_ar,section:q.section_title_ar,avgPct:avg*100/max,count:vals.length};
  }).sort((a:any,b:any)=>b.avgPct-a.avgPct).slice(0,10);
 },[questions,students]);

 const classes=useMemo(()=>{
  const map=new Map<string,{key:string;grade:string;className:string;sum:number;count:number;high:number}>();
  for(const s of students){
   const key=(s.grade_name||"")+"|"+(s.class_name||"");
   const x=map.get(key)||{key,grade:s.grade_name,className:s.class_name,sum:0,count:0,high:0};
   x.sum+=Number(s.score_pct||0);x.count++;if(riskHigh(s.risk_code))x.high++;map.set(key,x);
  }
  return [...map.values()].map(x=>({...x,avg:x.count?x.sum/x.count:0,highPct:x.count?x.high*100/x.count:0})).sort((a,b)=>b.avg-a.avg);
 },[students]);

 const submitted=students.length;
 const high=students.filter((s:any)=>riskHigh(s.risk_code)).length;
 const help=students.filter((s:any)=>["YES","MAYBE"].includes(String(s.answers?.["43"]||""))).length;
 const topAxis=axes[0],topClass=classes[0];

 if(!submitted)return <section className="panel school-insights empty-insights"><h3>التحليل المدرسي</h3><p>ستظهر الإحصاءات التفصيلية بعد بدء وصول إجابات الطلاب.</p></section>;

 return <section className="school-insights">
  <div className="insights-title"><div><span>تحليل إداري فقط</span><h2>خريطة المشكلات في المدرسة</h2><p>قراءة مجمعة للنتائج تساعد الإدارة على تحديد الأولويات، ولا تظهر للطلاب أو أولياء الأمور.</p></div></div>

  <div className="insight-cards">
   <article><span>أولوية مرتفعة</span><b>{submitted?Math.round(high*100/submitted):0}%</b><small>{high} من {submitted} طالبًا في مستوى مرتفع أو مرتفع جدًا</small></article>
   <article><span>أكثر محور تأثرًا</span><b>{topAxis?pct(topAxis.avg)+"%":"—"}</b><small>{topAxis?.title||"لا توجد بيانات"}</small></article>
   <article><span>أكثر فصل يحتاج متابعة</span><b>{topClass?pct(topClass.avg)+"%":"—"}</b><small>{topClass?topClass.grade+" — "+topClass.className:"لا توجد بيانات"}</small></article>
   <article><span>طلبوا مساعدة</span><b>{help}</b><small>طلاب اختاروا نعم أو ربما في سؤال طلب الدعم</small></article>
  </div>

  <div className="insights-grid">
   <section className="panel">
    <h3>المحاور الأكثر تأثرًا</h3>
    <p className="muted">المتوسط العام، ونسبة الطلاب الذين وصل المؤشر لديهم إلى 50% فأكثر في كل محور.</p>
    <div className="insight-axis-list">{axes.map(a=><div key={a.key}><header><b>{a.title}</b><span>{pct(a.avg)}%</span></header><i><b style={{width:Math.min(100,a.avg)+"%"}}/></i><small>{a.attention} طالبًا ({pct(a.attentionPct)}%) يحتاجون متابعة في هذا المحور</small></div>)}</div>
   </section>

   <section className="panel">
    <h3>الفصول ذات الأولوية</h3>
    <div className="table-wrap"><table className="assessment-table"><thead><tr><th>الصف / الفصل</th><th>المتوسط</th><th>مرتفع</th><th>نسبة الأولوية</th></tr></thead><tbody>{classes.slice(0,12).map(c=><tr key={c.key}><td><b>{c.grade}</b><small>{c.className}</small></td><td>{pct(c.avg)}%</td><td>{c.high}</td><td>{pct(c.highPct)}%</td></tr>)}</tbody></table></div>
   </section>
  </div>

  <section className="panel top-problems">
   <h3>أعلى الأسئلة مؤشرًا على المشكلة</h3>
   <p className="muted">ترتيب الأسئلة المقيّمة حسب متوسط شدة الإجابة داخل المدرسة.</p>
   <div className="problem-question-list">{qstats.map((q:any,i:number)=><article key={q.no}><b>{i+1}</b><div><span>س{q.no} · {q.section}</span><p>{q.text}</p><i><em style={{width:Math.min(100,q.avgPct)+"%"}}/></i></div><strong>{pct(q.avgPct)}%</strong></article>)}</div>
  </section>
 </section>
}