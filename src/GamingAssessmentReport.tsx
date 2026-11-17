import {useMemo} from "react";
import "./assessments.css";
import "./gaming-assessment-report.css";

const pct=(v:any)=>Number.isFinite(Number(v))?Math.round(Number(v)*10)/10:0;
const riskLabel=(v:number)=>v>=75?"مرتفعة جدًا":v>=50?"مرتفعة":v>=25?"تستحق الانتباه":"منخفضة";
const riskTone=(v:number)=>v>=75?"very-high":v>=50?"high":v>=25?"watch":"low";

const axisActions:Record<string,string>={
  control:"تنفيذ برنامج قصير لتنظيم وقت اللعب، ووضع أهداف أسبوعية للضبط الذاتي مع متابعة الالتزام.",
  preoccupation:"زيادة البدائل الواقعية والأنشطة المدرسية، ومتابعة الطلاب الذين يسيطر التفكير في اللعب على يومهم.",
  emotional:"تقديم جلسات إرشادية حول إدارة التوتر والانفعال واستخدام بدائل صحية لتنظيم المزاج.",
  persistence:"استخدام عقود سلوكية ومتابعة تدريجية للطلاب الذين يستمرون في اللعب رغم النتائج السلبية.",
  academic:"ربط خطة المتابعة بالتحصيل والواجبات والانضباط، مع تنسيق مباشر بين التوجيه والمعلمين وولي الأمر.",
  sleep_health:"تنفيذ توعية بالنوم الصحي، وإيقاف اللعب قبل النوم، ومتابعة التعب والنعاس أثناء اليوم الدراسي.",
  family_social:"تنمية التواصل الأسري والاجتماعي، وتشجيع الأنشطة الجماعية وتقليل العزلة المرتبطة باللعب.",
  emotion_behavior:"تقديم دعم فردي لمهارات ضبط الغضب والانفعال والسلوك، وإحالة الحالات المستمرة لمختص مؤهل عند الحاجة."
};

