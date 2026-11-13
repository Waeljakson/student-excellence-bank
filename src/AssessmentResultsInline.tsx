import "./assessments.css";

const riskClass=(x?:string)=>x==="VERY_HIGH"?"danger":x==="HIGH"?"warn":x==="WATCH"?"watch":"good";

export function AssessmentResultsInline({children,emptyMessage=true}:{children:Array<{id:string;name:string;assessment_results?:any[]}>;emptyMessage?:boolean}){
 const visible=children.filter(x=>(x.assessment_results||[]).length);
 if(!visible.length)return emptyMessage?<section className="panel" dir="rtl"><h3>نتائج المقاييس</h3><p>لا توجد نتائج منشورة حتى الآن.</p></section>:null;

 return <section className="assessment-shell guardian-assessments" dir="rtl">
  <header className="assessment-title"><span>بوابة ولي الأمر</span><h2>نتائج المقاييس</h2><p>نتائج تربوية تساعد الأسرة والمدرسة على تحديد احتياج الطالب وخطة التدخل المناسبة.</p></header>
  {visible.map(c=><div key={c.id}><h3>الطالب: {c.name}</h3>{(c.assessment_results||[]).map(r=>{
    const axes=(Object.values(r.axis_scores||{}) as any[]).sort((a,b)=>Number(b.pct)-Number(a.pct));
    const top=axes.slice(0,3);
    return <article className="panel guardian-result detailed" key={r.scale_id}>
      <header><div><h3>🎮 {r.short_title_ar}</h3><p>{r.title_ar}</p></div><span className={"risk-pill "+riskClass(r.risk_code)}>{r.risk_label_ar}</span></header>

      <div className="guardian-score-row">
       <div className={"guardian-score "+riskClass(r.risk_code)}><b>{Math.round(r.score_pct)}%</b><small>المؤشر العام</small></div>
       <div className="guardian-interpretation"><span>الاستنتاج التربوي</span><h4>{r.follow_up_priority_ar||"متابعة"}</h4><p>{r.educational_interpretation_ar||"تحتاج النتيجة إلى مراجعة مع التوجيه الطلابي."}</p></div>
      </div>

      {!!top.length&&<section className="guardian-priorities"><h4>أبرز الجوانب التي تحتاج انتباهًا</h4><div>{top.map((a:any,i:number)=><article key={a.title}><b>{i+1}</b><span>{a.title}</span><strong>{Math.round(a.pct)}%</strong></article>)}</div></section>}

      <div className="guardian-axis-grid">{axes.map((a:any)=><div key={a.title}><p><b>{a.title}</b><span>{Math.round(a.pct)}%</span></p><i><b style={{width:String(a.pct)+"%"}}/></i></div>)}</div>

      <section className="parent-role intervention-plan">
       <div className="plan-head"><div><span>خطة تدخل عملية للأسرة</span><h4>ما الذي نحتاج فعله الآن؟</h4></div><b>{(r.parent_advice||[]).length} خطوات</b></div>
       <ol>{(r.parent_advice||[]).map((x:string,i:number)=><li key={i}><span>{i+1}</span><p>{x}</p></li>)}</ol>
      </section>

      <section className="family-plan timeline-plan">
       <h4>جدول المتابعة المقترح</h4>
       <div>
        <span><b>48 ساعة</b><em>مناقشة النتيجة ووضع الاتفاق الأسري الأول.</em></span>
        <span><b>7 أيام</b><em>مراجعة الالتزام والنوم والدراسة والانفعال.</em></span>
        <span><b>14 يومًا</b><em>تقييم التحسن وتعديل الخطة بالتعاون مع التوجيه الطلابي عند الحاجة.</em></span>
        <span><b>عند عدم التحسن</b><em>إذا استمر التأثير الواضح، يوصى بتقييم مختص مؤهل.</em></span>
       </div>
      </section>

      <div className="assessment-disclaimer"><b>تنبيه مهني:</b> {r.disclaimer_ar||"هذه نتيجة فحص تربوي مدرسي وليست تشخيصًا طبيًا. التشخيص السريري يتطلب تقييمًا مباشرًا من مختص مؤهل."}</div>
    </article>
  })}</div>)}
 </section>
}