export default function GamingAssessmentReport({data,schoolName}:{data:any;schoolName:string}){
 const sc=data?.selected_scale,s=data?.summary||{};
 const displaySchool=schoolName.includes("الشعلة")&&!schoolName.includes("الأهلية")?schoolName+" الأهلية":schoolName;
 const students=(data?.students||[]).filter((x:any)=>x.status==="SUBMITTED");
 const questions=sc?.questions||[];
 const choiceStats=data?.choice_stats||[];
 const submitted=Number(s.submitted_count||0),eligible=Number(s.eligible_students||0),completion=Number(s.completion_pct||0),avg=Number(s.average_score_pct||0);
 const high=students.filter((x:any)=>["HIGH","VERY_HIGH"].includes(String(x.risk_code))).length;
 const veryHigh=students.filter((x:any)=>x.risk_code==="VERY_HIGH").length;
 const help=students.filter((x:any)=>["YES","MAYBE"].includes(String(x.answers?.["43"]||""))).length;

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

 const questionStats=useMemo(()=>{
   return questions.filter((q:any)=>q.is_scored).map((q:any)=>{
     const vals=students.map((st:any)=>Number(st.answers?.[String(q.question_no)])).filter((v:number)=>Number.isFinite(v));
     const max=Number(q.max_score||4)||4;
     const av=vals.length?vals.reduce((a:number,b:number)=>a+b,0)/vals.length:0;
     return {no:q.question_no,text:q.prompt_ar,axis:q.axis_title_ar||q.section_title_ar||"—",avgPct:av*100/max,count:vals.length};
   }).sort((a:any,b:any)=>b.avgPct-a.avgPct);
 },[questions,students]);

 const classRows=useMemo(()=>{
   const submittedMap=new Map<string,{high:number,veryHigh:number}>();
   for(const st of students){
     const key=String(st.grade_name||"")+"|"+String(st.class_name||"");
     const x=submittedMap.get(key)||{high:0,veryHigh:0};
     if(["HIGH","VERY_HIGH"].includes(String(st.risk_code)))x.high++;
     if(st.risk_code==="VERY_HIGH")x.veryHigh++;
     submittedMap.set(key,x);
   }
   return (data?.class_stats||[]).map((x:any)=>{
     const k=String(x.grade_name||"")+"|"+String(x.class_name||"");
     const r=submittedMap.get(k)||{high:0,veryHigh:0};
     return {...x,high:r.high,veryHigh:r.veryHigh,highPct:Number(x.submitted)?r.high*100/Number(x.submitted):0};
   }).sort((a:any,b:any)=>Number(b.avg_score_pct||0)-Number(a.avg_score_pct||0));
 },[data?.class_stats,students]);

 const patterns=choiceStats.filter((q:any)=>Number(q.question_no)<=6);
 const regulation=choiceStats.filter((q:any)=>Number(q.question_no)>=39&&Number(q.question_no)<=44);
 const openResponses=questions.filter((q:any)=>Number(q.question_no)>=45&&Number(q.question_no)<=47).map((q:any)=>({question_no:q.question_no,prompt_ar:q.prompt_ar,values:students.map((st:any)=>String(st.answers?.[String(q.question_no)]||"").trim()).filter(Boolean)}));
 const topAxis=axes[0],secondAxis=axes[1],topClass=classRows[0];
 const participationNote=completion>=80
   ?"نسبة المشاركة مرتفعة وتسمح بقراءة مدرسية أكثر استقرارًا للنتائج الحالية."
   :completion>=60
     ?"نسبة المشاركة متوسطة؛ النتائج مفيدة للتوجيه، مع ضرورة استكمال بقية الطلاب قبل تعميم الاستنتاجات على المدرسة كلها."
     :"نسبة المشاركة الحالية ما زالت محدودة؛ يعرض التقرير مؤشرات المشاركين فقط ولا ينبغي اعتبارها ممثلة لجميع طلاب المدرسة قبل رفع نسبة الاستجابة.";

 const executive=topAxis
   ? `تظهر البيانات الحالية أن أبرز مجال يحتاج إلى تدخل هو «${topAxis.title}» بمتوسط ${pct(topAxis.avg)}%، وقد بلغ ${pct(topAxis.attentionPct)}% من المشاركين مستوى 50% فأكثر في هذا المحور.${secondAxis?` يليه محور «${secondAxis.title}» بمتوسط ${pct(secondAxis.avg)}%.`:""} ${high} طالبًا ضمن مستوى مرتفع أو مرتفع جدًا على المؤشر العام، منهم ${veryHigh} في المستوى المرتفع جدًا.`
   :"لا توجد بيانات كافية لبناء استنتاج تنفيذي بعد.";

 const scoredCount=questions.filter((q:any)=>q.is_scored).length;
 const axesCount=axes.length;

 function printReport(){window.print()}

 return <section className="gaming-report" dir="rtl">
   <div className="gaming-report-actions no-print">
     <div><span>تقرير خاص بمقياس الألعاب الإلكترونية</span><h2>التحليل المدرسي الشامل</h2></div>
     <button className="btn primary" onClick={printReport}>🖨 طباعة التقرير التحليلي الكامل</button>
   </div>

   <div className="gaming-print-header">
     <div className="gaming-report-mark">🎮</div>
     <div><span>قسم التوجيه الطلابي</span><h1>التقرير التحليلي لمقياس الإفراط في استخدام الألعاب الإلكترونية</h1><p>{displaySchool}</p></div>
     <div className="gaming-report-date"><span>تاريخ التقرير</span><b>{new Date().toLocaleDateString("ar-SA",{dateStyle:"long"})}</b></div>
   </div>

   <section className={"gaming-executive "+riskTone(avg)}>
     <div><span>القراءة العامة للمقياس</span><b>{pct(avg)}%</b><em>{riskLabel(avg)}</em></div>
     <article><h3>الخلاصة التنفيذية</h3><p>{executive}</p><small>{participationNote}</small></article>
   </section>

   <div className="gaming-kpis">
     <ReportKpi label="الطلاب المستهدفون" value={eligible} sub="طالبًا نشطًا"/>
     <ReportKpi label="أتموا المقياس" value={submitted} sub={pct(completion)+"% مشاركة"}/>
     <ReportKpi label="لم يشاركوا بعد" value={Math.max(eligible-submitted,0)} sub="يحتاجون استكمال التطبيق"/>
     <ReportKpi label="المؤشر العام" value={pct(avg)+"%"} sub={riskLabel(avg)}/>
     <ReportKpi label="أولوية مرتفعة" value={high} sub={(submitted?pct(high*100/submitted):0)+"% من المشاركين"}/>
     <ReportKpi label="طلبوا دعمًا" value={help} sub={(submitted?pct(help*100/submitted):0)+"% من المشاركين"}/>
   </div>

   <section className="gaming-report-section">
     <header><span>01</span><div><h3>المشاركة وتوزيع مستويات المؤشر</h3><p>يوضح مدى اكتمال التطبيق وحجم كل مستوى من مستويات المؤشر العام.</p></div></header>
     <div className="gaming-two-col">
       <div className="gaming-participation-graphic">
         <div className="gaming-donut" style={{"--p":Math.min(100,completion)} as any}><b>{pct(completion)}%</b><span>نسبة المشاركة</span></div>
         <p>{participationNote}</p>
       </div>
       <div className="gaming-risk-bars">
         {["VERY_HIGH","HIGH","WATCH","LOW"].map(code=>{
           const labels:any={VERY_HIGH:"مرتفعة جدًا",HIGH:"مرتفعة",WATCH:"تستحق الانتباه",LOW:"منخفضة"};
           const count=Number(s.risk_counts?.[code]||0),p=submitted?count*100/submitted:0;
           return <div key={code}><p><b>{labels[code]}</b><span>{count} طالب · {pct(p)}%</span></p><i><em style={{width:Math.min(100,p)+"%"}}/></i></div>
         })}
       </div>
     </div>
   </section>

   <section className="gaming-report-section page-break-before">
     <header><span>02</span><div><h3>تحليل المحاور الثمانية</h3><p>متوسط كل محور ونسبة الطلاب الذين وصلوا إلى 50% فأكثر داخله.</p></div></header>
     <div className="gaming-axis-report">{axes.map((a,i)=><article key={a.key}>
       <div className="axis-rank">{i+1}</div>
       <div className="axis-copy"><h4>{a.title}</h4><p>{a.attention} طالبًا يحتاجون متابعة في هذا المحور ({pct(a.attentionPct)}%).</p><i><em style={{width:Math.min(100,a.avg)+"%"}}/></i></div>
       <div className={"axis-score "+riskTone(a.avg)}><b>{pct(a.avg)}%</b><small>{riskLabel(a.avg)}</small></div>
     </article>)}</div>
   </section>

   <section className="gaming-report-section">
     <header><span>03</span><div><h3>أنماط استخدام الألعاب لدى الطلاب</h3><p>قراءة للأسئلة الوصفية الأولى لفهم طبيعة الاستخدام الفعلية قبل تفسير المحاور.</p></div></header>
     <div className="gaming-pattern-grid">{patterns.map((q:any)=><article key={q.question_no}>
       <h4>س{q.question_no} · {q.prompt_ar}</h4>
       <div>{(q.options||[]).map((o:any)=>{
         const count=Number(o.count||0),p=submitted?count*100/submitted:0;
         return <div className="pattern-row" key={o.code}><p><span>{o.label}</span><b>{count} · {pct(p)}%</b></p><i><em style={{width:Math.min(100,p)+"%"}}/></i></div>
       })}</div>
     </article>)}</div>
   </section>

   <section className="gaming-report-section">
     <header><span>04</span><div><h3>الضبط الذاتي والاستعداد للدعم</h3><p>يوضح وجود قواعد أسرية، ومحاولات خفض اللعب، والجوانب الأكثر تأثرًا، واستعداد الطالب للحصول على مساعدة.</p></div></header>
     <div className="gaming-pattern-grid regulation-grid">{regulation.map((q:any)=><article key={q.question_no}>
       <h4>س{q.question_no} · {q.prompt_ar}</h4>
       <div>{(q.options||[]).map((o:any)=>{
         const count=Number(o.count||0),p=submitted?count*100/submitted:0;
         return <div className="pattern-row" key={o.code}><p><span>{o.label}</span><b>{count} · {pct(p)}%</b></p><i><em style={{width:Math.min(100,p)+"%"}}/></i></div>
       })}</div>
     </article>)}</div>
     <div className="open-response-summary">
       <h4>الإجابات المفتوحة</h4>
       <p>تُعرض دون أسماء للاستفادة النوعية في التخطيط الإرشادي.</p>
       {openResponses.map((q:any)=><article key={q.question_no}><header><b>س{q.question_no}</b><span>{q.prompt_ar}</span><em>{q.values.length} إجابة</em></header><div>{q.values.slice(0,10).map((v:string,i:number)=><p key={i}>“{v}”</p>)}</div>{q.values.length>10&&<small>+ {q.values.length-10} إجابة إضافية محفوظة في بيانات المقياس.</small>}</article>)}
     </div>
   </section>

   <section className="gaming-report-section page-break-before">
     <header><span>05</span><div><h3>الصفوف والفصول ذات الأولوية</h3><p>المتوسطات ترتب الفصول حسب نتائج الطلاب الذين أتموا المقياس، مع إظهار نسبة المشاركة لتجنب التفسير المضلل.</p></div></header>
     <div className="gaming-two-col align-start">
       <div><h4 className="subhead">حسب الصف</h4><table className="gaming-report-table"><thead><tr><th>الصف</th><th>المشاركة</th><th>المتوسط</th></tr></thead><tbody>{(data?.grade_stats||[]).map((g:any)=><tr key={g.grade_name}><td>{g.grade_name}</td><td>{g.submitted}/{g.eligible} · {pct(g.completion_pct)}%</td><td><b>{pct(g.avg_score_pct)}%</b></td></tr>)}</tbody></table></div>
       <div><h4 className="subhead">أعلى الفصول مؤشرًا</h4><table className="gaming-report-table"><thead><tr><th>الفصل</th><th>المشاركة</th><th>المتوسط</th><th>أولوية مرتفعة</th></tr></thead><tbody>{classRows.slice(0,12).map((c:any)=><tr key={c.grade_name+"|"+c.class_name}><td>{c.grade_name} · {c.class_name}</td><td>{c.submitted}/{c.eligible} · {pct(c.completion_pct)}%</td><td><b>{pct(c.avg_score_pct)}%</b></td><td>{c.high} · {pct(c.highPct)}%</td></tr>)}</tbody></table></div>
     </div>
     {topClass&&<div className="gaming-callout"><b>تنبيه تحليلي:</b> أعلى متوسط حاليًا يظهر في {topClass.grade_name} · {topClass.class_name} بمتوسط {pct(topClass.avg_score_pct)}%، لكن يجب قراءة ذلك مع نسبة مشاركته البالغة {pct(topClass.completion_pct)}%.</div>}
   </section>

   <section className="gaming-report-section page-break-before">
     <header><span>06</span><div><h3>أعلى البنود الدالة على المشكلة</h3><p>ترتيب البنود المسجلة حسب متوسط شدة الإجابة بين الطلاب المشاركين.</p></div></header>
     <div className="gaming-question-report">{questionStats.slice(0,15).map((q:any,i:number)=><article key={q.no}>
       <b>{i+1}</b><div><span>س{q.no} · {q.axis}</span><h4>{q.text}</h4><i><em style={{width:Math.min(100,q.avgPct)+"%"}}/></i></div><strong>{pct(q.avgPct)}%</strong>
     </article>)}</div>
   </section>

   <section className="gaming-report-section">
     <header><span>07</span><div><h3>الطلاب ذوو الأولوية المرتفعة</h3><p>قائمة إدارية سرية للمتابعة الفردية، ولا تظهر للطلاب أو أولياء الأمور ضمن التقرير المدرسي.</p></div></header>
     <table className="gaming-report-table priority-table"><thead><tr><th>#</th><th>الطالب</th><th>الصف / الفصل</th><th>المؤشر</th><th>المستوى</th><th>طلب دعم</th></tr></thead><tbody>{students.filter((x:any)=>["HIGH","VERY_HIGH"].includes(String(x.risk_code))).map((x:any,i:number)=><tr key={x.student_id}><td>{i+1}</td><td><b>{x.student_name}</b><small>{x.student_no}</small></td><td>{x.grade_name} · {x.class_name}</td><td>{pct(x.score_pct)}%</td><td>{x.risk_label_ar}</td><td>{["YES","MAYBE"].includes(String(x.answers?.["43"]||""))?"نعم":"—"}</td></tr>)}</tbody></table>
   </section>

   <section className="gaming-report-section page-break-before">
     <header><span>08</span><div><h3>خطة التدخل المدرسية المقترحة</h3><p>تُبنى الأولويات على المحاور الأعلى في النتائج الحالية.</p></div></header>
     <div className="gaming-recommendations">{axes.slice(0,4).map((a,i)=><article key={a.key}><span>{i+1}</span><div><h4>{a.title}</h4><p>{axisActions[a.key]||"إعداد تدخل إرشادي موجه لهذا المحور ومتابعة الحالات الأعلى."}</p><small>متوسط المحور {pct(a.avg)}% · {a.attention} طالبًا عند 50% فأكثر</small></div></article>)}</div>
     <div className="gaming-action-timeline">
       <div><b>خلال 48 ساعة</b><p>تحديد الحالات المرتفعة جدًا والتواصل مع أولياء أمورها، ومراجعة الطلاب الذين طلبوا مساعدة.</p></div>
       <div><b>خلال أسبوع</b><p>تنفيذ جلسات إرشادية للمحاور الأعلى، وإعداد متابعة خاصة للفصول الأعلى مؤشرًا.</p></div>
       <div><b>بعد أسبوعين</b><p>قياس الالتزام بالخطة ومراجعة النوم والتحصيل والسلوك، مع إحالة الحالات المستمرة لمختص مؤهل عند الحاجة.</p></div>
     </div>
   </section>

   <section className="gaming-report-section methodology">
     <header><span>09</span><div><h3>منهجية القراءة وحدود التقرير</h3></div></header>
     <ul>
       <li>يعتمد التقرير على {submitted} استجابة مكتملة وقت الطباعة من أصل {eligible} طالبًا مستهدفًا.</li>
       <li>يتكون الجزء المسجل من {scoredCount} بندًا موزعًا على {axesCount} محاور، ويُحوّل المجموع إلى نسبة مئوية.</li>
       <li>مستويات المؤشر المستخدمة في النظام: أقل من 25% منخفض، 25–أقل من 50% يستحق الانتباه، 50–أقل من 75% مرتفع، 75% فأكثر مرتفع جدًا.</li>
       <li>هذا التقرير أداة فحص وتوجيه تربوي مدرسي، وليس تشخيصًا طبيًا أو نفسيًا. التشخيص السريري يتطلب تقييمًا مباشرًا من مختص مؤهل.</li>
       <li>تفسير الصفوف والفصول يجب أن يراعي نسبة المشاركة؛ انخفاض الاستجابة قد يغيّر ترتيب المتوسطات.</li>
     </ul>
   </section>

   <footer className="gaming-report-footer"><div><b>قسم التوجيه الطلابي</b><span>{displaySchool}</span></div><div><span>تقرير سري للاستخدام الإداري</span><b>{new Date().toLocaleString("ar-SA")}</b></div></footer>
 </section>
}

function ReportKpi({label,value,sub}:{label:string;value:any;sub:string}){return <article><span>{label}</span><b>{value}</b><small>{sub}</small></article>}
